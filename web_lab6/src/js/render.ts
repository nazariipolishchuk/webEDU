// js/render.ts: turns the state into DOM nodes. User data only ever goes through textContent.
import { scanImage } from "@/js/images.ts";
import { MODALITIES, STATUSES } from "./storage.ts";
import type { CatalogueState, Dataset, SelectionFilter, SortKey, StatusFilter } from "./types.ts";
import { createButton, createEl, element } from "./utils.ts";

// A form field of the catalogue: the add form and the edit card use these three
export type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const moneyFormat = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "UAH",
  currencyDisplay: "narrowSymbol",
});
const numberFormat = new Intl.NumberFormat("en-GB");

const money = (kopiykas: number) => moneyFormat.format(kopiykas / 100);
const number = (value: number) => numberFormat.format(value);
const valueOf = (item: Dataset) => item.quantity * item.price;
const totalValue = (items: Dataset[]) => items.reduce((sum, item) => sum + valueOf(item), 0);

const NOTICE_TIME = 8000;
const listNode = element("#dataset-list", HTMLUListElement);

const createImage = ({ modality }: Dataset) => {
  const image = createEl("img", "card__image");
  image.src = scanImage(modality);
  image.alt = MODALITIES[modality];
  image.width = 640;
  image.height = 400;
  image.loading = "lazy";
  return image;
};

const createStatus = ({ status }: Dataset) =>
  createEl("span", `card__status card__status--${status}`, STATUSES[status]);

const createLedger = (item: Dataset) => {
  const ledger = createEl("p", "card__ledger");
  const sum = `${number(item.quantity)} scans × ${money(item.price)}`;
  ledger.append(
    createEl("span", "card__sum", sum),
    createEl("strong", "card__value", money(valueOf(item))),
  );
  return ledger;
};

const createActions = (item: Dataset) => {
  const actions = createEl("div", "card__actions");

  const toggle = createButton(
    `action card__toggle${item.selected ? " card__toggle--on" : ""}`,
    "Selected for training",
  );
  toggle.setAttribute("aria-pressed", String(item.selected));
  toggle.setAttribute("aria-label", `Selected for training: ${item.title}`);

  const edit = createButton("action card__edit", "Edit");
  edit.setAttribute("aria-label", `Edit ${item.title}`);

  const remove = createButton("action card__remove", "Delete");
  remove.setAttribute("aria-label", `Delete ${item.title}`);

  actions.append(toggle, edit, remove);
  return actions;
};

const createField = (item: Dataset, name: string, labelText: string, control: Field) => {
  const field = createEl("div", "field");
  const label = createEl("label", "field__label", labelText);
  const error = createEl("p", "field__error");

  control.classList.add("field__control");
  control.name = name;
  control.id = `edit-${item.id}-${name}`;
  label.htmlFor = control.id;
  error.id = `${control.id}-error`;
  control.setAttribute("aria-describedby", error.id);

  field.append(label, control, error);
  return field;
};

// Only these properties of an input are set here: a misspelled name does not compile
type InputProps = Partial<
  Pick<HTMLInputElement, "type" | "value" | "min" | "max" | "step" | "minLength" | "maxLength">
>;

const createInput = (properties: InputProps) =>
  Object.assign(document.createElement("input"), { required: true }, properties);

const createStatusSelect = (item: Dataset) => {
  const select = document.createElement("select");
  select.append(...Object.entries(STATUSES).map(([value, text]) => new Option(text, value)));
  select.value = item.status;
  return select;
};

// In-place editing: the card itself turns into input fields
const createEditCard = (item: Dataset) => {
  const card = createEl("li", "card card--editing");
  card.dataset.id = item.id;

  const fields = createEl("div", "card__fields");
  fields.append(
    createField(
      item,
      "title",
      "Name",
      createInput({ type: "text", value: item.title, minLength: 3, maxLength: 60 }),
    ),
    createField(
      item,
      "quantity",
      "Scans",
      createInput({
        type: "number",
        value: String(item.quantity),
        min: "1",
        max: "10000000",
        step: "1",
      }),
    ),
    createField(
      item,
      "price",
      "Price per scan, ₴",
      createInput({
        type: "number",
        value: (item.price / 100).toFixed(2),
        min: "0",
        max: "100000",
        step: "0.01",
      }),
    ),
    createField(item, "status", "Status", createStatusSelect(item)),
  );

  const actions = createEl("div", "card__actions");
  actions.append(
    createButton("action action--primary card__save", "Save changes"),
    createButton("action card__cancel", "Cancel"),
  );

  card.append(createImage(item), createEl("p", "card__code", item.code), fields, actions);
  return card;
};

const createCard = (item: Dataset) => {
  const card = createEl("li", `card${item.selected ? " card--selected" : ""}`);
  card.dataset.id = item.id;
  card.append(
    createImage(item),
    createStatus(item),
    createEl("h3", "card__title", item.title),
    createEl("p", "card__code", item.code),
    createEl("p", "card__text", item.text ?? ""),
    createLedger(item),
    createActions(item),
  );
  return card;
};

type Compare = (a: Dataset, b: Dataset) => number;

// Record over SortKey: a sort option without a comparison does not compile
const COMPARE: Record<SortKey, Compare> = {
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "title-desc": (a, b) => b.title.localeCompare(a.title),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  "quantity-desc": (a, b) => b.quantity - a.quantity,
  "value-desc": (a, b) => valueOf(b) - valueOf(a),
};

const SELECTION: Record<SelectionFilter, (item: Dataset) => boolean> = {
  all: () => true,
  selected: (item) => item.selected,
  "not-selected": (item) => !item.selected,
};

const matchesStatus = (item: Dataset, status: StatusFilter) =>
  status === "all" || item.status === status;

const visibleItems = ({ items, view }: Pick<CatalogueState, "items" | "view">) => {
  const query = view.query.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query) &&
      matchesStatus(item, view.status) &&
      SELECTION[view.selection](item),
  );
  return [...filtered].sort(COMPARE[view.sort]); // a copy: state.items keeps its order
};

const createEmpty = (state: CatalogueState) => {
  const empty = createEl("li", "catalog__empty");
  if (state.items.length === 0) {
    empty.append(
      createEl(
        "p",
        "catalog__message",
        "The catalogue is empty. Add a dataset with the form above, or load the samples.",
      ),
      createButton("action catalog__sample", "Load sample datasets"),
    );
    return empty;
  }
  empty.append(
    createEl("p", "catalog__message", "No datasets match the search and filters."),
    createButton("action catalog__reset", "Show all datasets"),
  );
  return empty;
};

const list = (state: CatalogueState) => {
  // The card being edited is reused, so typed values survive a redraw of the list
  const open = listNode.querySelector<HTMLLIElement>(".card--editing");
  const build = (item: Dataset) => {
    if (item.id !== state.editingId) return createCard(item);
    return open?.dataset.id === item.id ? open : createEditCard(item);
  };

  const fragment = document.createDocumentFragment();
  const items = visibleItems(state);
  fragment.append(...(items.length > 0 ? items.map(build) : [createEmpty(state)]));
  listNode.replaceChildren(fragment);
};

// A redraw replaces the buttons, so the keyboard focus is put back by hand
const focusInCard = (id: string, selector: string): void => {
  const card = [...listNode.children].find(
    (node) => node instanceof HTMLElement && node.dataset.id === id,
  );
  card?.querySelector<HTMLElement>(selector)?.focus();
};

const setStat = (name: string, value: string, note: string) => {
  element(`#stat-${name}`, HTMLElement).textContent = value;
  element(`#stat-${name}-note`, HTMLElement).textContent = note;
};

const summary = (state: CatalogueState) => {
  const scans = state.items.reduce((sum, item) => sum + item.quantity, 0);
  setStat("total", number(state.items.length), `${number(scans)} scans in total`);
  setStat("value", money(totalValue(state.items)), "scans × price per scan, all datasets");

  const selected = state.items.filter((item) => item.selected);
  setStat("selected", number(selected.length), `worth ${money(totalValue(selected))}`);

  const shown = visibleItems(state);
  setStat("shown", number(shown.length), `worth ${money(totalValue(shown))}`);
};

const all = (state: CatalogueState): void => {
  list(state);
  summary(state);
};

const fieldError = (field: Field, message: string): void => {
  const error = field.closest(".field")?.querySelector(".field__error");
  if (error) error.textContent = message;
  if (message) field.setAttribute("aria-invalid", "true");
  else field.removeAttribute("aria-invalid");
};

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

const noticeBox = element("#notice", HTMLElement);
const noticeText = element("#notice-text", HTMLElement);
const noticeUndo = element("#notice-undo", HTMLButtonElement);

const notice = (text: string, canUndo = false): void => {
  noticeText.textContent = text;
  noticeUndo.hidden = !canUndo;
  noticeBox.classList.add("notice--visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    noticeBox.classList.remove("notice--visible");
    noticeUndo.hidden = true;
  }, NOTICE_TIME);
};

export { all, fieldError, focusInCard, notice };
