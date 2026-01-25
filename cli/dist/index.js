"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = void 0;
exports.createProgram = createProgram;
const commander_1 = require("commander");
const auth_js_1 = require("./commands/auth.js");
const vault_js_1 = require("./commands/vault.js");
const query_js_1 = require("./commands/query.js");
const config_js_1 = require("./commands/config.js");
const output = __importStar(require("./lib/output.js"));
const api_client_js_1 = require("./lib/api-client.js");
const config_store_js_1 = require("./lib/config-store.js");
const VERSION = '0.1.0';
exports.VERSION = VERSION;
function createProgram() {
    const program = new commander_1.Command();
    program
        .name('ragbox')
        .description('RAGbox CLI - Your Files Speak. We Make Them Testify.')
        .version(VERSION, '-V, --version', 'Output the version number');
    // Global options
    program
        .option('--json', 'Output in JSON format')
        .option('--verbose', 'Enable verbose output');
    // Add subcommands
    program.addCommand((0, auth_js_1.createAuthCommand)());
    program.addCommand((0, vault_js_1.createVaultCommand)());
    program.addCommand((0, query_js_1.createQueryCommand)());
    program.addCommand((0, config_js_1.createConfigCommand)());
    // Health check command
    program
        .command('health')
        .description('Check API server health')
        .action(async () => {
        const config = (0, config_store_js_1.getConfig)();
        output.info(`Checking API at ${config.apiUrl}...`);
        try {
            const health = await (0, api_client_js_1.healthCheck)();
            output.success('API is healthy');
            output.keyValue([
                ['Status', health.status],
                ['Version', health.version],
            ]);
        }
        catch (err) {
            output.error('API health check failed');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            else if (err instanceof Error) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    // Info command
    program
        .command('info')
        .description('Show CLI information')
        .action(() => {
        output.brand();
        const config = (0, config_store_js_1.getConfig)();
        output.keyValue([
            ['CLI Version', VERSION],
            ['API URL', config.apiUrl],
            ['Config File', '~/.config/ragbox-cli/config.json'],
        ]);
    });
    return program;
}
//# sourceMappingURL=index.js.map