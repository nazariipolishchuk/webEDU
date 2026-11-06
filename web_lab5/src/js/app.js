// js/app.js: the application logic. Keeps the state, runs requests, decides which state to show.
import { explain, getComments, getCurator, getPosts, getUsers, PAGE_SIZE, useServer } from "./api.js";
import * as view from "./api-view.js";
import { describeAge, loadResult, saveResult } from "./cache.js";
import { debounce, showApiAddress } from "./utils.js";

showApiAddress();

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
  savedAt: 0,
};

let controller = null;        // cancels the request in progress
let lastMode = "new";         // what the Retry button repeats
let detailController = null;  // cancels the requests of the dialog
let outdated = null;          // a saved copy too old to show at start, offered if the request fails
let keptAction = null;        // what the second button of the error state does

const ageOf = (savedAt) => describeAge(Date.now() - savedAt);

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

// The list from the first page, as many pages as asked for in one request.
// The curators are optional, so a failure there does not stop the list.
const replaceList = async (pages, signal) => {
  const hadUsers = state.users.size > 0;
  const [posts, users] = await Promise.allSettled([
    fetchMatching(1, PAGE_SIZE * pages, signal),
    hadUsers ? null : getUsers({ signal }),
  ]);
  if (posts.status === "rejected") throw posts.reason;
  if (!hadUsers && users.status === "fulfilled") keepUsers(users.value);

  const { found, page, hasMore } = posts.value;
  const changed = !hadUsers || JSON.stringify(found) !== JSON.stringify(state.posts);
  state.posts = found;
  state.page = page * pages;
  state.hasMore = hasMore;
  if (changed) view.renderPosts(state.posts, state.users); // the same data keeps the same nodes and focus
};

// Each mode only says what to request and where to put the answer
const MODES = {
  new: (signal) => replaceList(1, signal),
  refresh: (signal) => replaceList(state.page, signal),

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

const LOADING_TEXT = {
  new: "Loading publications…",
  refresh: "Updating publications…",
  more: "Loading more publications…",
};

const applySaved = (saved) => {
  state.posts = saved.posts;
  state.page = saved.page;
  state.hasMore = saved.hasMore;
  state.savedAt = saved.savedAt;
  view.renderPosts(state.posts, state.users);
};

// What can still be shown when the request has failed
const keptOption = (mode) => {
  if (mode === "more") {
    return { label: `Show the ${state.posts.length} loaded publications`, action: showResult };
  }
  if (outdated && outdated.query === state.query && outdated.userId === state.userId) {
    const saved = outdated;
    return {
      label: `Show the saved copy from ${ageOf(saved.savedAt)}`,
      action: () => {
        applySaved(saved);
        view.setSource(`Saved copy from ${ageOf(saved.savedAt)}. It is out of date.`);
        showResult();
      },
    };
  }
  return null;
};

async function load(mode) {
  controller?.abort();                       // cancel the previous request
  controller = new AbortController();
  const { signal } = controller;
  lastMode = mode;

  if (mode === "new") {
    state.posts = [];
    state.page = 0;
    state.hasMore = false;
    view.renderPosts(state.posts, state.users);
    view.hidePaging();
  }
  view.setLoadingText(LOADING_TEXT[mode]);
  view.showState("loading", { keepList: mode !== "new" });

  try {
    await MODES[mode](signal);
    state.savedAt = Date.now();
    outdated = null;
    saveResult(state);
    view.setSource(`Live data from the API, loaded at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`);
    showResult();
  } catch (error) {
    if (error.name === "AbortError") return; // cancelled by a newer request: not a failure

    // The list on the page is still good, so a failed update does not take it away
    if (mode === "refresh" && state.posts.length > 0) {
      view.setSource(`Could not update. ${explain(error)} Showing the copy from ${ageOf(state.savedAt)}.`);
      showResult();
      return;
    }

    const kept = keptOption(mode);
    keptAction = kept?.action;
    view.setSource("");
    view.setError(explain(error), kept?.label);
    view.showState("error");
    if (mode === "more") view.focusRetry();
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
document.querySelector("#refresh").addEventListener("click", () => load(state.posts.length > 0 ? "refresh" : "new"));
document.querySelector("#show-kept").addEventListener("click", () => keptAction?.());

// Start: a fresh copy is shown at once and updated, an old one only stays in reserve
const saved = loadResult();
if (saved) {
  state.query = saved.query;
  state.userId = saved.userId;
  searchInput.value = saved.query;
  if (saved.users.length > 0) keepUsers(saved.users);
}

if (saved?.fresh) {
  applySaved(saved);
  view.setSource(`Saved copy from ${ageOf(saved.savedAt)}. Updating…`);
  showResult();
  load("refresh");
} else {
  if (saved) {
    outdated = saved;
    view.setSource(`The saved copy from ${ageOf(saved.savedAt)} is out of date, so the list is loaded again.`);
  }
  load("new");
}
