// js/cache.ts: the last successful result in localStorage, with the time it was saved.
import { isArrayOf, isCuratorName, isPost, isRecord } from "./guards.ts";
import type { PublicationsState, SavedResult } from "./types.ts";
import { read, write } from "./utils.ts";

const CACHE_KEY = "drannotation-publications";
const MAX_AGE = 5 * 60 * 1000; // after 5 minutes the copy is out of date

// A saved copy as loadResult gives it: with its age and whether it is still fresh
export type LoadedResult = SavedResult & { age: number; fresh: boolean };

// The storage can be edited by hand, so nothing read from it is trusted
const isSavedResult = (value: unknown): value is SavedResult =>
  isRecord(value) &&
  Number.isFinite(value.savedAt) &&
  typeof value.query === "string" &&
  typeof value.userId === "string" &&
  typeof value.page === "number" &&
  Number.isInteger(value.page) &&
  value.page > 0 &&
  typeof value.hasMore === "boolean" &&
  isArrayOf(isPost)(value.posts) &&
  isArrayOf(isCuratorName)(value.users);

// Pick: only these fields of the page state are saved, the controller and the like stay out
export const saveResult = ({
  posts,
  users,
  query,
  userId,
  page,
  hasMore,
}: Pick<
  PublicationsState,
  "posts" | "users" | "query" | "userId" | "page" | "hasMore"
>): boolean => {
  const saved: SavedResult = {
    savedAt: Date.now(),
    posts,
    users: [...users.values()],
    query,
    userId,
    page,
    hasMore,
  };
  return write(CACHE_KEY, saved);
};

// null when nothing is saved or the copy is damaged. Otherwise the copy with its age.
export const loadResult = (): LoadedResult | null => {
  const stored = read(CACHE_KEY);
  if (stored.state !== "found" || !isSavedResult(stored.value)) return null;
  const age = Date.now() - stored.value.savedAt;
  return { ...stored.value, age, fresh: age <= MAX_AGE };
};

export const describeAge = (age: number): string => {
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "less than a minute ago";
  return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
};
