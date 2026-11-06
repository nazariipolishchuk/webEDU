// Your custom DeepClone
(function () {
  "use strict";

  // seen maps every source object to its copy: this is what makes cycles safe
  const deepClone = (value, seen = new WeakMap()) => {
    if (value === null || typeof value !== "object") return value; // primitives and functions
    if (seen.has(value)) return seen.get(value);

    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);

    if (value instanceof Map) {
      const copy = new Map();
      seen.set(value, copy);
      value.forEach((val, key) => copy.set(deepClone(key, seen), deepClone(val, seen)));
      return copy;
    }

    if (value instanceof Set) {
      const copy = new Set();
      seen.set(value, copy);
      value.forEach((val) => copy.add(deepClone(val, seen)));
      return copy;
    }

    const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
    seen.set(value, copy);
    for (const key of Reflect.ownKeys(value)) {
      copy[key] = deepClone(value[key], seen);
    }
    return copy;
  };

  const source = { id: 1, nested: { list: [1, { deep: true }, [2, 3]] }, title: "scan" };
  const snapshot = JSON.stringify(source);

  const clone01 = structuredClone(source); // built-in deep copy
  const clone = deepClone(source);         // own implementation

  console.assert(JSON.stringify(clone) === JSON.stringify(clone01), "Clone does not match structuredClone");
  console.assert(JSON.stringify(clone) === snapshot, "String forms of the source and the copy should match");
  console.assert(clone !== source, "The copy should be a new object");
  console.assert(clone.nested !== source.nested, "Nested objects should be copied");
  console.assert(clone.nested.list !== source.nested.list, "Nested arrays should be copied");
  console.assert(clone.nested.list[1] !== source.nested.list[1], "Objects inside arrays should be copied");

  clone.title = "changed";
  clone.nested.list[1].deep = false;
  clone.nested.list.push(99);
  console.assert(JSON.stringify(source) === snapshot, "Changing the copy should not affect the source");

  // Values that a JSON.stringify comparison cannot tell apart
  const rich = {
    created: new Date(0),
    tags: new Map([["modality", { name: "xray" }]]),
    codes: new Set([1, 2]),
    missing: undefined,
    pattern: /scan/gi,
  };
  const richClone = deepClone(rich);
  const richBuiltIn = structuredClone(rich);

  console.assert(richClone.created instanceof Date, "Date should stay a Date");
  console.assert(richClone.created !== rich.created, "Date should be a new object");
  console.assert(richClone.created.getTime() === richBuiltIn.created.getTime(), "Date value should match");
  console.assert(richClone.tags instanceof Map, "Map should stay a Map");
  console.assert(richClone.tags.get("modality").name === "xray", "Map values should be copied");
  console.assert(richClone.tags.get("modality") !== rich.tags.get("modality"), "Map values should be deep copies");
  console.assert(richClone.codes instanceof Set && richClone.codes.has(2), "Set should stay a Set");
  console.assert("missing" in richClone && richClone.missing === undefined, "undefined properties should be kept");
  console.assert(richClone.pattern.flags === rich.pattern.flags, "RegExp flags should be kept");

  // Decided behaviour on a cycle: the copy has the same cycle, as with structuredClone
  const cyclic = { name: "root", child: {} };
  cyclic.child.parent = cyclic;
  const cyclicClone = deepClone(cyclic);
  const cyclicBuiltIn = structuredClone(cyclic);

  let jsonError = "";
  try {
    JSON.stringify(cyclic);
  } catch (error) {
    jsonError = error.name;
  }
  console.assert(jsonError === "TypeError", "JSON.stringify should reject a cycle, so it cannot check this case");
  console.assert(cyclicClone !== cyclic, "The cyclic copy should be a new object");
  console.assert(cyclicClone.child.parent === cyclicClone, "The cycle should point at the copy");
  console.assert(cyclicBuiltIn.child.parent === cyclicBuiltIn, "structuredClone should behave the same way");

  // Difference from structuredClone: functions are shared instead of rejected
  const withFunction = { run() { return 1; } };
  console.assert(deepClone(withFunction).run === withFunction.run, "Functions should be shared by reference");
  let builtInError = "";
  try {
    structuredClone(withFunction);
  } catch (error) {
    builtInError = error.name;
  }
  console.assert(builtInError === "DataCloneError", "structuredClone should reject functions");

  console.assert(deepClone(null) === null && deepClone(5) === 5, "Primitives should be returned as they are");
})();
