// Your custom Filter
import { counter } from "./assert-counter.ts";

const assert = counter("filter");

// unknown result: any truthy value keeps the element, as in the built-in filter
const filter = <T, This = undefined>(
  arr: readonly T[],
  fn: (this: This, value: T, index: number, array: readonly T[]) => unknown,
  thisArg?: This,
): T[] => {
  const result: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i] as T; // a hole reads as undefined, and i in arr skips it below
    if (i in arr && fn.call(thisArg as This, value, i, arr)) result.push(value);
  }
  return result;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const arr = [1, 2, 3, 4, 5, 6];
const isEven = (val: number) => val % 2 === 0;

const filter01 = arr.filter(isEven); // built-in filter
const filter02 = filter(arr, isEven); // own implementation

assert(same(filter01, filter02), "Filter01 does not match Filter02");
assert(filter02 !== arr, "A new array should be returned");

assert(
  same(
    filter(arr, () => false),
    [],
  ),
  "No match should give an empty array",
);
const all = filter(arr, () => true);
assert(same(all, arr) && all !== arr, "All match should give an equal copy, not the same array");
assert(same(filter([], isEven), []), "Empty array should give an empty array");

const atEvenIndex = (_val: number, i: number) => i % 2 === 0;
assert(
  same(filter(arr, atEvenIndex), arr.filter(atEvenIndex)),
  "Index should be passed to the function",
);

const truthy = [0, "", null, 1, "a", undefined, NaN];
assert(
  same(filter(truthy, Boolean), truthy.filter(Boolean)),
  "Any truthy result should keep the element",
);

assert(same(arr, [1, 2, 3, 4, 5, 6]), "Array should not be mutated");
