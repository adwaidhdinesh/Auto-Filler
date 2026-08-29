// Browser entry point for Phase 2: exposes the analyzer to the popup page.
// This is plain JS on purpose (a module script inside popup.html); the
// Phase 2 pipeline lives in TypeScript and is compiled to phase2/dist by
// `npm run build`.
import { analyzeForm, ANALYZER_VERSION } from "./phase2/dist/index.js";

window.AutoFiller = {
  analyzeForm,
  version: ANALYZER_VERSION,
};