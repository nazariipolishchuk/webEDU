// js/api.js: everything that talks to the REST API. Knows nothing about the page.

const BASE_URL = "https://jsonplaceholder.typicode.com";

export const PAGE_SIZE = 10;
const TIME_LIMIT = 5000;

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

const addressOf = (path, params = {}) => {
  const address = new URL(BASE_URL + path);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") address.searchParams.set(name, value);
  }
  return address.href;
};

export const getPosts = ({ query, userId, page = 1, limit = PAGE_SIZE, signal } = {}) =>
  request(addressOf("/posts", { q: query, userId, _page: page, _limit: limit }), { signal: limited(signal) });

export const getUsers = ({ signal } = {}) => request(addressOf("/users"), { signal: limited(signal) });

// A sentence for the error state. The code of the answer stays in it.
export const explain = (error) => {
  if (error.name === "TimeoutError") return `The server did not answer within ${TIME_LIMIT / 1000} seconds. The waiting time is over.`;
  if (error instanceof ApiError) return `The server answered with an error: ${error.message}.`;
  if (error instanceof TypeError) return "The server cannot be reached. Check the connection and try again.";
  return `The request failed: ${error.message}.`;
};
