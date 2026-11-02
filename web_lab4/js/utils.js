// js/utils.js: debounce and safe localStorage access from lab 3, the same code as module exports.
// The classic scripts of lab 3 keep them private, so they stay untouched.

// Runs fn only after the calls stop for delay ms
export const debounce = (fn, delay) => {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
};

export const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? { missing: true } : { value: JSON.parse(raw) };
  } catch (error) {
    // SyntaxError: damaged JSON. DOMException: the browser blocks the storage.
    if (error instanceof SyntaxError || error instanceof DOMException) return { damaged: true };
    throw error;
  }
};

export const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (error instanceof DOMException) return false; // storage is full or blocked
    throw error;
  }
};

// All data from the server reaches the page through textContent, never innerHTML
export const createEl = (tag, className, text = "") => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

export const createButton = (className, text) => {
  const button = createEl("button", className, text);
  button.type = "button";
  return button;
};
