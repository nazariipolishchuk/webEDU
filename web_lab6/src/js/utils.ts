// js/utils.ts: debounce and safe localStorage access from lab 3, DOM helpers, the API address.

// Runs fn only after the calls stop for delay ms. Args keeps the parameter types of fn.
export const debounce = <Args extends unknown[]>(fn: (...args: Args) => void, delay: number) => {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args): void => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
};

// What localStorage gave back. JSON.parse cannot know the shape, so the value is unknown.
export type Stored =
  { state: "missing" } | { state: "damaged" } | { state: "found"; value: unknown };

export const read = (key: string): Stored => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? { state: "missing" } : { state: "found", value: JSON.parse(raw) };
  } catch (error) {
    // SyntaxError: damaged JSON. DOMException: the browser blocks the storage.
    if (error instanceof SyntaxError || error instanceof DOMException) return { state: "damaged" };
    throw error;
  }
};

export const write = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (error instanceof DOMException) return false; // storage is full or blocked
    throw error;
  }
};

// An element of the page that the script cannot work without. querySelector gives Element | null:
// the check rules out null and narrows Element to the class asked for, such as HTMLInputElement.
export const element = <T extends Element>(
  selector: string,
  type: abstract new () => T,
  root: ParentNode = document,
): T => {
  const node = root.querySelector(selector);
  if (!(node instanceof type)) throw new Error(`${selector} is missing or is not a ${type.name}`);
  return node;
};

// All data from the server reaches the page through textContent, never innerHTML.
// K is a tag name, so createEl("img") gives HTMLImageElement and createEl("li") HTMLLIElement.
export const createEl = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = "",
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

export const createButton = (className: string, text: string): HTMLButtonElement => {
  const button = createEl("button", className, text);
  button.type = "button";
  return button;
};

// The footer shows which API address this build talks to and the mode it was built in
export const showApiAddress = (): void => {
  element("#api-url", HTMLElement).textContent = import.meta.env.VITE_API_URL;
  element("#app-mode", HTMLElement).textContent = import.meta.env.MODE;
};
