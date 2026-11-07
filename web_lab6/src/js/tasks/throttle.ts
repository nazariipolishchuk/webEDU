// Your custom Throttle
import { counter } from "./assert-counter.ts";

const assert = counter("throttle");

const throttle = <Args extends unknown[]>(fn: (...args: Args) => void, interval: number) => {
  let last = -Infinity; // time of the last run, ms
  return (...args: Args): void => {
    const now = performance.now();
    if (now - last < interval) return; // the interval has not passed: skip
    last = now;
    fn(...args);
  };
};

// Timeline from section 3.7. The interval is 250 ms, not 300: the event at 300 ms
// must not be lost to timer jitter, and the result is the same three calls.
const moments = [0, 100, 200, 300, 400, 900];
const received: number[] = [];
const wrapped = throttle((value: number) => received.push(value), 250);

wrapped(0);
assert(received.length === 1, "The first call should run at once");
moments.slice(1).forEach((moment) => setTimeout(() => wrapped(moment), moment));

setTimeout(() => {
  assert(received.length === 3, "Throttle should give 3 calls for this series");
  assert(received.join() === "0,300,900", "Calls at 100, 200 and 400 ms should be skipped");
}, 1200);
