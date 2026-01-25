#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
const program = (0, index_js_1.createProgram)();
// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
    console.error('Unexpected error:', error.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});
// Parse command line arguments
program.parseAsync(process.argv).catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
//# sourceMappingURL=ragbox.js.map