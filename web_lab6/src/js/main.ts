// js/main.js: entry point of index.html. Imports run first, so every module is ready here.
import * as events from "./events.js";
import * as render from "./render.js";
import * as storage from "./storage.js";

const LOAD_NOTICES = {
  damaged: "The saved catalogue could not be read, so the sample datasets were loaded.",
  partial: "Some saved records were damaged and have been skipped.",
};

const { items, condition } = storage.load();
const view = {
  status: "all",
  selection: "all",
  sort: "title-asc",
  ...storage.loadView(),
  query: "",
};
const state = { items, view, editingId: null };

if (condition !== "ok") storage.save(items);
events.bind(state); // first: it replaces saved view values that are no longer valid
render.all(state);
if (LOAD_NOTICES[condition]) render.notice(LOAD_NOTICES[condition]);
