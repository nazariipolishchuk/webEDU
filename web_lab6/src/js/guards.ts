// js/guards.ts: type guards. Data from the network and from localStorage arrives as unknown,
// and only a guard with an "is" predicate turns it into a domain type.
import type { Album, Comment, CuratorName, Post, User } from "./types.ts";

export type Guard<T> = (value: unknown) => value is T;

// After this check the properties of the object can be read, each of them still unknown
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A key of a lookup table, such as a status of STATUSES: the table itself is the list of values
export const isKeyOf = <T extends object>(table: T, value: unknown): value is keyof T =>
  typeof value === "string" && Object.hasOwn(table, value);

const isId = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;
const isText = (value: unknown): value is string => typeof value === "string";
const isOptionalText = (value: unknown): value is string | undefined =>
  value === undefined || isText(value);

// One guard for any list: Array.isArray makes it unknown[], every checks each element
export const isArrayOf =
  <T>(guard: Guard<T>): Guard<T[]> =>
  (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(guard);

export const isPost = (value: unknown): value is Post =>
  isRecord(value) &&
  isId(value.id) &&
  isId(value.userId) &&
  isText(value.title) &&
  isText(value.body);

export const isCuratorName = (value: unknown): value is CuratorName =>
  isRecord(value) && isId(value.id) && isText(value.name);

// The optional parts of a user are checked only when they are there
export const isUser = (value: unknown): value is User =>
  isRecord(value) &&
  isId(value.id) &&
  isText(value.name) &&
  isText(value.username) &&
  isText(value.email) &&
  isOptionalText(value.phone) &&
  isOptionalText(value.website) &&
  (value.address === undefined ||
    (isRecord(value.address) && isText(value.address.street) && isText(value.address.city))) &&
  (value.company === undefined ||
    (isRecord(value.company) &&
      isText(value.company.name) &&
      isOptionalText(value.company.catchPhrase)));

export const isComment = (value: unknown): value is Comment =>
  isRecord(value) &&
  isId(value.id) &&
  isId(value.postId) &&
  isText(value.name) &&
  isText(value.email) &&
  isText(value.body);

export const isAlbum = (value: unknown): value is Album =>
  isRecord(value) && isId(value.id) && isId(value.userId) && isText(value.title);

// One guard for every answer of the API
export const isPostList = isArrayOf(isPost);
export const isUserList = isArrayOf(isUser);
export const isCommentList = isArrayOf(isComment);
export const isAlbumList = isArrayOf(isAlbum);
