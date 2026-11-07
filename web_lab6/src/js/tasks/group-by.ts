// Your custom GroupBy
import { counter } from "./assert-counter.ts";

const assert = counter("group-by");

// K extends PropertyKey: only a string, a number or a symbol can be the name of a group.
// Partial: a key that no element gave has no group. The built-in Object.groupBy has this type too.
const groupBy = <T, K extends PropertyKey>(
  arr: readonly T[],
  keyFn: (value: T, index: number) => K,
): Partial<Record<K, T[]>> => {
  const groups = Object.create(null) as Partial<Record<K, T[]>>; // no inherited keys such as "constructor"
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i] as T;
    (groups[keyFn(value, i)] ??= []).push(value);
  }
  return groups;
};

interface Item {
  code: string;
  status: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const arr: Item[] = [
  { code: "CXR", status: "ready" },
  { code: "ECG", status: "collecting" },
  { code: "RET", status: "ready" },
];
const snapshot = JSON.stringify(arr);
const byStatus = (item: Item) => item.status;

const group01 = Object.groupBy(arr, byStatus); // built-in groupBy
const group02 = groupBy(arr, byStatus); // own implementation

assert(same(group01, group02), "Group01 does not match Group02");
assert(group02.ready?.length === 2, "Elements with one key should share a group");
assert(group02.ready?.[0] === arr[0], "Groups should hold the elements themselves");
assert(same(groupBy([], byStatus), {}), "Empty array should give an empty object");
assert(
  same(
    groupBy(arr, (_item, i) => i % 2),
    Object.groupBy(arr, (_item, i) => i % 2),
  ),
  "Index should be passed",
);
assert(
  groupBy(["a"], () => "constructor").constructor?.length === 1,
  "Inherited names should work as keys",
);
assert(JSON.stringify(arr) === snapshot, "Array should not be mutated");
