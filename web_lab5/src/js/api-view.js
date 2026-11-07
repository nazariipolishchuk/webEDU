// js/api-view.js: turns data into DOM nodes and switches the interface states.
import { scanImage } from "@/js/images.js";
import { MODALITIES } from "./storage.js";
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
const showMore = $("#show-more");
const busyControls = [$("#refresh"), showMore, $("#filter-curator"), $("#server")];
let focusBack = null; // a control that lost the keyboard focus by being switched off

const createImage = (post) => {
  const { key } = scanTypeOf(post);
  const image = createEl("img", "card__image");
  image.src = scanImage(key);
  image.alt = MODALITIES[key];
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
  const busy = state === "loading";
  if (
    busy &&
    busyControls.includes(document.activeElement) &&
    document.activeElement !== showMore
  ) {
    focusBack = document.activeElement;
  }
  busyControls.forEach((control) => {
    control.disabled = busy;
  });
  if (!busy) {
    focusBack?.focus();
    focusBack = null;
  }
};

export const setPaging = ({ hasMore, count }) => {
  showMore.hidden = !hasMore;
  $("#all-loaded").hidden = hasMore || count === 0;
};

export const hidePaging = () => setPaging({ hasMore: false, count: 0 });

export const setLoadingText = (text) => {
  $("#loading-text").textContent = text;
};

export const setError = (text, keptLabel = "") => {
  $("#error-text").textContent = text;
  $("#show-kept").textContent = keptLabel;
  $("#show-kept").hidden = keptLabel === "";
};

export const focusRetry = () => $("#retry").focus();

export const setEmpty = (query) => {
  $("#empty-title").textContent = query
    ? `No publications with “${query}” in the title`
    : "No publications found";
};

export const setSource = (text) => {
  $("#source").textContent = text;
};

export const fillCurators = (users, selected) => {
  const select = $("#filter-curator");
  select.replaceChildren(
    new Option("All curators", ""),
    ...[...users.values()].map((user) => new Option(user.name, user.id)),
  );
  select.value = selected;
};

// ---------- The publication dialog ----------

const dialog = $("#publication");
const curatorBox = $("#curator-box");
const commentsBox = $("#comments-box");

const boxLoading = (box, text) => {
  box.replaceChildren(createEl("p", "box__message", text));
};

const boxError = (box, text, onRetry) => {
  const retry = createButton("action", "Retry");
  retry.addEventListener("click", onRetry);
  box.replaceChildren(createEl("p", "box__message box__message--error", text), retry);
};

const createFact = (name, value) => {
  const row = createEl("div", "facts__row");
  row.append(createEl("dt", "facts__name", name), createEl("dd", "facts__value", value));
  return row;
};

export const openPublication = (post) => {
  $("#publication-type").textContent = scanTypeOf(post).label;
  $("#publication-title").textContent = post.title;
  $("#publication-code").textContent = codeOf(post);
  $("#publication-body").textContent = post.body;
  dialog.showModal();
};

export const closePublication = () => dialog.close();

export const detailsLoading = () => {
  boxLoading(curatorBox, "Loading the curator…");
  boxLoading(commentsBox, "Loading comments…");
};

export const renderCurator = ({ user, posts, albums }, onShowAll) => {
  const facts = createEl("dl", "facts");
  facts.append(
    createFact("Username", user.username),
    createFact("Email", user.email),
    createFact("City", user.address.city),
    createFact("Company", user.company.name),
    createFact("Website", user.website),
    createFact("Publications", String(posts.length)),
    createFact("Albums", String(albums.length)),
  );

  const nodes = [createEl("p", "curator__name", user.name), facts];
  if (onShowAll) {
    const showAll = createButton("action", "Show this curator's publications");
    showAll.addEventListener("click", onShowAll);
    nodes.push(showAll);
  }
  curatorBox.replaceChildren(...nodes);
};

export const renderComments = (comments) => {
  if (comments.length === 0) {
    boxLoading(commentsBox, "No comments on this publication yet.");
    return;
  }
  const items = createEl("ul", "comments");
  items.append(
    ...comments.map((comment) => {
      const item = createEl("li", "comment");
      item.append(
        createEl("p", "comment__title", comment.name),
        createEl("p", "comment__author", comment.email),
        createEl("p", "comment__text", comment.body),
      );
      return item;
    }),
  );
  commentsBox.replaceChildren(items);
};

export const curatorError = (text, onRetry) => boxError(curatorBox, text, onRetry);
export const commentsError = (text, onRetry) => boxError(commentsBox, text, onRetry);
