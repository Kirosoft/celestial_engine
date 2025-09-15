// Use the Vitest-specific entry to ensure matchers are patched onto Vitest's expect
import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver for React Flow in JSDOM environment
if(typeof (globalThis as any).ResizeObserver === 'undefined'){
	(globalThis as any).ResizeObserver = class {
		callback: any;
		constructor(cb: any){ this.callback = cb; }
		observe(){ /* noop */ }
		unobserve(){ /* noop */ }
		disconnect(){ /* noop */ }
	};
}
