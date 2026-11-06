// Your custom Flat
import { counter } from "./assert-counter.js";

const assert = counter("flat");

const flat = (arr, depth = 1) => {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (!(i in arr)) continue; // holes are skipped, as in the built-in flat
    if (Array.isArray(arr[i]) && depth >= 1) {
      result.push(...flat(arr[i], depth - 1));
    } else {
      result.push(arr[i]);
    }
  }
  return result;
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
