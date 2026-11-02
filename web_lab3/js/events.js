// js/events.js: event handlers and form validation.
(function (App) {
  "use strict";

  const { storage, render } = App;

  const MIN_TITLE = 3;
  const SEARCH_DELAY = 300;

  // Runs fn only after the calls stop for delay ms
  const debounce = (fn, delay) => {
    let timerId;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => fn(...args), delay);
    };
  };

  const MESSAGES = {
    title: {
      valueMissing: "Enter the dataset name.",
      tooShort: `Use at least ${MIN_TITLE} characters.`,
    },
    code: {
      valueMissing: "Enter the dataset code.",
      patternMismatch: "Use 2 to 4 capital letters, a hyphen and 3 to 5 digits, for example CXR-1001.",
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

  const FLAGS = ["valueMissing", "badInput", "patternMismatch", "tooShort", "stepMismatch", "rangeUnderflow", "rangeOverflow"];

  const toKopiykas = (value) => Math.round(Number(value) * 100);

  // Rules the browser cannot express with attributes
  const customMessage = (field, items) => {
    if (field.name === "title" && field.value.trim().length < MIN_TITLE) return MESSAGES.title.tooShort;
    if (field.name === "code" && items.some((item) => item.code === field.value)) {
      return `Code ${field.value} is already in the catalogue.`;
    }
    return "";
  };

  const validateField = (field, items) => {
    field.setCustomValidity(""); // otherwise the previous custom error keeps the field invalid
    const flag = FLAGS.find((name) => field.validity[name]);
    const message = flag ? (MESSAGES[field.name]?.[flag] ?? field.validationMessage) : customMessage(field, items);
    field.setCustomValidity(message);
    render.fieldError(field, message);
    return field.checkValidity();
  };

  // Every field is checked, so all errors show at once; the first one takes the focus
  const validateFields = (fields, items) => {
    const invalid = fields.filter((field) => !validateField(field, items));
    invalid[0]?.focus();
    return invalid.length === 0;
  };

  const commit = (state) => {
    if (!storage.save(state.items)) render.notice("Changes are not saved: the browser storage is full or blocked.");
    render.all(state);
  };

  const bindForm = (state) => {
    const form = document.forms.dataset;
    const fields = [...form.elements].filter((element) => element.matches("input, select, textarea"));

    form.addEventListener("submit", (event) => {
      event.preventDefault(); // the page must not reload

      form.elements.code.value = form.elements.code.value.trim().toUpperCase();
      if (!validateFields(fields, state.items)) return;

      const data = new FormData(form);
      const title = String(data.get("title")).trim();
      state.items = [{
        id: crypto.randomUUID(),
        code: String(data.get("code")),
        title,
        modality: String(data.get("modality")),
        status: String(data.get("status")),
        quantity: Number(data.get("quantity")),
        price: toKopiykas(data.get("price")),
        selected: false,
        text: String(data.get("text")).trim(),
      }, ...state.items];

      commit(state);
      form.reset();
      form.elements.title.focus();
      render.notice(`Added “${title}”.`);
    });

    // A field marked as invalid is rechecked while the user corrects it
    form.addEventListener("input", (event) => {
      if (event.target.hasAttribute("aria-invalid")) validateField(event.target, state.items);
    });

    form.addEventListener("reset", () => {
      fields.forEach((field) => {
        field.setCustomValidity("");
        render.fieldError(field, "");
      });
    });
  };

  const updateItem = (state, id, changes) => {
    state.items = state.items.map((item) => (item.id === id ? { ...item, ...changes } : item));
  };

  const startEdit = (state, id) => {
    state.editingId = id;
    render.all(state);
    render.focusInCard(id, ".field__control");
  };

  const stopEdit = (state, id) => {
    state.editingId = null;
    render.all(state);
    render.focusInCard(id, ".card__edit");
  };

  const saveEdit = (state, card) => {
    const fields = [...card.querySelectorAll(".field__control")];
    if (!validateFields(fields, state.items)) return;

    const value = (name) => fields.find((field) => field.name === name).value;
    const { id } = card.dataset;
    const title = value("title").trim();

    updateItem(state, id, {
      title,
      quantity: Number(value("quantity")),
      price: toKopiykas(value("price")),
      status: value("status"),
    });
    state.editingId = null;
    commit(state);
    render.focusInCard(id, ".card__edit");
    render.notice(`Saved changes to “${title}”.`);
  };

  const removeItem = (state, id) => {
    const item = state.items.find((other) => other.id === id);
    state.items = state.items.filter((other) => other.id !== id);
    if (state.editingId === id) state.editingId = null;
    commit(state);
    render.notice(`Deleted “${item.title}”.`);
  };

  const VIEW_CONTROLS = {
    status: document.querySelector("#filter-status"),
    selection: document.querySelector("#filter-selection"),
    sort: document.querySelector("#sort"),
  };
  const searchInput = document.querySelector("#search");

  const resetView = (state) => {
    searchInput.value = "";
    state.view.query = "";
    state.view.status = "all";
    state.view.selection = "all";
    Object.entries(VIEW_CONTROLS).forEach(([name, control]) => { control.value = state.view[name]; });
    render.all(state);
  };

  const bindToolbar = (state) => {
    const applySearch = debounce((value) => {
      state.view.query = value;
      render.all(state);
    }, SEARCH_DELAY);

    searchInput.addEventListener("input", (event) => applySearch(event.target.value));

    Object.entries(VIEW_CONTROLS).forEach(([name, control]) => {
      control.addEventListener("change", () => {
        state.view[name] = control.value;
        render.all(state);
      });
    });
  };

  const bindList = (state) => {
    const list = document.querySelector("#dataset-list");

    // Event delegation: this one handler serves every button of every card,
    // including the cards created after it was attached
    list.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      if (button.matches(".catalog__reset")) {
        resetView(state);
        return;
      }

      const card = button.closest(".card");
      if (!card) return;
      const { id } = card.dataset;

      if (button.matches(".card__toggle")) {
        const item = state.items.find((other) => other.id === id);
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
    list.addEventListener("keydown", (event) => {
      const card = event.target.closest(".card--editing");
      if (!card) return;

      if (event.key === "Escape") {
        stopEdit(state, card.dataset.id);
      } else if (event.key === "Enter" && event.target.matches("input")) {
        saveEdit(state, card);
      }
    });

    list.addEventListener("input", (event) => {
      if (event.target.hasAttribute("aria-invalid")) validateField(event.target, state.items);
    });
  };

  const bind = (state) => {
    bindForm(state);
    bindToolbar(state);
    bindList(state);
  };

  App.events = { bind };
})(window.App);
