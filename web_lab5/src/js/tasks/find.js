// Your custom Find
import { counter } from "./assert-counter.js";

const assert = counter("find");

const find = (arr, fn, thisArg) => {
  for (let i = 0; i < arr.length; i++) {
    if (fn.call(thisArg, arr[i], i, arr)) return arr[i];
  }
  return undefined;
};

const arr = [
  { id: 1, price: 250 },
  { id: 2, price: 1200 },
  { id: 3, price: 1200 },
];
const expensive = (item) => item.price > 1000;
const snapshot = JSON.stringify(arr);

const find01 = arr.find(expensive);   // built-in find
const find02 = find(arr, expensive);  // own implementation

assert(find01 === find02, "Find01 does not match Find02");
assert(find02.id === 2, "The first match should be returned");
assert(find02 === arr[1], "The element itself should be returned, not a copy");

const missing = (item) => item.price > 5000;
assert(find(arr, missing) === undefined, "No match should give undefined");
assert(find(arr, missing) === arr.find(missing), "No match should agree with the built-in");
assert(find([], expensive) === undefined, "Empty array should give undefined");

let calls = 0;
find(arr, (item) => { calls++; return item.id === 1; });
assert(calls === 1, "Search should stop at the first match");

assert(find([3, 0, 5], (val) => val === 0) === 0, "A falsy element should still be found");
assert(find(arr, (item, i) => i === 2) === arr[2], "Index should be passed to the function");

assert(JSON.stringify(arr) === snapshot, "Array should not be mutated");
