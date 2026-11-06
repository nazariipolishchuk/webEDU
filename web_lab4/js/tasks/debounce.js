// Your custom Debounce
(function () {
  "use strict";

  const debounce = (fn, delay) => {
    let timerId;                              // shared by all calls of the wrapper
    return (...args) => {
      clearTimeout(timerId);                  // cancel the call planned earlier
      timerId = setTimeout(() => fn(...args), delay);
    };
  };

  // Timeline from section 3.7: events at 0, 100, 200, 300, 400 and 900 ms
  const moments = [0, 100, 200, 300, 400, 900];
  const received = [];
  const wrapped = debounce((value) => received.push(value), 300);

  moments.forEach((moment) => setTimeout(() => wrapped(moment), moment));

  setTimeout(() => {
    console.assert(received.length === 0, "Nothing should run during the series");
  }, 600);
  setTimeout(() => {
    console.assert(received.length === 1, "One call should run after the pause, near 700 ms");
    console.assert(received[0] === 400, "The arguments of the last call should be used");
  }, 1000);
  setTimeout(() => {
    console.assert(received.length === 2, "Debounce should give 2 calls for this series");
    console.assert(received[1] === 900, "The second call should get the last event");
  }, 1500);
})();
