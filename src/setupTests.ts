// jest-dom adds custom matchers for asserting on DOM nodes.
import "@testing-library/jest-dom";

window.matchMedia =
  window.matchMedia ||
  function matchMediaPolyfill(
    query: string
  ): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
