// js/app.js: the application logic. Keeps the state, runs requests, decides which state to show.
import { explain, getPosts, getUsers, PAGE_SIZE } from "./api.js";
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
  const found = [];
  for (let page = startPage; ; page++) {
    const batch = await getPosts({ query: state.query, userId: state.userId, page, limit, signal });
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
};

async function load(mode) {
  controller?.abort();                       // cancel the previous request
  controller = new AbortController();
  const { signal } = controller;
  lastMode = mode;

  view.hidePaging();
  view.setLoadingText("Loading publications…");
  view.showState("loading");

  try {
    await MODES[mode](signal);
    showResult();
  } catch (error) {
    if (error.name === "AbortError") return; // cancelled by a newer request: not a failure
    view.setError(explain(error));
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

const applySearch = debounce(search, SEARCH_DELAY);
searchInput.addEventListener("input", applySearch);
curatorSelect.addEventListener("change", search);

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

document.querySelector("#retry").addEventListener("click", () => load(lastMode));
document.querySelector("#refresh").addEventListener("click", () => load("new"));

load("new");
