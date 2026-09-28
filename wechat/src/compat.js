// esbuild handles syntax; these collection helpers need runtime polyfills.
if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value(index) { index = Math.trunc(index) || 0; return this[index < 0 ? this.length + index : index]; }, configurable: true, writable: true });
if (!Array.prototype.flat) Object.defineProperty(Array.prototype, 'flat', { value(depth = 1) { return depth > 0 ? this.reduce((out, value) => out.concat(Array.isArray(value) ? value.flat(depth - 1) : value), []) : this.slice(); }, configurable: true, writable: true });
if (!Array.prototype.flatMap) Object.defineProperty(Array.prototype, 'flatMap', { value(fn, that) { return this.map(fn, that).flat(); }, configurable: true, writable: true });
if (!Object.fromEntries) Object.fromEntries = entries => { const out = {}; for (const [key, value] of entries) Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true }); return out; };
