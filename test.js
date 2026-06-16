// /WC_Common/test.js

console.log("✅ test.js loaded from WC_Common");

function testFunction() {
    return "Hello from WC_Common/test.js";
}

// attach to window so HTML can call it
window.testFunction = testFunction;
``
