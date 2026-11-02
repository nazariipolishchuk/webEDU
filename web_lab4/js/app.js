// js/app.js: the application logic. Keeps the state, runs requests, decides which state to show.
import { explain, getComments, getCurator, getPosts, getUsers, PAGE_SIZE, useServer } from "./api.js";
import * as view from "./api-view.js";
import { debounce } from "./utils.js";

const SEARCH_DELAY = 400;

const searchInput = document.querySelector("#search");
const curatorSelect = document.querySelector("#filter-curator");

const state = {
  posts: [],
  users: new Map(),
  query: "",
  userId: "",
  page: 0,
  hasMore: false,
};

let controller = null;   // cancels the request in progress
let lastMode = "new";    // what the Retry button repeats
let detailController = null;  // cancels the requests of the dialog

const showResult = () => {
  view.setPaging({ hasMore: state.hasMore, count: state.posts.length });
  if (state.posts.length === 0) {
    view.setEmpty(state.query);
    view.showState("empty");
  } else {
    view.showState("success");
  }
};

const matchesTitle = (post) => post.title.toLowerCase().includes(state.query.toLowerCase());

// ?q= looks through all fields of a post, so the title is checked here as well.
// A page can hold no title matches while later pages do, so the search walks on until it finds some.
const fetchMatching = async (startPage, limit, signal) => {
  const onRetry = ({ attempt, retries, delay }) => {
    view.setLoadingText(`No connection. Repeat ${attempt} of ${retries} in ${delay / 1000} s…`);
  };
  const found = [];
  for (let page = startPage; ; page++) {
    const batch = await getPosts({ query: state.query, userId: state.userId, page, limit, signal, onRetry });
    found.push(...batch.filter(matchesTitle));
    const exhausted = batch.length < limit;  // judged by the server's answer, not by the matches
    if (exhausted || found.length > 0) return { found, page, hasMore: !exhausted };
  }
};

const keepUsers = (users) => {
  state.users = new Map(users.map((user) => [user.id, user]));
  view.fillCurators(state.users, state.userId);
};

// Each mode only says what to request and where to put the answer
const MODES = {
  // A new list: the first page. The curators are optional, so a failure there does not stop the list.
  new: async (signal) => {
    const [posts, users] = await Promise.allSettled([
      fetchMatching(1, PAGE_SIZE, signal),
      state.users.size > 0 ? [...state.users.values()] : getUsers({ signal }),
    ]);
    if (posts.status === "rejected") throw posts.reason;
    if (users.status === "fulfilled") keepUsers(users.value);
    state.posts = posts.value.found;
    state.page = posts.value.page;
    state.hasMore = posts.value.hasMore;
    view.renderPosts(state.posts, state.users);
  },

  // The next page goes to the end of the list
  more: async (signal) => {
    const { found, page, hasMore } = await fetchMatching(state.page + 1, PAGE_SIZE, signal);
    state.posts.push(...found);
    state.page = page;
    state.hasMore = hasMore;
    view.appendPosts(found, state.users, state.posts.length);
    if (found.length > 0) view.focusCard(found[0].id);
  },
};

async function load(mode) {
  controller?.abort();                       // cancel the previous request
  controller = new AbortController();
  const { signal } = controller;
  lastMode = mode;

  const keepList = mode !== "new";
  if (!keepList) view.hidePaging();
  view.setLoadingText(keepList ? "Loading more publications…" : "Loading publications…");
  view.showState("loading", { keepList });

  try {
    await MODES[mode](signal);
    showResult();
  } catch (error) {
    if (error.name === "AbortError") return; // cancelled by a newer request: not a failure
    view.setError(explain(error), mode === "more" ? `Show the ${state.posts.length} loaded publications` : "");
    view.showState("error");
  }
}

const search = () => {
  const query = searchInput.value.trim();
  const userId = curatorSelect.value;
  if (query === state.query && userId === state.userId) return;
  state.query = query;
  state.userId = userId;
  load("new");
};

const showCuratorPosts = (userId) => {
  view.closePublication();
  searchInput.value = "";
  curatorSelect.value = userId;
  search();
};

// The curator and the comments do not depend on each other: if one fails, the other is still shown
async function loadDetails(post) {
  detailController?.abort();
  detailController = new AbortController();
  const { signal } = detailController;
  const retry = () => loadDetails(post);

  view.detailsLoading();
  const [curator, comments] = await Promise.allSettled([
    getCurator(post.userId, { signal }),
    getComments(post.id, { signal }),
  ]);
  if (signal.aborted) return;                // the dialog was closed or another publication was opened

  if (curator.status === "fulfilled") {
    const onShowAll = state.users.has(post.userId) ? () => showCuratorPosts(post.userId) : null;
    view.renderCurator(curator.value, onShowAll);
  } else {
    view.curatorError(explain(curator.reason), retry);
  }

  if (comments.status === "fulfilled") view.renderComments(comments.value);
  else view.commentsError(explain(comments.reason), retry);
}

const applySearch = debounce(search, SEARCH_DELAY);
searchInput.addEventListener("input", applySearch);
curatorSelect.addEventListener("change", search);

document.querySelector("#server").addEventListener("change", (event) => {
  useServer(event.target.value);
  load("new");
});

document.querySelector("#controls").addEventListener("submit", (event) => {
  event.preventDefault();  // Enter searches at once
  search();
});

document.querySelector("#clear-search").addEventListener("click", () => {
  searchInput.value = "";
  curatorSelect.value = "";
  search();
  searchInput.focus();
});

// Event delegation as in lab 3: one handler for all the cards, present and future
document.querySelector("#publication-list").addEventListener("click", (event) => {
  const card = event.target.closest(".card__open")?.closest(".card");
  if (!card) return;
  const post = state.posts.find(({ id }) => String(id) === card.dataset.id);
  view.openPublication(post);
  loadDetails(post);
});

const dialog = document.querySelector("#publication");
document.querySelector("#publication-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();  // a click on the backdrop
});
dialog.addEventListener("close", () => detailController?.abort());

document.querySelector("#show-more").addEventListener("click", () => load("more"));
document.querySelector("#retry").addEventListener("click", () => load(lastMode));
document.querySelector("#refresh").addEventListener("click", () => load("new"));

// What Retry cannot bring back yet is still in memory: the list loaded before the failure
document.querySelector("#show-kept").addEventListener("click", showResult);

load("new");
