// Your custom Map
(function () {
  "use strict";

  const map = (arr, fn, thisArg) => {
    const result = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      if (i in arr) result[i] = fn.call(thisArg, arr[i], i, arr); // holes stay holes
    }
    return result;
  };

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const arr = [1, 2, 3, 4];
  const double = (val) => val * 2;

  const map01 = arr.map(double);   // built-in map
  const map02 = map(arr, double);  // own implementation

  console.assert(same(map01, map02), "Map01 does not match Map02");
  console.assert(map02.length === arr.length, "Length should not change");
  console.assert(map02 !== arr, "A new array should be returned");
  console.assert(same(map([], double), []), "Empty array should give an empty array");

  const withIndex = (val, i) => val * i;
  console.assert(same(map(arr, withIndex), arr.map(withIndex)), "Index should be passed to the function");

  const seen = [];
  map(arr, (val, i, source) => seen.push(source === arr));
  console.assert(seen.every(Boolean), "Source array should be the third argument");

  const context = { factor: 10 };
  const scale = function (val) { return val * this.factor; };
  console.assert(same(map(arr, scale, context), arr.map(scale, context)), "thisArg should be honoured");

  const sparse = [1, , 3];
  console.assert(!(1 in map(sparse, double)), "Holes should stay holes, as in the built-in map");

  console.assert(same(arr, [1, 2, 3, 4]), "Array should not be mutated");
})();
