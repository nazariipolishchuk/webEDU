// js/app.ts: the application logic. Keeps the state, runs requests, decides which state to show.
import {
  type ApiError,
  explain,
  getComments,
  getCurator,
  getPosts,
  getUsers,
  isServerName,
  PAGE_SIZE,
  type Retry,
  useServer,
} from "./api.ts";
import * as view from "./api-view.ts";
import { describeAge, loadResult, saveResult } from "./cache.ts";
import { ok, type Result } from "./result.ts";
import type { CuratorName, LoadMode, Post, PublicationsState, SavedResult } from "./types.ts";
import { debounce, element, showApiAddress } from "./utils.ts";

showApiAddress();

const SEARCH_DELAY = 400;

const searchInput = element("#search", HTMLInputElement);
const curatorSelect = element("#filter-curator", HTMLSelectElement);

const state: PublicationsState = {
  posts: [],
  users: new Map(),
  query: "",
  userId: "",
  page: 0,
  hasMore: false,
  savedAt: 0,
};

// What the second button of the error state offers
interface KeptOption {
  label: string;
  action: () => void;
}

let controller: AbortController | null = null; // cancels the request in progress
let lastMode: LoadMode = "new"; // what the Retry button repeats
let detailController: AbortController | null = null; // cancels the requests of the dialog
let outdated: SavedResult | null = null; // a saved copy too old to show at start, offered if the request fails
let keptAction: (() => void) | null = null; // what the second button of the error state does

const ageOf = (savedAt: number) => describeAge(Date.now() - savedAt);

const showResult = () => {
  view.setPaging({ hasMore: state.hasMore, count: state.posts.length });
  view.showState(
    state.posts.length === 0 ? { status: "empty", query: state.query } : { status: "success" },
  );
};

const matchesTitle = (post: Post) => post.title.toLowerCase().includes(state.query.toLowerCase());

interface Matches {
  found: Post[];
  page: number; // the page the search stopped at
  hasMore: boolean;
}

// ?q= looks through all fields of a post, so the title is checked here as well.
// A page can hold no title matches while later pages do, so the search walks on until it finds some.
const fetchMatching = async (
  startPage: number,
  limit: number,
  signal: AbortSignal,
): Promise<Result<Matches, ApiError>> => {
  const onRetry = ({ attempt, retries, delay }: Retry) => {
    view.setLoadingText(`No connection. Repeat ${attempt} of ${retries} in ${delay / 1000} s…`);
  };
  const found: Post[] = [];
  for (let page = startPage; ; page++) {
    const batch = await getPosts({
      query: state.query,
      userId: state.userId,
      page,
      limit,
      signal,
      onRetry,
    });
    if (!batch.ok) return batch; // the error goes up as it is
    found.push(...batch.value.filter(matchesTitle));
    const exhausted = batch.value.length < limit; // judged by the server's answer, not by the matches
    if (exhausted || found.length > 0) return ok({ found, page, hasMore: !exhausted });
  }
};

const keepUsers = (users: CuratorName[]) => {
  state.users = new Map(users.map((user) => [user.id, user]));
  view.fillCurators(state.users, state.userId);
};

// The list from the first page, as many pages as asked for in one request.
// The curators are optional, so a failure there does not stop the list.
const replaceList = async (pages: number, signal: AbortSignal): Promise<Result<void, ApiError>> => {
  const hadUsers = state.users.size > 0;
  const [posts, users] = await Promise.all([
    fetchMatching(1, PAGE_SIZE * pages, signal),
    hadUsers ? null : getUsers(signal),
  ]);
  if (!posts.ok) return posts;
  if (users?.ok) keepUsers(users.value);

  const { found, page, hasMore } = posts.value;
  const changed = !hadUsers || JSON.stringify(found) !== JSON.stringify(state.posts);
  state.posts = found;
  state.page = page * pages;
  state.hasMore = hasMore;
  if (changed) view.renderPosts(state.posts, state.users); // the same data keeps the same nodes and focus
  return ok(undefined);
};

// Each mode only says what to request and where to put the answer.
// Record over LoadMode: a mode without its function does not compile.
const MODES: Record<LoadMode, (signal: AbortSignal) => Promise<Result<void, ApiError>>> = {
  new: (signal) => replaceList(1, signal),
  refresh: (signal) => replaceList(state.page, signal),

  // The next page goes to the end of the list
  more: async (signal) => {
    const result = await fetchMatching(state.page + 1, PAGE_SIZE, signal);
    if (!result.ok) return result;
    const { found, page, hasMore } = result.value;
    state.posts.push(...found);
    state.page = page;
    state.hasMore = hasMore;
    view.appendPosts(found, state.users, state.posts.length);
    if (found[0]) view.focusCard(found[0].id);
    return ok(undefined);
  },
};

const LOADING_TEXT: Record<LoadMode, string> = {
  new: "Loading publications…",
  refresh: "Updating publications…",
  more: "Loading more publications…",
};

const applySaved = (saved: SavedResult) => {
  state.posts = saved.posts;
  state.page = saved.page;
  state.hasMore = saved.hasMore;
  state.savedAt = saved.savedAt;
  view.renderPosts(state.posts, state.users);
};

// What can still be shown when the request has failed
const keptOption = (mode: LoadMode): KeptOption | null => {
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

async function load(mode: LoadMode): Promise<void> {
  controller?.abort(); // cancel the previous request
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
  view.showState({ status: "loading", text: LOADING_TEXT[mode], keepList: mode !== "new" });

  const result = await MODES[mode](signal);
  if (result.ok) {
    state.savedAt = Date.now();
    outdated = null;
    saveResult(state);
    view.setSource(
      `Live data from the API, loaded at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`,
    );
    showResult();
    return;
  }

  const { error } = result;
  if (error.kind === "aborted") return; // cancelled by a newer request: not a failure

  // The list on the page is still good, so a failed update does not take it away
  if (mode === "refresh" && state.posts.length > 0) {
    view.setSource(
      `Could not update. ${explain(error)} Showing the copy from ${ageOf(state.savedAt)}.`,
    );
    showResult();
    return;
  }

  const kept = keptOption(mode);
  keptAction = kept?.action ?? null;
  view.setSource("");
  view.showState({ status: "error", message: explain(error), keptLabel: kept?.label ?? "" });
  if (mode === "more") view.focusRetry();
}

const search = () => {
  const query = searchInput.value.trim();
  const userId = curatorSelect.value;
  if (query === state.query && userId === state.userId) return;
  state.query = query;
  state.userId = userId;
  void load("new"); // load handles its own failures, nothing waits for it here
};

const showCuratorPosts = (userId: number) => {
  view.closePublication();
  searchInput.value = "";
  curatorSelect.value = String(userId);
  search();
};

// The curator and the comments do not depend on each other: if one fails, the other is still shown
async function loadDetails(post: Post): Promise<void> {
  detailController?.abort();
  detailController = new AbortController();
  const { signal } = detailController;
  const retry = () => void loadDetails(post);

  view.detailsLoading();
  const [curator, comments] = await Promise.all([
    getCurator(post.userId, signal),
    getComments(post.id, signal),
  ]);
  if (signal.aborted) return; // the dialog was closed or another publication was opened

  if (curator.ok) {
    const onShowAll = state.users.has(post.userId) ? () => showCuratorPosts(post.userId) : null;
    view.renderCurator(curator.value, onShowAll);
  } else {
    view.curatorError(explain(curator.error), retry);
  }

  if (comments.ok) view.renderComments(comments.value);
  else view.commentsError(explain(comments.error), retry);
}

const applySearch = debounce(search, SEARCH_DELAY);
searchInput.addEventListener("input", () => applySearch());
curatorSelect.addEventListener("change", search);

element("#server", HTMLSelectElement).addEventListener("change", (event: Event) => {
  const select = event.currentTarget as HTMLSelectElement;
  if (!isServerName(select.value)) return;
  useServer(select.value);
  void load("new");
});

element("#controls", HTMLFormElement).addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault(); // Enter searches at once
  search();
});

element("#clear-search", HTMLButtonElement).addEventListener("click", () => {
  searchInput.value = "";
  curatorSelect.value = "";
  search();
  searchInput.focus();
});

// Event delegation as in lab 3: one handler for all the cards, present and future
element("#publication-list", HTMLUListElement).addEventListener("click", (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest(".card__open")?.closest<HTMLElement>(".card");
  if (!card) return;
  const post = state.posts.find(({ id }) => String(id) === card.dataset.id);
  if (!post) return; // the list was replaced after the card was drawn
  view.openPublication(post);
  void loadDetails(post);
});

const dialog = element("#publication", HTMLDialogElement);
element("#publication-close", HTMLButtonElement).addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event: MouseEvent) => {
  if (event.target === dialog) dialog.close(); // a click on the backdrop
});
dialog.addEventListener("close", () => detailController?.abort());

element("#show-more", HTMLButtonElement).addEventListener("click", () => void load("more"));
element("#retry", HTMLButtonElement).addEventListener("click", () => void load(lastMode));
element("#refresh", HTMLButtonElement).addEventListener(
  "click",
  () => void load(state.posts.length > 0 ? "refresh" : "new"),
);
element("#show-kept", HTMLButtonElement).addEventListener("click", () => keptAction?.());

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
  void load("refresh");
} else {
  if (saved) {
    outdated = saved;
    view.setSource(
      `The saved copy from ${ageOf(saved.savedAt)} is out of date, so the list is loaded again.`,
    );
  }
  void load("new");
}
