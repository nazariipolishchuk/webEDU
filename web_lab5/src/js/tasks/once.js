// Your custom Once
(function () {
  "use strict";

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

  console.assert(addOnce(2, 3) === add(2, 3), "The first call should give the normal result");
  calls = 0;
  console.assert(addOnce(10, 10) === 5, "Later calls should return the first result");
  console.assert(addOnce() === 5, "Arguments of later calls should be ignored");
  console.assert(calls === 0, "The function should not run again");

  let runs = 0;
  const first = once(() => { runs++; });
  const other = once(() => { runs++; });
  first();
  first();
  other();
  console.assert(runs === 2, "Each wrapper should keep its own state");
})();
