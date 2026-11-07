// Your custom Find
import { counter } from "./assert-counter.ts";

const assert = counter("find");

// T | undefined: the caller has to handle "nothing found" before using the element
const find = <T, This = undefined>(
  arr: readonly T[],
  fn: (this: This, value: T, index: number, array: readonly T[]) => unknown,
  thisArg?: This,
): T | undefined => {
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i] as T; // find visits holes too and passes undefined, as the built-in does
    if (fn.call(thisArg as This, value, i, arr)) return value;
  }
  return undefined;
};

interface Item {
  id: number;
  price: number;
}

const arr: Item[] = [
  { id: 1, price: 250 },
  { id: 2, price: 1200 },
  { id: 3, price: 1200 },
];
const expensive = (item: Item) => item.price > 1000;
const snapshot = JSON.stringify(arr);

const find01 = arr.find(expensive); // built-in find
const find02 = find(arr, expensive); // own implementation

assert(find01 === find02, "Find01 does not match Find02");
assert(find02?.id === 2, "The first match should be returned");
assert(find02 === arr[1], "The element itself should be returned, not a copy");

const missing = (item: Item) => item.price > 5000;
assert(find(arr, missing) === undefined, "No match should give undefined");
assert(find(arr, missing) === arr.find(missing), "No match should agree with the built-in");
assert(find([], expensive) === undefined, "Empty array should give undefined");

let calls = 0;
find(arr, (item) => {
  calls++;
  return item.id === 1;
});
assert(calls === 1, "Search should stop at the first match");

assert(find([3, 0, 5], (val) => val === 0) === 0, "A falsy element should still be found");
assert(find(arr, (_item, i) => i === 2) === arr[2], "Index should be passed to the function");

assert(JSON.stringify(arr) === snapshot, "Array should not be mutated");
