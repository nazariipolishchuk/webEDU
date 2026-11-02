// js/api.js: everything that talks to the REST API. Knows nothing about the page.

const BASE_URL = "https://jsonplaceholder.typicode.com";

// The Server list on the page: the real API and two ways for it to fail, to check the error state
const SERVERS = {
  working: BASE_URL,
  missing: `${BASE_URL}/no-such-path`,
  unreachable: "https://jsonplaceholder.invalid",
};

export const PAGE_SIZE = 10;
const TIME_LIMIT = 5000;
const RETRIES = 3;
const RETRY_DELAY = 500;

// Repeating these does not change the result. A repeated POST could create a duplicate record.
const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

let server = SERVERS.working;
export const useServer = (name) => { server = SERVERS[name]; };

// HTTP/2 responses carry no reason phrase, so response.statusText is empty there
const STATUS_TEXT = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

// fetch does not reject on 404 or 500, so request() throws this error itself
export class ApiError extends Error {
  constructor(message, { status = 0, url = "", cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

export async function request(url, { method = "GET", body, signal, headers = {}, cache } = {}) {
  const hasBody = body !== undefined;
  const response = await fetch(url, {
    method,
    signal,
    cache,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const { status } = response;
  if (!response.ok) {
    const reason = response.statusText || STATUS_TEXT[status] || "";
    throw new ApiError(`HTTP ${status} ${reason}`.trim(), { status, url });
  }
  if (status === 204) return null; // success without a body

  try {
    return await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error; // AbortError and network errors go on as they are
    throw new ApiError(`HTTP ${status}: the answer is not valid JSON`, { status, url, cause: error });
  }
}

// The controller's signal cancels on request, the timeout signal fires by itself.
// fetch rejects with the reason of whichever fired first: AbortError or TimeoutError.
const limited = (signal) => {
  const timeout = AbortSignal.timeout(TIME_LIMIT);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

// A network failure, an overloaded server or a rate limit can pass, 404 will not.
// A timeout is not repeated either: it goes straight to the error state with its Retry button.
const isTemporary = (error) =>
  error instanceof TypeError || (error instanceof ApiError && (error.status === 429 || error.status >= 500));

const pause = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason);
    return;
  }
  const timerId = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => {
    clearTimeout(timerId);
    reject(signal.reason);
  }, { once: true });
});

// Up to 3 repeats after the first request, waiting 0.5, 1 and 2 seconds. Each attempt has its own time limit.
export async function requestWithRetry(url, { signal, onRetry, ...options } = {}) {
  const retries = IDEMPOTENT.has(options.method ?? "GET") ? RETRIES : 0;

  for (let attempt = 1; ; attempt++) {
    try {
      return await request(url, { ...options, signal: limited(signal) });
    } catch (error) {
      if (attempt > retries || !isTemporary(error)) throw error;
      const delay = RETRY_DELAY * 2 ** (attempt - 1);
      onRetry?.({ attempt, retries, delay, error });
      await pause(delay, signal);
    }
  }
}

const addressOf = (path, params = {}) => {
  const address = new URL(server + path);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") address.searchParams.set(name, value);
  }
  return address.href;
};

export const getPosts = ({ query, userId, page = 1, limit = PAGE_SIZE, signal, onRetry } = {}) =>
  requestWithRetry(addressOf("/posts", { q: query, userId, _page: page, _limit: limit }), { signal, onRetry });

export const getUsers = ({ signal } = {}) => requestWithRetry(addressOf("/users"), { signal });

// A sentence for the error state. The code of the answer stays in it.
export const explain = (error) => {
  if (error.name === "TimeoutError") return `The server did not answer within ${TIME_LIMIT / 1000} seconds. The waiting time is over.`;
  if (error instanceof ApiError) return `The server answered with an error: ${error.message}.`;
  if (error instanceof TypeError) return "The server cannot be reached. Check the connection and try again.";
  return `The request failed: ${error.message}.`;
};
