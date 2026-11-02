// Not a task. console.assert is silent when a check passes, so this file counts
// the calls per task file and prints the totals on the page and in the console.
(function () {
  "use strict";

  const nativeAssert = console.assert.bind(console);
  const results = new Map();

  // Stack: Error, callerFile, console.assert, the line of the task that called it
  const callerFile = () => {
    const line = new Error().stack.split("\n")[3] ?? "";
    return line.match(/([\w-]+)\.js/)?.[1] ?? "unknown";
  };

  console.assert = (condition, ...message) => {
    const file = callerFile();
    const row = results.get(file) ?? { checks: 0, failed: 0 };
    row.checks += 1;
    if (!condition) row.failed += 1;
    results.set(file, row);
    nativeAssert(condition, ...message);
  };

  const addCell = (row, text) => {
    const cell = document.createElement("td");
    cell.className = "table__cell";
    cell.textContent = text;
    row.append(cell);
  };

  const report = () => {
    const rows = [...results].map(([task, { checks, failed }]) => ({ task, checks, failed }));
    const checks = rows.reduce((sum, row) => sum + row.checks, 0);
    const failed = rows.reduce((sum, row) => sum + row.failed, 0);
    const summary = failed === 0
      ? `All ${checks} checks passed in ${rows.length} tasks`
      : `${failed} of ${checks} checks failed, see the console`;

    console.table(rows);
    console.log(summary);

    const body = document.querySelector("#results");
    body.replaceChildren(...rows.map(({ task, checks: count, failed: bad }) => {
      const row = document.createElement("tr");
      addCell(row, task);
      addCell(row, String(count));
      addCell(row, String(bad));
      return row;
    }));
    document.querySelector("#summary").textContent = summary;
  };

  // The debounce and throttle checks finish about 1.5 s after loading
  window.addEventListener("load", () => setTimeout(report, 2000));
})();
