// Not a task. console.assert is silent when a check passes, so every task gets its own assert
// that calls console.assert and counts the checks. The totals go to the page and the console.
// In lab 3 the task name came from the call stack, but a bundle puts every task into one file.
interface Tally {
  checks: number;
  failed: number;
}

const results = new Map<string, Tally>();

export type Assert = (condition: boolean, ...message: unknown[]) => void;

export const counter = (task: string): Assert => {
  const row: Tally = { checks: 0, failed: 0 };
  results.set(task, row);
  return (condition, ...message) => {
    row.checks += 1;
    if (!condition) row.failed += 1;
    console.assert(condition, ...message);
  };
};

const addCell = (row: HTMLTableRowElement, text: string) => {
  const cell = document.createElement("td");
  cell.className = "table__cell";
  cell.textContent = text;
  row.append(cell);
};

const report = () => {
  const rows = [...results].map(([task, { checks, failed }]) => ({ task, checks, failed }));
  const checks = rows.reduce((sum, row) => sum + row.checks, 0);
  const failed = rows.reduce((sum, row) => sum + row.failed, 0);
  const summary =
    failed === 0
      ? `All ${checks} checks passed in ${rows.length} tasks`
      : `${failed} of ${checks} checks failed, see the console`;

  console.table(rows);
  console.log(summary);

  const body = document.querySelector<HTMLTableSectionElement>("#results");
  const summaryNode = document.querySelector<HTMLElement>("#summary");
  if (!body || !summaryNode) return;
  body.replaceChildren(
    ...rows.map(({ task, checks: count, failed: bad }) => {
      const row = document.createElement("tr");
      addCell(row, task);
      addCell(row, String(count));
      addCell(row, String(bad));
      return row;
    }),
  );
  summaryNode.textContent = summary;
};

// The debounce and throttle checks finish about 1.5 s after loading
window.addEventListener("load", () => setTimeout(report, 2000));
