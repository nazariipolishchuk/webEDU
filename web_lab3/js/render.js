// js/render.js: turns the state into DOM nodes. User data only ever goes through textContent.
(function (App) {
  "use strict";

  const { MODALITIES, STATUSES } = App.storage;

  const moneyFormat = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "UAH",
    currencyDisplay: "narrowSymbol",
  });
  const numberFormat = new Intl.NumberFormat("en-GB");

  const money = (kopiykas) => moneyFormat.format(kopiykas / 100);
  const number = (value) => numberFormat.format(value);
  const valueOf = (item) => item.quantity * item.price;
  const totalValue = (items) => items.reduce((sum, item) => sum + valueOf(item), 0);

  const NOTICE_TIME = 8000;
  const listNode = document.querySelector("#dataset-list");

  const createEl = (tag, className, text = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };

  const createButton = (className, text) => {
    const button = createEl("button", className, text);
    button.type = "button";
    return button;
  };

  const createImage = ({ modality }) => {
    const image = createEl("img", "card__image");
    image.src = `img/${modality}.webp`;
    image.alt = MODALITIES[modality];
    image.width = 640;
    image.height = 400;
    image.loading = "lazy";
    return image;
  };

  const createStatus = ({ status }) =>
    createEl("span", `card__status card__status--${status}`, STATUSES[status]);

  const createLedger = (item) => {
    const ledger = createEl("p", "card__ledger");
    const sum = `${number(item.quantity)} scans × ${money(item.price)}`;
    ledger.append(createEl("span", "card__sum", sum), createEl("strong", "card__value", money(valueOf(item))));
    return ledger;
  };

  const createActions = (item) => {
    const actions = createEl("div", "card__actions");

    const toggle = createButton(`action card__toggle${item.selected ? " card__toggle--on" : ""}`, "Selected for training");
    toggle.setAttribute("aria-pressed", String(item.selected));
    toggle.setAttribute("aria-label", `Selected for training: ${item.title}`);

    const edit = createButton("action card__edit", "Edit");
    edit.setAttribute("aria-label", `Edit ${item.title}`);

    const remove = createButton("action card__remove", "Delete");
    remove.setAttribute("aria-label", `Delete ${item.title}`);

    actions.append(toggle, edit, remove);
    return actions;
  };

  const createField = (item, name, labelText, control) => {
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

  const createInput = (properties) => Object.assign(document.createElement("input"), { required: true }, properties);

  const createStatusSelect = (item) => {
    const select = document.createElement("select");
    select.append(...Object.entries(STATUSES).map(([value, text]) => new Option(text, value)));
    select.value = item.status;
    return select;
  };

  // In-place editing: the card itself turns into input fields
  const createEditCard = (item) => {
    const card = createEl("li", "card card--editing");
    card.dataset.id = item.id;

    const fields = createEl("div", "card__fields");
    fields.append(
      createField(item, "title", "Name", createInput({ type: "text", value: item.title, minLength: 3, maxLength: 60 })),
      createField(item, "quantity", "Scans", createInput({ type: "number", value: String(item.quantity), min: "1", max: "10000000", step: "1" })),
      createField(item, "price", "Price per scan, ₴", createInput({ type: "number", value: (item.price / 100).toFixed(2), min: "0", max: "100000", step: "0.01" })),
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

  const createCard = (item) => {
    const card = createEl("li", `card${item.selected ? " card--selected" : ""}`);
    card.dataset.id = item.id;
    card.append(
      createImage(item),
      createStatus(item),
      createEl("h3", "card__title", item.title),
      createEl("p", "card__code", item.code),
      createEl("p", "card__text", item.text),
      createLedger(item),
      createActions(item),
    );
    return card;
  };

  const COMPARE = {
    "title-asc": (a, b) => a.title.localeCompare(b.title),
    "title-desc": (a, b) => b.title.localeCompare(a.title),
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    "quantity-desc": (a, b) => b.quantity - a.quantity,
    "value-desc": (a, b) => valueOf(b) - valueOf(a),
  };

  const SELECTION = {
    all: () => true,
    selected: (item) => item.selected,
    "not-selected": (item) => !item.selected,
  };

  const visibleItems = ({ items, view }) => {
    const query = view.query.trim().toLowerCase();
    const filtered = items.filter((item) =>
      item.title.toLowerCase().includes(query)
      && (view.status === "all" || item.status === view.status)
      && SELECTION[view.selection](item));
    return [...filtered].sort(COMPARE[view.sort]); // a copy: state.items keeps its order
  };

  const createEmpty = (state) => {
    const empty = createEl("li", "catalog__empty");
    if (state.items.length === 0) {
      empty.append(
        createEl("p", "catalog__message", "The catalogue is empty. Add a dataset with the form above, or load the samples."),
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

  const list = (state) => {
    // The card being edited is reused, so typed values survive a redraw of the list
    const open = listNode.querySelector(".card--editing");
    const build = (item) => {
      if (item.id !== state.editingId) return createCard(item);
      return open?.dataset.id === item.id ? open : createEditCard(item);
    };

    const fragment = document.createDocumentFragment();
    const items = visibleItems(state);
    fragment.append(...(items.length > 0 ? items.map(build) : [createEmpty(state)]));
    listNode.replaceChildren(fragment);
  };

  // A redraw replaces the buttons, so the keyboard focus is put back by hand
  const focusInCard = (id, selector) => {
    const card = [...listNode.children].find((node) => node.dataset.id === id);
    card?.querySelector(selector)?.focus();
  };

  const setStat = (name, value, note) => {
    document.querySelector(`#stat-${name}`).textContent = value;
    document.querySelector(`#stat-${name}-note`).textContent = note;
  };

  const summary = (state) => {
    const scans = state.items.reduce((sum, item) => sum + item.quantity, 0);
    setStat("total", number(state.items.length), `${number(scans)} scans in total`);
    setStat("value", money(totalValue(state.items)), "scans × price per scan, all datasets");

    const selected = state.items.filter((item) => item.selected);
    setStat("selected", number(selected.length), `worth ${money(totalValue(selected))}`);

    const shown = visibleItems(state);
    setStat("shown", number(shown.length), `worth ${money(totalValue(shown))}`);
  };

  const all = (state) => {
    list(state);
    summary(state);
  };

  const fieldError = (field, message) => {
    field.closest(".field").querySelector(".field__error").textContent = message;
    if (message) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  };

  let noticeTimer;

  const notice = (text, canUndo = false) => {
    const box = document.querySelector("#notice");
    document.querySelector("#notice-text").textContent = text;
    document.querySelector("#notice-undo").hidden = !canUndo;
    box.classList.add("notice--visible");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      box.classList.remove("notice--visible");
      document.querySelector("#notice-undo").hidden = true;
    }, NOTICE_TIME);
  };

  App.render = { all, fieldError, focusInCard, notice };
})(window.App);
