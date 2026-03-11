// Entry point for pi extension auto-discovery.
// Pi looks for ~/.pi/agent/extensions/*/index.ts — this re-exports the extension.
export { default } from "./extension/index.js";
