// js/main.js: entry point, connected last, when every part of App already exists.
(function (App) {
  "use strict";

  const { items, condition } = App.storage.load();
  const state = { items };

  if (condition !== "ok") App.storage.save(items);
  App.render.all(state);
})(window.App);
