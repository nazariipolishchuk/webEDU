// js/main.ts: entry point of index.html. Imports run first, so every module is ready here.
import * as events from "./events.ts";
import * as render from "./render.ts";
import * as storage from "./storage.ts";
import type { CatalogueState, LoadCondition } from "./types.ts";

// Partial: the conditions ok and empty need no notice
const LOAD_NOTICES: Partial<Record<LoadCondition, string>> = {
  damaged: "The saved catalogue could not be read, so the sample datasets were loaded.",
  partial: "Some saved records were damaged and have been skipped.",
};

const { items, condition } = storage.load();
const state: CatalogueState = {
  items,
  view: {
    status: "all",
    selection: "all",
    sort: "title-asc",
    ...storage.loadView(), // only the saved values that are still valid
    query: "",
  },
  editingId: null,
};

if (condition !== "ok") storage.save(items);
events.bind(state);
render.all(state);
const loadNotice = LOAD_NOTICES[condition];
if (loadNotice) render.notice(loadNotice);
