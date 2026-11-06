// js/main.js: entry point, connected last, when every part of App already exists.
(function (App) {
  "use strict";

  const LOAD_NOTICES = {
    damaged: "The saved catalogue could not be read, so the sample datasets were loaded.",
    partial: "Some saved records were damaged and have been skipped.",
  };

  const { items, condition } = App.storage.load();
  const view = { status: "all", selection: "all", sort: "title-asc", ...App.storage.loadView(), query: "" };
  const state = { items, view, editingId: null };

  if (condition !== "ok") App.storage.save(items);
  App.events.bind(state);   // first: it replaces saved view values that are no longer valid
  App.render.all(state);
  if (LOAD_NOTICES[condition]) App.render.notice(LOAD_NOTICES[condition]);
})(window.App);
