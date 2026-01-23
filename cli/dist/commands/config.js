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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfigCommand = createConfigCommand;
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const config_store_js_1 = require("../lib/config-store.js");
const output = __importStar(require("../lib/output.js"));
const CONFIG_KEYS = [
    'apiUrl',
    'defaultVaultId',
    'outputFormat',
    'verbose',
];
const CONFIG_DESCRIPTIONS = {
    apiUrl: 'API server URL (default: http://localhost:3000)',
    authToken: 'Authentication token (managed by auth commands)',
    defaultVaultId: 'Default vault ID for commands',
    outputFormat: 'Output format: json, table, or plain',
    verbose: 'Enable verbose output',
};
function createConfigCommand() {
    const config = new commander_1.Command('config')
        .description('Manage CLI configuration');
    config
        .command('list')
        .alias('ls')
        .description('List all configuration values')
        .action(() => {
        const cfg = (0, config_store_js_1.getConfig)();
        output.subheader('Configuration');
        output.keyValue([
            ['API URL', cfg.apiUrl],
            ['Default Vault', cfg.defaultVaultId],
            ['Output Format', cfg.outputFormat],
            ['Verbose', String(cfg.verbose)],
            ['Authenticated', cfg.authToken ? 'Yes' : 'No'],
        ]);
        console.log();
        output.info(`Config file: ${(0, config_store_js_1.getConfigPath)()}`);
    });
    config
        .command('get <key>')
        .description('Get a configuration value')
        .action((key) => {
        if (!CONFIG_KEYS.includes(key)) {
            output.error(`Unknown config key: ${key}`);
            output.info(`Valid keys: ${CONFIG_KEYS.join(', ')}`);
            process.exit(1);
        }
        const value = (0, config_store_js_1.getConfigValue)(key);
        if (value === undefined) {
            output.info(`${key}: (not set)`);
        }
        else {
            output.info(`${key}: ${value}`);
        }
    });
    config
        .command('set <key> <value>')
        .description('Set a configuration value')
        .action((key, value) => {
        if (!CONFIG_KEYS.includes(key)) {
            output.error(`Unknown config key: ${key}`);
            output.info(`Valid keys: ${CONFIG_KEYS.join(', ')}`);
            process.exit(1);
        }
        // Validate specific keys
        if (key === 'outputFormat') {
            const validFormats = ['json', 'table', 'plain'];
            if (!validFormats.includes(value)) {
                output.error(`Invalid output format. Valid values: ${validFormats.join(', ')}`);
                process.exit(1);
            }
        }
        if (key === 'verbose') {
            const boolValue = value.toLowerCase();
            if (!['true', 'false', '1', '0', 'yes', 'no'].includes(boolValue)) {
                output.error('Verbose must be true/false');
                process.exit(1);
            }
            const parsedValue = ['true', '1', 'yes'].includes(boolValue);
            (0, config_store_js_1.setConfig)('verbose', parsedValue);
            output.success(`${key} = ${parsedValue}`);
            return;
        }
        if (key === 'apiUrl') {
            try {
                new URL(value);
            }
            catch {
                output.error('Invalid URL format');
                process.exit(1);
            }
        }
        (0, config_store_js_1.setConfig)(key, value);
        output.success(`${key} = ${value}`);
    });
    config
        .command('unset <key>')
        .description('Remove a configuration value')
        .action((key) => {
        if (!CONFIG_KEYS.includes(key)) {
            output.error(`Unknown config key: ${key}`);
            output.info(`Valid keys: ${CONFIG_KEYS.join(', ')}`);
            process.exit(1);
        }
        if (key === 'authToken') {
            output.error('Use `ragbox auth logout` to clear authentication');
            process.exit(1);
        }
        (0, config_store_js_1.setConfig)(key, undefined);
        output.success(`${key} unset`);
    });
    config
        .command('reset')
        .description('Reset all configuration to defaults')
        .action(async () => {
        const { confirm } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'This will reset all configuration including authentication. Continue?',
                default: false,
            },
        ]);
        if (confirm) {
            (0, config_store_js_1.resetConfig)();
            output.success('Configuration reset to defaults.');
        }
        else {
            output.info('Reset cancelled.');
        }
    });
    config
        .command('path')
        .description('Show configuration file path')
        .action(() => {
        output.info((0, config_store_js_1.getConfigPath)());
    });
    config
        .command('edit')
        .description('Open configuration in interactive editor')
        .action(async () => {
        const cfg = (0, config_store_js_1.getConfig)();
        const answers = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'apiUrl',
                message: 'API URL:',
                default: cfg.apiUrl,
                validate: (input) => {
                    try {
                        new URL(input);
                        return true;
                    }
                    catch {
                        return 'Please enter a valid URL';
                    }
                },
            },
            {
                type: 'input',
                name: 'defaultVaultId',
                message: 'Default Vault ID (leave empty for none):',
                default: cfg.defaultVaultId || '',
            },
            {
                type: 'list',
                name: 'outputFormat',
                message: 'Output Format:',
                choices: ['table', 'json', 'plain'],
                default: cfg.outputFormat,
            },
            {
                type: 'confirm',
                name: 'verbose',
                message: 'Enable verbose output:',
                default: cfg.verbose,
            },
        ]);
        (0, config_store_js_1.setConfig)('apiUrl', answers.apiUrl);
        (0, config_store_js_1.setConfig)('defaultVaultId', answers.defaultVaultId || undefined);
        (0, config_store_js_1.setConfig)('outputFormat', answers.outputFormat);
        (0, config_store_js_1.setConfig)('verbose', answers.verbose);
        output.success('Configuration updated.');
    });
    config
        .command('keys')
        .description('List all available configuration keys')
        .action(() => {
        output.subheader('Configuration Keys');
        CONFIG_KEYS.forEach(key => {
            console.log(`  ${key}`);
            console.log(`    ${CONFIG_DESCRIPTIONS[key]}`);
            console.log();
        });
    });
    config
        .command('json')
        .description('Output full configuration as JSON')
        .action(() => {
        const all = (0, config_store_js_1.getAllConfig)();
        // Mask the auth token for security
        if (all.authToken) {
            const token = all.authToken;
            all.authToken = token.slice(0, 8) + '...' + token.slice(-8);
        }
        output.json(all);
    });
    return config;
}
//# sourceMappingURL=config.js.map