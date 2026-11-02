// js/main.js: entry point, connected last, when every part of App already exists.
(function (App) {
  "use strict";

  const { items, condition } = App.storage.load();
  const view = { query: "", status: "all", selection: "all", sort: "title-asc" };
  const state = { items, view, editingId: null };

  if (condition !== "ok") App.storage.save(items);
  App.render.all(state);
  App.events.bind(state);
})(window.App);
