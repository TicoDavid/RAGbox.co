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
exports.createQueryCommand = createQueryCommand;
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const config_store_js_1 = require("../lib/config-store.js");
const api_client_js_1 = require("../lib/api-client.js");
const output = __importStar(require("../lib/output.js"));
const CONFIDENCE_THRESHOLD = 0.85;
function requireAuth() {
    if (!(0, config_store_js_1.isAuthenticated)()) {
        output.error('You must be logged in. Run `ragbox auth login` first.');
        process.exit(1);
    }
}
function getVaultId(options) {
    const vaultId = options.vault || (0, config_store_js_1.getConfigValue)('defaultVaultId');
    if (!vaultId) {
        output.error('No vault specified. Use --vault or set a default with `ragbox config set defaultVaultId <id>`');
        process.exit(1);
    }
    return vaultId;
}
function isRefusal(response) {
    return 'refused' in response && response.refused === true;
}
function createQueryCommand() {
    const queryCmd = new commander_1.Command('query')
        .alias('q')
        .description('Query your documents (The Interrogation)');
    queryCmd
        .command('ask [question]')
        .description('Ask a question about your documents')
        .option('-v, --vault <vault-id>', 'Vault ID')
        .option('-s, --stream', 'Stream the response')
        .option('--no-citations', 'Hide citations')
        .action(async (question, options) => {
        requireAuth();
        const vaultId = getVaultId(options);
        // Get question interactively if not provided
        let queryText = question || '';
        if (!queryText) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'question',
                    message: 'Enter your question:',
                    validate: (input) => input.trim().length > 0 || 'Please enter a question',
                },
            ]);
            queryText = answers.question;
        }
        output.header('The Interrogation');
        output.info(`Query: ${queryText}`);
        if (options.stream) {
            // Streaming response
            process.stdout.write('\n');
            try {
                let fullResponse = '';
                for await (const chunk of (0, api_client_js_1.queryStream)(vaultId, queryText)) {
                    process.stdout.write(chunk);
                    fullResponse += chunk;
                }
                process.stdout.write('\n\n');
                output.success('Response complete.');
            }
            catch (err) {
                output.error('Query failed');
                if (err instanceof api_client_js_1.ApiError) {
                    output.error(err.message);
                }
                process.exit(1);
            }
        }
        else {
            // Non-streaming response
            const spinner = (0, ora_1.default)('Interrogating documents...').start();
            try {
                const response = await (0, api_client_js_1.query)(vaultId, queryText);
                spinner.stop();
                if (isRefusal(response)) {
                    // Handle refusal (Silence Protocol)
                    output.warn('SILENCE PROTOCOL ENGAGED');
                    output.subheader('Query Refused');
                    output.info(`Reason: ${response.reason}`);
                    output.confidence(response.confidence_score, CONFIDENCE_THRESHOLD);
                    return;
                }
                // Display answer
                output.subheader('Answer');
                output.answer(response.answer_text);
                // Display confidence metrics
                output.subheader('Confidence Analysis');
                output.confidence(response.confidence_score, CONFIDENCE_THRESHOLD);
                output.keyValue([
                    ['Retrieval Coverage', `${(response.retrieval_coverage * 100).toFixed(1)}%`],
                    ['Source Agreement', `${(response.source_agreement * 100).toFixed(1)}%`],
                    ['Model Certainty', `${(response.model_certainty * 100).toFixed(1)}%`],
                ]);
                // Display citations
                if (options.citations !== false && response.citations.length > 0) {
                    output.subheader(`Citations (${response.citations.length})`);
                    response.citations.forEach((cite, index) => {
                        output.citation(index + 1, cite.document_name || cite.document_id, cite.excerpt || '(No excerpt available)', cite.relevance_score);
                    });
                }
            }
            catch (err) {
                spinner.fail('Query failed');
                if (err instanceof api_client_js_1.ApiError) {
                    output.error(err.message);
                }
                process.exit(1);
            }
        }
    });
    queryCmd
        .command('interactive')
        .alias('chat')
        .description('Start an interactive query session')
        .option('-v, --vault <vault-id>', 'Vault ID')
        .action(async (options) => {
        requireAuth();
        const vaultId = getVaultId(options);
        output.brand();
        output.header('Interactive Interrogation');
        output.info('Type your questions. Enter "exit" or "quit" to end the session.');
        output.info('Commands: /help, /clear, /stats');
        console.log();
        let queryCount = 0;
        let totalConfidence = 0;
        while (true) {
            const { question } = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'question',
                    message: '>',
                    prefix: '',
                },
            ]);
            const trimmedQuestion = question.trim().toLowerCase();
            // Handle special commands
            if (trimmedQuestion === 'exit' || trimmedQuestion === 'quit') {
                output.info('Session ended.');
                break;
            }
            if (trimmedQuestion === '/help') {
                console.log();
                output.info('Available commands:');
                output.info('  /help   - Show this help');
                output.info('  /clear  - Clear the screen');
                output.info('  /stats  - Show session statistics');
                output.info('  exit    - End the session');
                console.log();
                continue;
            }
            if (trimmedQuestion === '/clear') {
                console.clear();
                output.brand();
                continue;
            }
            if (trimmedQuestion === '/stats') {
                console.log();
                output.keyValue([
                    ['Queries', String(queryCount)],
                    ['Avg Confidence', queryCount > 0 ? `${(totalConfidence / queryCount * 100).toFixed(1)}%` : 'N/A'],
                ]);
                console.log();
                continue;
            }
            if (!question.trim()) {
                continue;
            }
            // Process query
            const spinner = (0, ora_1.default)('Interrogating...').start();
            try {
                const response = await (0, api_client_js_1.query)(vaultId, question);
                spinner.stop();
                queryCount++;
                if (isRefusal(response)) {
                    output.warn('SILENCE PROTOCOL');
                    output.info(response.reason);
                    totalConfidence += response.confidence_score;
                }
                else {
                    totalConfidence += response.confidence_score;
                    console.log();
                    output.answer(response.answer_text);
                    if (response.citations.length > 0) {
                        output.info(`[${response.citations.length} citations] Confidence: ${(response.confidence_score * 100).toFixed(0)}%`);
                    }
                    console.log();
                }
            }
            catch (err) {
                spinner.fail('Query failed');
                if (err instanceof api_client_js_1.ApiError) {
                    output.error(err.message);
                }
            }
        }
        // Show session summary
        if (queryCount > 0) {
            output.subheader('Session Summary');
            output.keyValue([
                ['Total Queries', String(queryCount)],
                ['Average Confidence', `${(totalConfidence / queryCount * 100).toFixed(1)}%`],
            ]);
        }
    });
    return queryCmd;
}
//# sourceMappingURL=query.js.map