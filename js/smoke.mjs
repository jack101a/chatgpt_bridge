// MANUAL END-TO-END SMOKE TEST — do NOT run automatically.
// Requires a live ChatGPT session (the Python daemon must be able to log in).
// Run manually from the repo root:  node js/smoke.mjs

import { ChatGPT } from "./index.js";

const g = new ChatGPT();
console.log(await g.ask("Say OK"));
console.log(await g.generateImage("a red dot"));