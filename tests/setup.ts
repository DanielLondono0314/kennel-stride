import "@testing-library/jest-dom";

// jsdom no implementa scrollIntoView; Radix Select lo llama al abrir el dropdown.
window.HTMLElement.prototype.scrollIntoView = () => {};

// jsdom no implementa ResizeObserver; Radix Checkbox lo usa para medir su input.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
