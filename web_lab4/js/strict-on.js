// js/strict-on.js: runs in strict mode. js/strict-off.js is the same code without the directive.
(function () {
  "use strict";

  const output = document.querySelector("#strict-on");

  const show = (label, result) => {
    console.log(`[strict] ${label} → ${result}`);
    const row = document.createElement("li");
    row.className = "trials__row";
    row.textContent = `${label} → ${result}`;
    output.append(row);
  };

  const check = (label, fn) => {
    try {
      show(label, String(fn()));
    } catch (error) {
      show(label, `${error.name}: ${error.message}`);
    }
  };

  // Runtime differences
  check("assign to an undeclared variable", () => { undeclared = 1; return undeclared; });
  check("this in a plain function call", function () { return String(this); });

  const frozen = Object.freeze({ a: 1 });
  check("write to a frozen object", () => { frozen.a = 2; return frozen.a; });

  const closed = Object.preventExtensions({});
  check("add a property to a non-extensible object", () => { closed.a = 1; return closed.a; });

  const getterOnly = { get a() { return 1; } };
  check("write to a getter-only property", () => { getterOnly.a = 2; return getterOnly.a; });

  check("delete a non-configurable property", () => delete Object.prototype);

  check("change a parameter, read arguments", () => (function (a) { a = 2; return arguments[0]; })(1));

  check("declare a variable inside eval", () => { eval("var leaked = 1"); return typeof leaked; });

  // Parse errors: the string is compiled at run time, so try…catch can see the exception.
  // new Function does not inherit the mode, so the directive goes into the string itself.
  check("with statement", () => new Function('"use strict"; with (Math) return PI;')());
  check("octal literal 010", () => new Function('"use strict"; return 010;')());
  check("duplicate parameter names", () => new Function("a", "a", '"use strict"; return a;')(1, 2));
  check("delete a variable", () => new Function('"use strict"; var a = 1; return delete a;')());
  check("eval as a variable name", () => new Function('"use strict"; var eval = 1; return eval;')());

  // Do not let the other file see this global: a leak would hide the difference
  delete window.undeclared;
})();
