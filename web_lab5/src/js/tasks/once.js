// Your custom Once
import { counter } from "./assert-counter.js";

const assert = counter("once");

const once = (fn) => {
  let called = false;
  let result;
  return (...args) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
};

let calls = 0;
const add = (a, b) => {
  calls++;
  return a + b;
};
const addOnce = once(add);

assert(addOnce(2, 3) === add(2, 3), "The first call should give the normal result");
calls = 0;
assert(addOnce(10, 10) === 5, "Later calls should return the first result");
assert(addOnce() === 5, "Arguments of later calls should be ignored");
assert(calls === 0, "The function should not run again");

let runs = 0;
const first = once(() => {
  runs++;
});
const other = once(() => {
  runs++;
});
first();
first();
other();
assert(runs === 2, "Each wrapper should keep its own state");
