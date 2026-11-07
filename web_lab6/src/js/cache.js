// js/cache.js: the last successful result in localStorage, with the time it was saved.
import { read, write } from "./utils.js";

const CACHE_KEY = "drannotation-publications";
const MAX_AGE = 5 * 60 * 1000; // after 5 minutes the copy is out of date

// The storage can be edited by hand, so nothing read from it is trusted
const isPost = (post) =>
  post !== null &&
  typeof post === "object" &&
  Number.isInteger(post.id) &&
  Number.isInteger(post.userId) &&
  typeof post.title === "string" &&
  typeof post.body === "string";

const isUser = (user) =>
  user !== null &&
  typeof user === "object" &&
  Number.isInteger(user.id) &&
  typeof user.name === "string";

const isResult = (value) =>
  value !== null &&
  typeof value === "object" &&
  Number.isFinite(value.savedAt) &&
  typeof value.query === "string" &&
  typeof value.userId === "string" &&
  Number.isInteger(value.page) &&
  value.page > 0 &&
  typeof value.hasMore === "boolean" &&
  Array.isArray(value.posts) &&
  value.posts.every(isPost) &&
  Array.isArray(value.users) &&
  value.users.every(isUser);

// A Map does not survive JSON.stringify, so the curators are saved as an array
export const saveResult = ({ posts, users, query, userId, page, hasMore }) =>
  write(CACHE_KEY, {
    savedAt: Date.now(),
    posts,
    users: [...users.values()],
    query,
    userId,
    page,
    hasMore,
  });

// null when nothing is saved or the copy is damaged. Otherwise the copy with its age.
export const loadResult = () => {
  const { value } = read(CACHE_KEY);
  if (!isResult(value)) return null;
  const age = Date.now() - value.savedAt;
  return { ...value, age, fresh: age <= MAX_AGE };
};

export const describeAge = (age) => {
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "less than a minute ago";
  return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
};
