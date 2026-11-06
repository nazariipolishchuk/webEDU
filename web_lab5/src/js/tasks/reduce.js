// Your custom Reduce
(function () {
  "use strict";

  // Rest parameter: it tells "no initial value" apart from an explicit undefined
  const reduce = (arr, fn, ...initial) => {
    let i = 0;
    let retValue;

    if (initial.length > 0) {
      retValue = initial[0];
    } else {
      while (i < arr.length && !(i in arr)) i++;
      if (i >= arr.length) throw new TypeError("Reduce of empty array with no initial value");
      retValue = arr[i++];
    }

    for (; i < arr.length; i++) {
      if (i in arr) retValue = fn(retValue, arr[i], i, arr);
    }
    return retValue;
  };

  const errorName = (run) => {
    try {
      run();
      return "no error";
    } catch (error) {
      return error.name;
    }
  };

  const arr = [1, 2, 3, 4];
  const sum = (accumulator, val) => accumulator + val;
  const subtract = (accumulator, val) => accumulator - val;

  const sum01 = arr.reduce(sum, 0);   // built-in reduce
  const sum02 = reduce(arr, sum, 0);  // own implementation

  console.assert(sum01 === sum02, "Sum01 does not match Sum02");
  console.assert(reduce(arr, sum, 10) === arr.reduce(sum, 10), "Initial value should be used");
  console.assert(reduce(arr, sum) === arr.reduce(sum), "Without an initial value the first element is the start");
  console.assert(reduce(arr, subtract) === arr.reduce(subtract), "Order of folding should match the built-in");

  console.assert(reduce([], sum, 7) === [].reduce(sum, 7), "Empty array should return the initial value");
  console.assert(
    errorName(() => reduce([], sum)) === errorName(() => [].reduce(sum)),
    "Empty array without an initial value should throw TypeError",
  );

  let calls = 0;
  const one = reduce([5], () => { calls++; return 0; });
  console.assert(one === 5 && calls === 0, "One element and no initial value should not call the function");
  console.assert(reduce(arr, (acc) => acc, undefined) === undefined, "Explicit undefined counts as an initial value");

  const indexes = [];
  reduce(arr, (acc, val, i) => { indexes.push(i); return acc; });
  console.assert(indexes.join() === "1,2,3", "Index should start from 1 without an initial value");

  console.assert(JSON.stringify(arr) === JSON.stringify([1, 2, 3, 4]), "Array should not be mutated");
})();
