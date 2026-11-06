// Your custom Map
import { counter } from "./assert-counter.js";

const assert = counter("map");

const map = (arr, fn, thisArg) => {
  const result = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    if (i in arr) result[i] = fn.call(thisArg, arr[i], i, arr); // holes stay holes
  }
  return result;
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const arr = [1, 2, 3, 4];
const double = (val) => val * 2;

const map01 = arr.map(double); // built-in map
const map02 = map(arr, double); // own implementation

assert(same(map01, map02), "Map01 does not match Map02");
assert(map02.length === arr.length, "Length should not change");
assert(map02 !== arr, "A new array should be returned");
assert(same(map([], double), []), "Empty array should give an empty array");

const withIndex = (val, i) => val * i;
assert(same(map(arr, withIndex), arr.map(withIndex)), "Index should be passed to the function");

const seen = [];
map(arr, (val, i, source) => seen.push(source === arr));
assert(seen.every(Boolean), "Source array should be the third argument");

const context = { factor: 10 };
const scale = function (val) {
  return val * this.factor;
};
assert(same(map(arr, scale, context), arr.map(scale, context)), "thisArg should be honoured");

// eslint-disable-next-line no-sparse-arrays -- holes on purpose: map must keep them
const sparse = [1, , 3];
assert(!(1 in map(sparse, double)), "Holes should stay holes, as in the built-in map");

assert(same(arr, [1, 2, 3, 4]), "Array should not be mutated");
