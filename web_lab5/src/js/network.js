// js/network.js: the measurements and checks of network.html. Results go to the page, not to the console.
import { BASE_URL, REMOTE_URL, request } from "./api.js";
import { createEl, showApiAddress } from "./utils.js";

showApiAddress();

const RUNS = 5;
const PATHS = ["/users/1", "/posts?userId=1", "/albums?userId=1"];
const PATHS_WITH_FAILURE = ["/users/1", "/posts/0", "/albums?userId=1"];

const $ = (selector) => document.querySelector(selector);

// no-store: every run really goes to the server
const fetchResource = (path) => request(BASE_URL + path, { cache: "no-store" });

const sequential = async () => {
  const results = [];
  for (const path of PATHS) results.push(await fetchResource(path));
  return results;
};

const parallel = () => Promise.all(PATHS.map(fetchResource));

const timed = async (task) => {
  const start = performance.now();
  await task();
  return Math.round(performance.now() - start);
};

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const createRow = (cells) => {
  const row = document.createElement("tr");
  cells.forEach(({ text, number }) => {
    row.append(createEl("td", `results__cell${number ? " results__cell--number" : ""}`, text));
  });
  return row;
};

const addLog = (log, title, text, failed = false) => {
  const entry = createEl("li", `log__entry${failed ? " log__entry--failed" : ""}`);
  entry.append(createEl("p", "log__title", title), createEl("p", "log__text", text));
  log.prepend(entry);
};

// ---------- One after another, or all at once ----------

$("#measure").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const status = $("#measure-status");
  const rows = $("#measure-rows");
  button.disabled = true;
  rows.replaceChildren();
  $("#measure-table").hidden = false;

  try {
    await fetchResource(PATHS[0]);  // opens the connection, so the first run pays no extra for it
    const times = { one: [], all: [] };
    for (let run = 1; run <= RUNS; run++) {
      status.textContent = `Run ${run} of ${RUNS}…`;
      const one = await timed(sequential);
      const all = await timed(parallel);
      times.one.push(one);
      times.all.push(all);
      rows.append(createRow([{ text: String(run) }, { text: String(one), number: true }, { text: String(all), number: true }]));
    }
    const medians = [median(times.one), median(times.all)];
    const total = createRow([{ text: "Median" }, { text: String(medians[0]), number: true }, { text: String(medians[1]), number: true }]);
    total.className = "results__total";
    rows.append(total);
    status.textContent = `Promise.all took ${(medians[0] / medians[1]).toFixed(1)} times less time.`;
  } catch (error) {
    status.textContent = `The measurement stopped: ${error.message}.`;
  } finally {
    button.disabled = false;
  }
});

// ---------- When one request fails ----------

const summarise = (value) => (Array.isArray(value) ? `${value.length} records` : value.name);

$("#compare").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const rows = $("#compare-rows");
  button.disabled = true;
  rows.replaceChildren();
  $("#compare-table").hidden = false;

  let start = performance.now();
  try {
    await Promise.all(PATHS_WITH_FAILURE.map(fetchResource));
  } catch (error) {
    const ms = Math.round(performance.now() - start);
    rows.append(createRow([{ text: "Promise.all" }, { text: `Rejected after ${ms} ms with “${error.message}”. The results of the other two are lost.` }]));
  }

  start = performance.now();
  const results = await Promise.allSettled(PATHS_WITH_FAILURE.map(fetchResource));
  const ms = Math.round(performance.now() - start);
  const parts = results.map((result, index) => (result.status === "fulfilled"
    ? `${PATHS_WITH_FAILURE[index]}: fulfilled, ${summarise(result.value)}`
    : `${PATHS_WITH_FAILURE[index]}: rejected, ${result.reason.message}`));
  rows.append(createRow([{ text: "Promise.allSettled" }, { text: `Settled after ${ms} ms. ${parts.join("; ")}.` }]));
  button.disabled = false;
});

// ---------- Kinds of error ----------

const ERROR_CHECKS = {
  "not-found": () => request(`${BASE_URL}/posts/0`),
  abort: () => {
    const controller = new AbortController();
    const answer = request(`${BASE_URL}/posts/1`, { signal: controller.signal });
    controller.abort();
    return answer;
  },
  timeout: () => request(`${BASE_URL}/posts/1`, { cache: "no-store", signal: AbortSignal.timeout(1) }),
};

$("#errors").addEventListener("click", async (event) => {
  const name = event.target.closest("[data-error]")?.dataset.error;
  if (!name) return;
  try {
    await ERROR_CHECKS[name]();
    addLog($("#errors-log"), event.target.textContent, "The request succeeded.");
  } catch (error) {
    const status = error.status ? `, status ${error.status}` : "";
    addLog($("#errors-log"), event.target.textContent, `${error.name}: ${error.message}${status}`, true);
  }
});

// ---------- Cross-origin requests. Plain fetch: the headers are the point here. ----------
// REMOTE_URL, not BASE_URL: in development BASE_URL is /api on the same origin, so CORS would not apply

const CORS_CHECKS = {
  simple: {
    label: "GET /posts/1, no custom headers",
    send: () => fetch(`${REMOTE_URL}/posts/1`, { cache: "no-store" }),
  },
  post: {
    label: "POST /posts, Content-Type: application/json",
    send: () => fetch(`${REMOTE_URL}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New publication", body: "Text", userId: 1 }),
    }),
  },
  header: {
    label: "GET /posts/1, X-Request-Id: lab-04",
    send: () => fetch(`${REMOTE_URL}/posts/1`, { cache: "no-store", headers: { "X-Request-Id": "lab-04" } }),
  },
  blocked: {
    label: "GET https://example.com/",
    send: () => fetch("https://example.com/", { cache: "no-store" }),
  },
};

$("#cors").addEventListener("click", async (event) => {
  const name = event.target.closest("[data-cors]")?.dataset.cors;
  if (!name) return;
  const { label, send } = CORS_CHECKS[name];
  try {
    const response = await send();
    const readable = [...response.headers.keys()].join(", ");
    addLog($("#cors-log"), label, `Status ${response.status}. Headers the script may read: ${readable}.`);
  } catch (error) {
    addLog($("#cors-log"), label, `${error.name}: ${error.message}. The console has the reason, the script does not.`, true);
  }
});
