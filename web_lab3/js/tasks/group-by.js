// Your custom GroupBy
(function () {
  "use strict";

  const groupBy = (arr, keyFn) => {
    const groups = Object.create(null); // no inherited keys such as "constructor"
    for (let i = 0; i < arr.length; i++) {
      const key = keyFn(arr[i], i);
      (groups[key] ??= []).push(arr[i]);
    }
    return groups;
  };

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const arr = [
    { code: "CXR", status: "ready" },
    { code: "ECG", status: "collecting" },
    { code: "RET", status: "ready" },
  ];
  const snapshot = JSON.stringify(arr);
  const byStatus = (item) => item.status;

  const group01 = Object.groupBy(arr, byStatus);  // built-in groupBy
  const group02 = groupBy(arr, byStatus);         // own implementation

  console.assert(same(group01, group02), "Group01 does not match Group02");
  console.assert(group02.ready.length === 2, "Elements with one key should share a group");
  console.assert(group02.ready[0] === arr[0], "Groups should hold the elements themselves");
  console.assert(same(groupBy([], byStatus), {}), "Empty array should give an empty object");
  console.assert(same(groupBy(arr, (item, i) => i % 2), Object.groupBy(arr, (item, i) => i % 2)), "Index should be passed");
  console.assert(groupBy(["a"], () => "constructor").constructor.length === 1, "Inherited names should work as keys");
  console.assert(JSON.stringify(arr) === snapshot, "Array should not be mutated");
})();
