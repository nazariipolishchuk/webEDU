// Your custom Map
import { counter } from "./assert-counter.ts";

const assert = counter("map");

// T: the type of the elements, U: what the callback returns, This: the this of the callback
const map = <T, U, This = undefined>(
  arr: readonly T[],
  fn: (this: This, value: T, index: number, array: readonly T[]) => U,
  thisArg?: This,
): U[] => {
  const result = new Array<U>(arr.length);
  for (let i = 0; i < arr.length; i++) {
    // i in arr rules out a hole, so arr[i] is a T; noUncheckedIndexedAccess cannot see that
    if (i in arr) result[i] = fn.call(thisArg as This, arr[i] as T, i, arr); // holes stay holes
  }
  return result;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const arr = [1, 2, 3, 4];
const double = (val: number) => val * 2;

const map01 = arr.map(double); // built-in map
const map02 = map(arr, double); // own implementation

assert(same(map01, map02), "Map01 does not match Map02");
assert(map02.length === arr.length, "Length should not change");
assert(map02 !== arr, "A new array should be returned");
assert(same(map([], double), []), "Empty array should give an empty array");

const withIndex = (val: number, i: number) => val * i;
assert(same(map(arr, withIndex), arr.map(withIndex)), "Index should be passed to the function");

const seen: boolean[] = [];
map(arr, (_val, _i, source) => seen.push(source === arr));
assert(seen.every(Boolean), "Source array should be the third argument");

const context = { factor: 10 };
const scale = function (this: { factor: number }, val: number) {
  return val * this.factor;
};
assert(same(map(arr, scale, context), arr.map(scale, context)), "thisArg should be honoured");

// A hole is not undefined: map never calls double for it, so the elements stay numbers
// eslint-disable-next-line no-sparse-arrays -- holes on purpose: map must keep them
const sparse = [1, , 3] as number[];
assert(!(1 in map(sparse, double)), "Holes should stay holes, as in the built-in map");

assert(same(arr, [1, 2, 3, 4]), "Array should not be mutated");
