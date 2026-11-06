// js/strict-off.js: runs in sloppy mode. js/strict-on.js is the same code with the directive.
(function () {
  const output = document.querySelector("#strict-off");

  const show = (label, result) => {
    console.log(`[sloppy] ${label} → ${result}`);
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
  // The check is what assigning an undeclared variable does
  /* eslint-disable no-undef */
  check("assign to an undeclared variable", () => {
    undeclared = 1;
    return undeclared;
  });
  /* eslint-enable no-undef */
  check("this in a plain function call", function () {
    return String(this);
  });

  const frozen = Object.freeze({ a: 1 });
  check("write to a frozen object", () => {
    frozen.a = 2;
    return frozen.a;
  });

  const closed = Object.preventExtensions({});
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
    getterOnly.a = 2;
    return getterOnly.a;
  });

  check("delete a non-configurable property", () => delete Object.prototype);

  check("change a parameter, read arguments", () =>
    (function (a) {
      // eslint-disable-next-line no-unused-vars -- the check is whether arguments follows the parameter
      a = 2;
      return arguments[0];
    })(1),
  );

  check("declare a variable inside eval", () => {
    eval("var leaked = 1");
    return typeof leaked;
  });

  // Parse errors do not happen here: the same strings are valid in sloppy mode
  check("with statement", () => new Function("with (Math) return PI;")());
  check("octal literal 010", () => new Function("return 010;")());
  check("duplicate parameter names", () => new Function("a", "a", "return a;")(1, 2));
  check("delete a variable", () => new Function("var a = 1; return delete a;")());
  check("eval as a variable name", () => new Function("var eval = 1; return eval;")());

  // The first check created a real global variable: remove it after showing the effect
  delete window.undeclared;
})();
