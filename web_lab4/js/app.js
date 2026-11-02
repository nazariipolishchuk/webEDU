// js/app.js: the application logic. Keeps the state, runs requests, decides which state to show.
import { explain, getPosts, getUsers, PAGE_SIZE } from "./api.js";
import * as view from "./api-view.js";

const state = {
  posts: [],
  users: new Map(),
  query: "",
  userId: "",
  page: 0,
  hasMore: false,
};

const showResult = () => {
  view.setPaging({ hasMore: state.hasMore, count: state.posts.length });
  if (state.posts.length === 0) {
    view.setEmpty(state.query);
    view.showState("empty");
  } else {
    view.showState("success");
  }
};

async function load() {
  view.hidePaging();
  view.setLoadingText("Loading publications…");
  view.showState("loading");

  try {
    const [postsResult, usersResult] = await Promise.allSettled([
      getPosts({ page: 1, limit: PAGE_SIZE }),
      state.users.size > 0 ? [...state.users.values()] : getUsers(),
    ]);
    if (postsResult.status === "rejected") throw postsResult.reason;
    if (usersResult.status === "fulfilled") {
      state.users = new Map(usersResult.value.map((user) => [user.id, user]));
      view.fillCurators(state.users, state.userId);
    }
    state.posts = postsResult.value;
    state.page = 1;
    state.hasMore = postsResult.value.length === PAGE_SIZE;
    view.renderPosts(state.posts, state.users);
    showResult();
  } catch (error) {
    view.setError(explain(error));
    view.showState("error");
  }
}

document.querySelector("#controls").addEventListener("submit", (event) => event.preventDefault());
document.querySelector("#retry").addEventListener("click", () => load());
document.querySelector("#refresh").addEventListener("click", () => load());

load();
