import "@testing-library/jest-dom";

// jsdom no implementa scrollIntoView; Radix Select lo llama al abrir el dropdown.
window.HTMLElement.prototype.scrollIntoView = () => {};
