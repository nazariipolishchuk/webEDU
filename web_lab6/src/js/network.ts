// js/network.ts: the measurements and checks of network.html. Results go to the page, not to the console.
// The checks need the errors as fetch gives them, so this page uses request(), which throws.
import { ApiError, BASE_URL, REMOTE_URL, request } from "./api.ts";
import { isRecord } from "./guards.ts";
import { createEl, element, showApiAddress } from "./utils.ts";

showApiAddress();

const RUNS = 5;
const PATHS = ["/users/1", "/posts?userId=1", "/albums?userId=1"];
const PATHS_WITH_FAILURE = ["/users/1", "/posts/0", "/albums?userId=1"];

// no-store: every run really goes to the server
const fetchResource = (path: string) => request(BASE_URL + path, { cache: "no-store" });

const sequential = async () => {
  const results: unknown[] = [];
  for (const path of PATHS) results.push(await fetchResource(path));
  return results;
};

const parallel = () => Promise.all(PATHS.map(fetchResource));

const timed = async (task: () => Promise<unknown>) => {
  const start = performance.now();
  await task();
  return Math.round(performance.now() - start);
};

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

// A thrown value is unknown: only an Error has a name and a message
const describeError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "Error", message: String(error) };

interface Cell {
  text: string;
  number?: boolean;
}

const createRow = (cells: Cell[]) => {
  const row = document.createElement("tr");
  cells.forEach(({ text, number }) => {
    row.append(createEl("td", `results__cell${number ? " results__cell--number" : ""}`, text));
  });
  return row;
};

const addLog = (log: HTMLElement, title: string, text: string, failed = false) => {
  const entry = createEl("li", `log__entry${failed ? " log__entry--failed" : ""}`);
  entry.append(createEl("p", "log__title", title), createEl("p", "log__text", text));
  log.prepend(entry);
};

// ---------- One after another, or all at once ----------

const measureButton = element("#measure", HTMLButtonElement);
const measureStatus = element("#measure-status", HTMLElement);
const measureRows = element("#measure-rows", HTMLTableSectionElement);
const measureTable = element("#measure-table", HTMLTableElement);

const measure = async () => {
  measureButton.disabled = true;
  measureRows.replaceChildren();
  measureTable.hidden = false;

  try {
    await fetchResource(PATHS[0] ?? "/users/1"); // opens the connection, so the first run pays no extra for it
    const times: Record<"one" | "all", number[]> = { one: [], all: [] };
    for (let run = 1; run <= RUNS; run++) {
      measureStatus.textContent = `Run ${run} of ${RUNS}…`;
      const one = await timed(sequential);
      const all = await timed(parallel);
      times.one.push(one);
      times.all.push(all);
      measureRows.append(
        createRow([
          { text: String(run) },
          { text: String(one), number: true },
          { text: String(all), number: true },
        ]),
      );
    }
    const medians = [median(times.one), median(times.all)] as const;
    const total = createRow([
      { text: "Median" },
      { text: String(medians[0]), number: true },
      { text: String(medians[1]), number: true },
    ]);
    total.className = "results__total";
    measureRows.append(total);
    measureStatus.textContent = `Promise.all took ${(medians[0] / medians[1]).toFixed(1)} times less time.`;
  } catch (error) {
    measureStatus.textContent = `The measurement stopped: ${describeError(error).message}.`;
  } finally {
    measureButton.disabled = false;
  }
};

measureButton.addEventListener("click", () => void measure());

// ---------- When one request fails ----------

// A list shows its length, a single record its name, when it has one
const summarise = (value: unknown) => {
  if (Array.isArray(value)) return `${value.length} records`;
  if (isRecord(value) && typeof value.name === "string") return value.name;
  return "a record";
};

const compareButton = element("#compare", HTMLButtonElement);
const compareRows = element("#compare-rows", HTMLTableSectionElement);
const compareTable = element("#compare-table", HTMLTableElement);

const compare = async () => {
  compareButton.disabled = true;
  compareRows.replaceChildren();
  compareTable.hidden = false;

  let start = performance.now();
  try {
    await Promise.all(PATHS_WITH_FAILURE.map(fetchResource));
  } catch (error) {
    const ms = Math.round(performance.now() - start);
    compareRows.append(
      createRow([
        { text: "Promise.all" },
        {
          text: `Rejected after ${ms} ms with “${describeError(error).message}”. The results of the other two are lost.`,
        },
      ]),
    );
  }

  start = performance.now();
  const results = await Promise.allSettled(PATHS_WITH_FAILURE.map(fetchResource));
  const ms = Math.round(performance.now() - start);
  const parts = results.map((result, index) =>
    result.status === "fulfilled"
      ? `${PATHS_WITH_FAILURE[index]}: fulfilled, ${summarise(result.value)}`
      : `${PATHS_WITH_FAILURE[index]}: rejected, ${describeError(result.reason).message}`,
  );
  compareRows.append(
    createRow([
      { text: "Promise.allSettled" },
      { text: `Settled after ${ms} ms. ${parts.join("; ")}.` },
    ]),
  );
  compareButton.disabled = false;
};

compareButton.addEventListener("click", () => void compare());

// ---------- Kinds of error ----------

type ErrorCheck = "not-found" | "abort" | "timeout";

const ERROR_CHECKS: Record<ErrorCheck, () => Promise<unknown>> = {
  "not-found": () => request(`${BASE_URL}/posts/0`),
  abort: () => {
    const controller = new AbortController();
    const answer = request(`${BASE_URL}/posts/1`, { signal: controller.signal });
    controller.abort();
    return answer;
  },
  timeout: () =>
    request(`${BASE_URL}/posts/1`, { cache: "no-store", signal: AbortSignal.timeout(1) }),
};

const isErrorCheck = (value: string | undefined): value is ErrorCheck =>
  value !== undefined && Object.hasOwn(ERROR_CHECKS, value);

const errorsLog = element("#errors-log", HTMLOListElement);

const runErrorCheck = async (button: HTMLElement, name: ErrorCheck) => {
  const title = button.textContent;
  try {
    await ERROR_CHECKS[name]();
    addLog(errorsLog, title, "The request succeeded.");
  } catch (error) {
    const { name: errorName, message } = describeError(error);
    const status = error instanceof ApiError && error.status ? `, status ${error.status}` : "";
    addLog(errorsLog, title, `${errorName}: ${message}${status}`, true);
  }
};

element("#errors", HTMLElement).addEventListener("click", (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>("[data-error]");
  const name = button?.dataset.error;
  if (button && isErrorCheck(name)) void runErrorCheck(button, name);
});

// ---------- Cross-origin requests. Plain fetch: the headers are the point here. ----------
// REMOTE_URL, not BASE_URL: in development BASE_URL is /api on the same origin, so CORS would not apply

type CorsCheck = "simple" | "post" | "header" | "blocked";

const CORS_CHECKS: Record<CorsCheck, { label: string; send: () => Promise<Response> }> = {
  simple: {
    label: "GET /posts/1, no custom headers",
    send: () => fetch(`${REMOTE_URL}/posts/1`, { cache: "no-store" }),
  },
  post: {
    label: "POST /posts, Content-Type: application/json",
    send: () =>
      fetch(`${REMOTE_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New publication", body: "Text", userId: 1 }),
      }),
  },
  header: {
    label: "GET /posts/1, X-Request-Id: lab-04",
    send: () =>
      fetch(`${REMOTE_URL}/posts/1`, { cache: "no-store", headers: { "X-Request-Id": "lab-04" } }),
  },
  blocked: {
    label: "GET https://example.com/",
    send: () => fetch("https://example.com/", { cache: "no-store" }),
  },
};

const isCorsCheck = (value: string | undefined): value is CorsCheck =>
  value !== undefined && Object.hasOwn(CORS_CHECKS, value);

const corsLog = element("#cors-log", HTMLOListElement);

const runCorsCheck = async (name: CorsCheck) => {
  const { label, send } = CORS_CHECKS[name];
  try {
    const response = await send();
    const readable = [...response.headers.keys()].join(", ");
    addLog(corsLog, label, `Status ${response.status}. Headers the script may read: ${readable}.`);
  } catch (error) {
    const { name: errorName, message } = describeError(error);
    addLog(
      corsLog,
      label,
      `${errorName}: ${message}. The console has the reason, the script does not.`,
      true,
    );
  }
};

element("#cors", HTMLElement).addEventListener("click", (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const name = event.target.closest<HTMLElement>("[data-cors]")?.dataset.cors;
  if (isCorsCheck(name)) void runCorsCheck(name);
});
