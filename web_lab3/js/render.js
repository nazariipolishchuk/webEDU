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
    image.alt = MODALITIES[modality].alt;
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

  const createCard = (item) => {
    const card = createEl("li", "card");
    card.dataset.id = item.id;
    card.append(
      createImage(item),
      createStatus(item),
      createEl("h3", "card__title", item.title),
      createEl("p", "card__code", item.code),
      createEl("p", "card__text", item.text),
      createLedger(item),
    );
    return card;
  };

  const list = (state) => {
    const fragment = document.createDocumentFragment();
    fragment.append(...state.items.map(createCard));
    listNode.replaceChildren(fragment);
  };

  const setStat = (name, value, note) => {
    document.querySelector(`#stat-${name}`).textContent = value;
    document.querySelector(`#stat-${name}-note`).textContent = note;
  };

  const summary = (state) => {
    const scans = state.items.reduce((sum, item) => sum + item.quantity, 0);
    setStat("total", number(state.items.length), `${number(scans)} scans in total`);
    setStat("value", money(totalValue(state.items)), "scans × price per scan, all datasets");
  };

  const all = (state) => {
    list(state);
    summary(state);
  };

  App.render = { all };
})(window.App);
