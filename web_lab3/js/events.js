// js/events.js: event handlers and form validation.
(function (App) {
  "use strict";

  const { storage, render } = App;

  const MIN_TITLE = 3;

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

  const bind = (state) => {
    bindForm(state);
  };

  App.events = { bind };
})(window.App);
