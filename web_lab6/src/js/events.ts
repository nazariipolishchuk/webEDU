// js/events.ts: event handlers and form validation.
import * as render from "./render.ts";
import type { Field } from "./render.ts";
import * as storage from "./storage.ts";
import type { CatalogueState, Dataset, DatasetDraft, DatasetPatch, SavedView } from "./types.ts";
import { debounce, element } from "./utils.ts";

const MIN_TITLE = 3;
const SEARCH_DELAY = 300;

// The flags of ValidityState in the order they are checked
const FLAGS = [
  "valueMissing",
  "badInput",
  "patternMismatch",
  "tooShort",
  "stepMismatch",
  "rangeUnderflow",
  "rangeOverflow",
] as const satisfies readonly (keyof ValidityState)[];

type Flag = (typeof FLAGS)[number];

const TOO_SHORT = `Use at least ${MIN_TITLE} characters.`;

// Partial: a field has messages only for the flags its attributes can raise
const MESSAGES: Record<string, Partial<Record<Flag, string>>> = {
  title: {
    valueMissing: "Enter the dataset name.",
    tooShort: TOO_SHORT,
  },
  code: {
    valueMissing: "Enter the dataset code.",
    patternMismatch:
      "Use 2 to 4 capital letters, a hyphen and 3 to 5 digits, for example CXR-1001.",
  },
  modality: {
    valueMissing: "Choose the scan type.",
  },
  quantity: {
    valueMissing: "Enter the number of scans.",
    badInput: "Enter a whole number.",
    stepMismatch: "Enter a whole number.",
    rangeUnderflow: "A dataset needs at least 1 scan.",
    rangeOverflow: "Enter no more than 10,000,000 scans.",
  },
  price: {
    valueMissing: "Enter the price per scan.",
    badInput: "Enter a number, for example 4.50.",
    stepMismatch: "Use no more than two decimal places.",
    rangeUnderflow: "The price cannot be negative.",
    rangeOverflow: "Enter no more than ₴100,000 per scan.",
  },
};

const toKopiykas = (value: string) => Math.round(Number(value) * 100);

const isField = (node: unknown): node is Field =>
  node instanceof HTMLInputElement ||
  node instanceof HTMLSelectElement ||
  node instanceof HTMLTextAreaElement;

// Rules the browser cannot express with attributes
const customMessage = (field: Field, items: Dataset[]) => {
  if (field.name === "title" && field.value.trim().length < MIN_TITLE) return TOO_SHORT;
  if (field.name === "code" && items.some((item) => item.code === field.value)) {
    return `Code ${field.value} is already in the catalogue.`;
  }
  return "";
};

const validateField = (field: Field, items: Dataset[]): boolean => {
  if (field.name === "code") field.value = field.value.trim().toUpperCase();
  field.setCustomValidity(""); // otherwise the previous custom error keeps the field invalid
  const flag = FLAGS.find((name) => field.validity[name]);
  const message = flag
    ? (MESSAGES[field.name]?.[flag] ?? field.validationMessage)
    : customMessage(field, items);
  field.setCustomValidity(message);
  render.fieldError(field, message);
  return field.checkValidity();
};

// Every field is checked, so all errors show at once; the first one takes the focus
const validateFields = (fields: Field[], items: Dataset[]) => {
  const invalid = fields.filter((field) => !validateField(field, items));
  invalid[0]?.focus();
  return invalid.length === 0;
};

const commit = (state: CatalogueState) => {
  if (!storage.save(state.items))
    render.notice("Changes are not saved: the browser storage is full or blocked.");
  render.all(state);
};

// The add form gives strings. The fields have already been validated, so the select values are
// among the options; the guards make that a fact for the compiler as well.
const readDraft = (data: FormData): DatasetDraft | null => {
  // A form entry is a string or a File: these fields are text, so anything else counts as empty
  const text = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const modality = text("modality");
  const status = text("status");
  if (!storage.isModality(modality) || !storage.isDatasetStatus(status)) return null;

  const draft: DatasetDraft = {
    code: text("code"),
    title: text("title"),
    modality,
    status,
    quantity: Number(text("quantity")),
    price: toKopiykas(text("price")),
  };
  const description = text("text");
  if (description !== "") draft.text = description; // optional: an empty field adds no property
  return draft;
};

const bindForm = (state: CatalogueState) => {
  const form = element('form[name="dataset"]', HTMLFormElement);
  const fields = [...form.elements].filter(isField);
  const titleField = element('[name="title"]', HTMLInputElement, form);

  form.addEventListener("submit", (event: SubmitEvent) => {
    event.preventDefault(); // the page must not reload

    if (!validateFields(fields, state.items)) return;

    const draft = readDraft(new FormData(form));
    if (!draft) return;
    const item: Dataset = { id: crypto.randomUUID(), selected: false, ...draft };
    state.items = [item, ...state.items];

    commit(state);
    form.reset();
    titleField.focus();
    render.notice(`Added “${item.title}”.`);
  });

  // A field marked as invalid is rechecked while the user corrects it
  form.addEventListener("input", (event: Event) => {
    const field = event.target;
    if (isField(field) && field.hasAttribute("aria-invalid")) validateField(field, state.items);
  });

  form.addEventListener("reset", () => {
    fields.forEach((field) => {
      field.setCustomValidity("");
      render.fieldError(field, "");
    });
  });
};

const updateItem = (state: CatalogueState, id: string, changes: DatasetPatch) => {
  state.items = state.items.map((item) => (item.id === id ? { ...item, ...changes } : item));
};

const startEdit = (state: CatalogueState, id: string) => {
  state.editingId = id;
  render.all(state);
  render.focusInCard(id, ".field__control");
};

const stopEdit = (state: CatalogueState, id: string) => {
  state.editingId = null;
  render.all(state);
  render.focusInCard(id, ".card__edit");
};

const saveEdit = (state: CatalogueState, card: HTMLElement) => {
  const fields = [...card.querySelectorAll(".field__control")].filter(isField);
  const { id } = card.dataset;
  if (id === undefined || !validateFields(fields, state.items)) return;

  const value = (name: string) => fields.find((field) => field.name === name)?.value ?? "";
  const title = value("title").trim();
  const status = value("status");
  if (!storage.isDatasetStatus(status)) return;

  updateItem(state, id, {
    title,
    quantity: Number(value("quantity")),
    price: toKopiykas(value("price")),
    status,
  });
  state.editingId = null;
  commit(state);
  render.focusInCard(id, ".card__edit");
  render.notice(`Saved changes to “${title}”.`);
};

// Instead of asking "are you sure?" before a change, the change can be taken back
let undoLast: (() => void) | null = null;

const offerUndo = (state: CatalogueState, text: string, restore: () => void) => {
  undoLast = () => {
    restore();
    commit(state);
    render.notice("Restored.");
  };
  render.notice(text, true);
};

const removeItem = (state: CatalogueState, id: string) => {
  const index = state.items.findIndex((item) => item.id === id);
  const item = state.items[index];
  if (!item) return; // the card is gone already: another tab may have deleted it

  state.items = state.items.filter((other) => other.id !== id);
  if (state.editingId === id) state.editingId = null;
  commit(state);

  // Put back only this element: other cards may have changed since the delete
  offerUndo(state, `Deleted “${item.title}”.`, () => {
    state.items = [...state.items.slice(0, index), item, ...state.items.slice(index)];
  });
};

const exportSelected = (state: CatalogueState) => {
  const manifest = state.items
    .filter((item) => item.selected)
    .map(({ code, title, modality, quantity, price }) => ({
      code,
      title,
      modality,
      scans: quantity,
      pricePerScan: price / 100,
    }));

  if (manifest.length === 0) {
    render.notice("Select at least one dataset to export.");
    return;
  }

  const file = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "training-manifest.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  render.notice(`Exported ${manifest.length} datasets.`);
};

// A write to localStorage in one tab fires "storage" in the other tabs
const bindTabs = (state: CatalogueState) => {
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== null && event.key !== storage.ITEMS_KEY) return;

    state.items = event.newValue === null ? [] : storage.load().items;
    if (!state.items.some((item) => item.id === state.editingId)) state.editingId = null;
    render.all(state);
    render.notice("The catalogue was changed in another tab.");
  });
};

const bindNotice = () => {
  element("#notice-undo", HTMLButtonElement).addEventListener("click", () => {
    undoLast?.();
    undoLast = null;
  });
};

// Record over the keys of SavedView: one select for each saved setting, no more and no less
const VIEW_CONTROLS: Record<keyof SavedView, HTMLSelectElement> = {
  status: element("#filter-status", HTMLSelectElement),
  selection: element("#filter-selection", HTMLSelectElement),
  sort: element("#sort", HTMLSelectElement),
};
const searchInput = element("#search", HTMLInputElement);

// The select value is a string: the guard of its setting narrows it to the type of that setting
const VIEW_GUARDS: { [K in keyof SavedView]: (value: string) => value is SavedView[K] } = {
  status: storage.isStatusFilter,
  selection: storage.isSelection,
  sort: storage.isSortKey,
};

const showView = (state: CatalogueState) => {
  VIEW_CONTROLS.status.value = state.view.status;
  VIEW_CONTROLS.selection.value = state.view.selection;
  VIEW_CONTROLS.sort.value = state.view.sort;
};

const resetView = (state: CatalogueState) => {
  searchInput.value = "";
  state.view.query = "";
  state.view.status = "all";
  state.view.selection = "all";
  showView(state);
  storage.saveView(state.view);
  render.all(state);
};

// K is one key of SavedView, so the guard and the value belong to the same setting
const bindSetting = <K extends keyof SavedView>(state: CatalogueState, name: K) => {
  const control = VIEW_CONTROLS[name];
  const isValue = VIEW_GUARDS[name];
  control.addEventListener("change", () => {
    const { value } = control;
    if (!isValue(value)) return;
    const saved: SavedView = state.view; // the same object, seen as the saved part of the view
    saved[name] = value;
    storage.saveView(state.view);
    render.all(state);
  });
};

const bindToolbar = (state: CatalogueState) => {
  const applySearch = debounce((value: string) => {
    state.view.query = value;
    render.all(state);
  }, SEARCH_DELAY);

  // For the input event the DOM library gives Event, so the field comes from currentTarget
  searchInput.addEventListener("input", (event: Event) => {
    const field = event.currentTarget as HTMLInputElement;
    applySearch(field.value);
  });

  showView(state); // the saved values were checked by storage.loadView
  bindSetting(state, "status");
  bindSetting(state, "selection");
  bindSetting(state, "sort");

  element("#export-selected", HTMLButtonElement).addEventListener("click", () =>
    exportSelected(state),
  );

  element("#clear-storage", HTMLButtonElement).addEventListener("click", () => {
    const { items } = state;
    storage.clear();
    state.items = [];
    state.editingId = null;
    render.all(state);
    offerUndo(state, "Saved data cleared.", () => {
      state.items = items;
    });
  });
};

const bindList = (state: CatalogueState) => {
  const list = element("#dataset-list", HTMLUListElement);

  // Event delegation: this one handler serves every button of every card,
  // including the cards created after it was attached
  list.addEventListener("click", (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button) return;

    if (button.matches(".catalog__reset")) {
      resetView(state);
      return;
    }

    if (button.matches(".catalog__sample")) {
      state.items = storage.sample();
      commit(state);
      render.notice("Sample datasets loaded.");
      return;
    }

    const card = button.closest<HTMLElement>(".card");
    const id = card?.dataset.id;
    if (!card || id === undefined) return;

    if (button.matches(".card__toggle")) {
      const item = state.items.find((other) => other.id === id);
      if (!item) return;
      updateItem(state, id, { selected: !item.selected });
      commit(state);
      render.focusInCard(id, ".card__toggle");
    } else if (button.matches(".card__edit")) {
      startEdit(state, id);
    } else if (button.matches(".card__save")) {
      saveEdit(state, card);
    } else if (button.matches(".card__cancel")) {
      stopEdit(state, id);
    } else if (button.matches(".card__remove")) {
      removeItem(state, id);
    }
  });

  // Keyboard in the open card: Enter saves, Escape cancels
  list.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest<HTMLElement>(".card--editing");
    const id = card?.dataset.id;
    if (!card || id === undefined) return;

    if (event.key === "Escape") {
      stopEdit(state, id);
    } else if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      // Saving moves the focus to the Edit button: this Enter must not press it
      event.preventDefault();
      saveEdit(state, card);
    }
  });

  list.addEventListener("input", (event: Event) => {
    const field = event.target;
    if (isField(field) && field.hasAttribute("aria-invalid")) validateField(field, state.items);
  });
};

const bind = (state: CatalogueState): void => {
  bindForm(state);
  bindToolbar(state);
  bindList(state);
  bindNotice();
  bindTabs(state);
};

export { bind };
