// js/api-view.js: turns data into DOM nodes and switches the interface states.
import { createButton, createEl } from "./utils.js";

// One scan type per record, in the order of the lab 3 catalogue: records 1 to 8 get its codes
const SCAN_TYPES = [
  { key: "chest-xray", code: "CXR", label: "Chest X-ray" },
  { key: "brain-mri", code: "BMR", label: "Brain MRI" },
  { key: "ecg", code: "ECG", label: "ECG" },
  { key: "dermatoscopy", code: "DRM", label: "Dermatoscopy" },
  { key: "histology", code: "HST", label: "Histology" },
  { key: "fundus", code: "RET", label: "Retina" },
  { key: "lung-ct", code: "LCT", label: "Lung CT" },
  { key: "bone-xray", code: "BXR", label: "Bone X-ray" },
];

const scanTypeOf = (post) => SCAN_TYPES[(post.id - 1) % SCAN_TYPES.length];
const codeOf = (post) => `${scanTypeOf(post).code}-${1000 + post.id}`;
const curatorName = (post, users) => users.get(post.userId)?.name ?? `Curator ${post.userId}`;

const $ = (selector) => document.querySelector(selector);

const list = $("#publication-list");
const panels = { loading: $("#state-loading"), error: $("#state-error"), empty: $("#state-empty") };
const busyControls = [$("#refresh"), $("#show-more"), $("#filter-curator"), $("#server")];

const createImage = (post) => {
  const { key } = scanTypeOf(post);
  const image = createEl("img", "card__image");
  image.src = `img/${key}.webp`;
  image.alt = window.App.storage.MODALITIES[key];
  image.width = 640;
  image.height = 400;
  image.loading = "lazy";
  return image;
};

const createCard = (post, users) => {
  const card = createEl("li", "card");
  card.dataset.id = post.id;

  const open = createButton("action card__open", "Open");
  open.setAttribute("aria-label", `Open ${post.title}`);
  const actions = createEl("div", "card__actions card__actions--single");
  actions.append(open);

  card.append(
    createImage(post),
    createEl("span", "card__status", scanTypeOf(post).label),
    createEl("h3", "card__title", post.title),
    createEl("p", "card__code", codeOf(post)),
    createEl("p", "card__text card__clamp", post.body),
    createEl("p", "card__curator", curatorName(post, users)),
    actions,
  );
  return card;
};

export const renderPosts = (posts, users) => {
  list.replaceChildren(...posts.map((post) => createCard(post, users)));
  $("#loaded-count").textContent = posts.length;
};

export const appendPosts = (posts, users, total) => {
  list.append(...posts.map((post) => createCard(post, users)));
  $("#loaded-count").textContent = total;
};

export const focusCard = (id) => {
  list.querySelector(`[data-id="${id}"] .card__open`)?.focus();
};

// state: loading | error | empty | success. Every change of state goes through this one function.
// keepList: loading more or refreshing leaves the cards on the page, dimmed.
export const showState = (state, { keepList = false } = {}) => {
  for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== state;
  list.hidden = !(state === "success" || (state === "loading" && keepList));
  list.setAttribute("aria-busy", String(state === "loading"));
  $("#publications").dataset.state = state;

  // The search field stays on: typing during a request is what cancels that request
  busyControls.forEach((control) => { control.disabled = state === "loading"; });
};

export const setPaging = ({ hasMore, count }) => {
  $("#show-more").hidden = !hasMore;
  $("#all-loaded").hidden = hasMore || count === 0;
};

export const hidePaging = () => setPaging({ hasMore: false, count: 0 });

export const setLoadingText = (text) => { $("#loading-text").textContent = text; };

export const setError = (text, keptLabel = "") => {
  $("#error-text").textContent = text;
  $("#show-kept").textContent = keptLabel;
  $("#show-kept").hidden = keptLabel === "";
};

export const setEmpty = (query) => {
  $("#empty-title").textContent = query ? `No publications with “${query}” in the title` : "No publications found";
};

export const setSource = (text) => { $("#source").textContent = text; };

export const fillCurators = (users, selected) => {
  const select = $("#filter-curator");
  select.replaceChildren(new Option("All curators", ""), ...[...users.values()].map((user) => new Option(user.name, user.id)));
  select.value = selected;
};
