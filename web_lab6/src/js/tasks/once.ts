// Your custom Once
import { counter } from "./assert-counter.ts";

const assert = counter("once");

// Before the first call there is no result yet; after it there is one. The union says exactly that.
type Memo<R> = { called: false } | { called: true; result: R };

// Args and R keep the parameter and the result types of fn in the wrapper
const once = <Args extends unknown[], R>(fn: (...args: Args) => R): ((...args: Args) => R) => {
  let memo: Memo<R> = { called: false };
  return (...args) => {
    if (!memo.called) memo = { called: true, result: fn(...args) };
    return memo.result;
  };
};

let calls = 0;
const add = (a: number, b: number) => {
  calls++;
  return a + b;
};
const addOnce = once(add);

assert(addOnce(2, 3) === add(2, 3), "The first call should give the normal result");
calls = 0;
assert(addOnce(10, 10) === 5, "Later calls should return the first result");
// @ts-expect-error TS2554: the wrapper keeps both parameters of add, the check leaves them out on purpose
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
