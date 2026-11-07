// Your custom Flat
import { counter } from "./assert-counter.ts";

const assert = counter("flat");

// The elements are of any type and nest to any depth, so the walk works with unknown
const flatInto = (arr: readonly unknown[], depth: number, result: unknown[]) => {
  for (let i = 0; i < arr.length; i++) {
    if (!(i in arr)) continue; // holes are skipped, as in the built-in flat
    const item: unknown = arr[i];
    if (Array.isArray(item) && depth >= 1) {
      flatInto(item, depth - 1, result);
    } else {
      result.push(item);
    }
  }
  return result;
};

// The type of the result comes from the built-in FlatArray<A, D>: the same as arr.flat(depth) gives
const flat = <A extends readonly unknown[], D extends number = 1>(
  arr: A,
  depth: D = 1 as D,
): FlatArray<A, D>[] => flatInto(arr, depth, []) as FlatArray<A, D>[];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const arr = [1, [2, [3, [4, [5]]]], [], [[6]], 7];
const snapshot = JSON.stringify(arr);

const flat01 = arr.flat(1); // built-in flat
const flat02 = flat(arr, 1); // own implementation

assert(same(flat01, flat02), "Flat01 does not match Flat02");
assert(same(flat(arr), arr.flat()), "Depth should default to 1");
assert(same(flat(arr, 2), arr.flat(2)), "Depth 2 should match the built-in");
assert(same(flat(arr, Infinity), arr.flat(Infinity)), "Depth Infinity should match the built-in");
assert(same(flat(arr, 0), arr.flat(0)), "Depth 0 should give a shallow copy");
assert(flat(arr, 0) !== arr, "A new array should be returned");
assert(same(flat([], 2), []), "Empty array should give an empty array");

// eslint-disable-next-line no-sparse-arrays -- holes on purpose: flat must skip them
const sparse = [1, , [2, , 3]];
assert(same(flat(sparse), sparse.flat()), "Holes should be skipped");

const shared = { id: 1 };
assert(flat([[shared]])[0] === shared, "Flat is shallow: objects stay shared");

assert(JSON.stringify(arr) === snapshot, "Source structure should not be mutated");
