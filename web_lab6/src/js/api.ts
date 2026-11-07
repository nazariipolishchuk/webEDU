// js/api.ts: everything that talks to the REST API. Knows nothing about the page.
import {
  type Guard,
  isAlbumList,
  isCommentList,
  isPostList,
  isUser,
  isUserList,
} from "./guards.ts";
import { fail, ok, type Result } from "./result.ts";
import type { Album, Comment, Curator, Post, User } from "./types.ts";

// From .env.development (/api, through the proxy of the dev server) or .env.production
export const BASE_URL = import.meta.env.VITE_API_URL;
// The public address of the same API: the CORS checks need a real cross-origin request
export const REMOTE_URL = "https://jsonplaceholder.typicode.com";

// The Server list on the page: the real API and two ways for it to fail, to check the error state
const SERVERS = {
  working: BASE_URL,
  missing: `${BASE_URL}/no-such-path`,
  unreachable: "https://jsonplaceholder.invalid",
} as const;

export type ServerName = keyof typeof SERVERS;

export const isServerName = (value: string): value is ServerName => Object.hasOwn(SERVERS, value);

export const PAGE_SIZE = 10;
const TIME_LIMIT = 5000;
const RETRIES = 3;
const RETRY_DELAY = 500;

type Method = "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";

// Repeating these does not change the result. A repeated POST could create a duplicate record.
const IDEMPOTENT: ReadonlySet<Method> = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

let server: string = SERVERS.working;
export const useServer = (name: ServerName): void => {
  server = SERVERS[name];
};

// HTTP/2 responses carry no reason phrase, so response.statusText is empty there
const STATUS_TEXT: Partial<Record<number, string>> = {
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

// What went wrong. The page explains each kind in its own words (explain below).
export type ApiErrorKind = "http" | "json" | "shape" | "network" | "timeout" | "aborted";

interface ApiErrorDetails {
  status?: number;
  url?: string;
  cause?: unknown;
}

// fetch does not reject on 404 or 500, so request() throws this error itself
export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly kind: ApiErrorKind;
  readonly status: number; // 0 when there was no answer
  readonly url: string;

  constructor(
    kind: ApiErrorKind,
    message: string,
    { status = 0, url = "", cause }: ApiErrorDetails = {},
  ) {
    super(message, { cause });
    this.kind = kind;
    this.status = status;
    this.url = url;
  }
}

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal | undefined;
  headers?: Record<string, string>;
  cache?: RequestCache;
}

// The body is unknown: the server may send anything, the caller checks it with a guard
export async function request(
  url: string,
  { method = "GET", body, signal, headers = {}, cache }: RequestOptions = {},
): Promise<unknown> {
  const hasBody = body !== undefined;
  const init: RequestInit = {
    method,
    signal: signal ?? null,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };
  if (cache) init.cache = cache;
  if (hasBody) init.body = JSON.stringify(body);
  const response = await fetch(url, init);

  const { status } = response;
  if (!response.ok) {
    const reason = response.statusText || STATUS_TEXT[status] || "";
    throw new ApiError("http", `HTTP ${status} ${reason}`.trim(), { status, url });
  }
  if (status === 204) return null; // success without a body

  try {
    return (await response.json()) as unknown;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error; // AbortError and network errors go on as they are
    throw new ApiError("json", `HTTP ${status}: the answer is not valid JSON`, {
      status,
      url,
      cause: error,
    });
  }
}

// The controller's signal cancels on request, the timeout signal fires by itself.
// fetch rejects with the reason of whichever fired first: AbortError or TimeoutError.
const limited = (signal?: AbortSignal) => {
  const timeout = AbortSignal.timeout(TIME_LIMIT);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

// A network failure, an overloaded server or a rate limit can pass, 404 will not.
// A timeout is not repeated either: it goes straight to the error state with its Retry button.
const isTemporary = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof ApiError && (error.status === 429 || error.status >= 500));

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error);
      return;
    }
    const timerId = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timerId);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });

export interface Retry {
  attempt: number;
  retries: number;
  delay: number;
}

export interface RetryOptions extends RequestOptions {
  onRetry?: ((retry: Retry) => void) | undefined;
}

// Up to 3 repeats after the first request, waiting 0.5, 1 and 2 seconds. Each attempt has its own time limit.
export async function requestWithRetry(
  url: string,
  { signal, onRetry, ...options }: RetryOptions = {},
): Promise<unknown> {
  const retries = IDEMPOTENT.has(options.method ?? "GET") ? RETRIES : 0;

  for (let attempt = 1; ; attempt++) {
    try {
      return await request(url, { ...options, signal: limited(signal) });
    } catch (error) {
      if (attempt > retries || !isTemporary(error)) throw error;
      const delay = RETRY_DELAY * 2 ** (attempt - 1);
      onRetry?.({ attempt, retries, delay });
      await pause(delay, signal);
    }
  }
}

// Whatever was thrown becomes an ApiError with its kind. fetch rejects with DOMException
// (AbortError, TimeoutError) or TypeError (no connection); request() throws ApiError itself.
const toApiError = (error: unknown, url: string): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new ApiError("timeout", error.message, { url, cause: error });
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError("aborted", error.message, { url, cause: error });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError("network", message, { url, cause: error });
};

// The generic wrapper over fetch. T is the type the guard proves, so getJson(url, isPostList)
// gives Result<Post[], ApiError>. It never rejects: every failure comes back as a value.
export async function getJson<T>(
  url: string,
  guard: Guard<T>,
  options: RetryOptions = {},
): Promise<Result<T, ApiError>> {
  try {
    const body = await requestWithRetry(url, options);
    return guard(body)
      ? ok(body)
      : fail(new ApiError("shape", "the answer has an unexpected structure", { url }));
  } catch (error) {
    return fail(toApiError(error, url));
  }
}

type Params = Record<string, string | number | undefined>;

const addressOf = (path: string, params: Params = {}) => {
  // The base of a relative address (/api in development) is the page origin
  const address = new URL(server + path, location.origin);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") address.searchParams.set(name, String(value));
  }
  return address.href;
};

export interface PostQuery {
  query?: string;
  userId?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
  onRetry?: (retry: Retry) => void;
}

export const getPosts = ({
  query,
  userId,
  page = 1,
  limit = PAGE_SIZE,
  signal,
  onRetry,
}: PostQuery = {}): Promise<Result<Post[], ApiError>> =>
  getJson(addressOf("/posts", { q: query, userId, _page: page, _limit: limit }), isPostList, {
    signal,
    onRetry,
  });

export const getUsers = (signal?: AbortSignal): Promise<Result<User[], ApiError>> =>
  getJson(addressOf("/users"), isUserList, { signal });

export const getComments = (
  postId: number,
  signal?: AbortSignal,
): Promise<Result<Comment[], ApiError>> =>
  getJson(addressOf(`/posts/${postId}/comments`), isCommentList, { signal });

const getAlbums = (userId: number, signal?: AbortSignal): Promise<Result<Album[], ApiError>> =>
  getJson(addressOf("/albums", { userId }), isAlbumList, { signal });

// The curator's card needs all three independent resources, so one failure fails the card.
// They start together: the wait is the slowest of them, not the sum.
export const getCurator = async (
  userId: number,
  signal?: AbortSignal,
): Promise<Result<Curator, ApiError>> => {
  const [user, posts, albums] = await Promise.all([
    getJson(addressOf(`/users/${userId}`), isUser, { signal }),
    getJson(addressOf("/posts", { userId }), isPostList, { signal }),
    getAlbums(userId, signal),
  ]);
  if (!user.ok) return user;
  if (!posts.ok) return posts;
  if (!albums.ok) return albums;
  return ok({ user: user.value, posts: posts.value, albums: albums.value });
};

// A sentence for the error state. The code of the answer stays in it.
export const explain = (error: ApiError): string => {
  switch (error.kind) {
    case "timeout":
      return `The server did not answer within ${TIME_LIMIT / 1000} seconds. The waiting time is over.`;
    case "http":
    case "json":
      return `The server answered with an error: ${error.message}.`;
    case "shape":
      return `The server answered, but ${error.message}.`;
    case "network":
      return "The server cannot be reached. Check the connection and try again.";
    case "aborted":
      return "The request was cancelled.";
    default: {
      // Every kind has its branch: a new kind without one does not compile
      const unexpected: never = error.kind;
      return unexpected;
    }
  }
};
