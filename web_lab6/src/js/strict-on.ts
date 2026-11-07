// js/strict-on.ts: runs in strict mode. public/js/strict-off.js is the same code without the directive.
// TypeScript rejects most of these actions before the run. Each such line carries @ts-expect-error:
// the page has to perform the action to show what strict mode does with it at run time.
(function () {
  "use strict";

  const output = document.querySelector<HTMLOListElement>("#strict-on");
  if (!output) return;

  const show = (label: string, result: string) => {
    console.log(`[strict] ${label} → ${result}`);
    const row = document.createElement("li");
    row.className = "trials__row";
    row.textContent = `${label} → ${result}`;
    output.append(row);
  };

  const check = (label: string, fn: () => unknown) => {
    try {
      show(label, String(fn()));
    } catch (error) {
      show(label, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    }
  };

  // Runtime differences
  // The check is what assigning an undeclared variable does
  check("assign to an undeclared variable", () => {
    // @ts-expect-error TS2304: the name is declared nowhere, which is the point of the check
    undeclared = 1;
    // @ts-expect-error TS2304: the same name, read back
    return undeclared;
  });
  check("this in a plain function call", function (this: unknown) {
    return String(this);
  });

  const frozen = Object.freeze({ a: 1 });
  check("write to a frozen object", () => {
    // @ts-expect-error TS2540: Object.freeze gives Readonly<T>, so a is read-only
    frozen.a = 2;
    return frozen.a;
  });

  const closed: Record<string, number> = Object.preventExtensions({});
  check("add a property to a non-extensible object", () => {
    closed.a = 1;
    return closed.a;
  });

  const getterOnly = {
    get a() {
      return 1;
    },
  };
  check("write to a getter-only property", () => {
    // @ts-expect-error TS2540: a getter without a setter is a read-only property
    getterOnly.a = 2;
    return getterOnly.a;
  });

  // @ts-expect-error TS2704: Object.prototype is read-only, so delete cannot take it
  check("delete a non-configurable property", () => delete Object.prototype);

  check("change a parameter, read arguments", () =>
    (function (_a: number) {
      _a = 2;
      // eslint-disable-next-line prefer-rest-params -- the check is whether arguments follows the parameter
      return arguments[0] as unknown;
    })(1),
  );

  check("declare a variable inside eval", () => {
    eval("var leaked = 1");
    // @ts-expect-error TS2304: leaked exists only inside the string given to eval
    return typeof leaked;
  });

  // Parse errors: the string is compiled at run time, so try…catch can see the exception.
  // new Function does not inherit the mode, so the directive goes into the string itself.
  // The strings are fixed text of this file, nothing from the user gets into them.
  const compile = (...parts: string[]) =>
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- compiling at run time is the check
    new Function(...parts) as (...args: unknown[]) => unknown;

  check("with statement", () => compile('"use strict"; with (Math) return PI;')());
  check("octal literal 010", () => compile('"use strict"; return 010;')());
  check("duplicate parameter names", () => compile("a", "a", '"use strict"; return a;')(1, 2));
  check("delete a variable", () => compile('"use strict"; var a = 1; return delete a;')());
  check("eval as a variable name", () => compile('"use strict"; var eval = 1; return eval;')());

  // Do not let the other file see this global: a leak would hide the difference
  Reflect.deleteProperty(window, "undeclared");
})();
