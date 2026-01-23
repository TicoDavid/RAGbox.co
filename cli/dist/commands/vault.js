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
exports.createVaultCommand = createVaultCommand;
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_store_js_1 = require("../lib/config-store.js");
const api_client_js_1 = require("../lib/api-client.js");
const output = __importStar(require("../lib/output.js"));
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
function createVaultCommand() {
    const vault = new commander_1.Command('vault')
        .description('Vault and document management');
    // ===========================================
    // Vault Commands
    // ===========================================
    vault
        .command('list')
        .description('List all vaults')
        .action(async () => {
        requireAuth();
        const spinner = (0, ora_1.default)('Fetching vaults...').start();
        try {
            const response = await (0, api_client_js_1.listVaults)();
            spinner.stop();
            if (response.vaults.length === 0) {
                output.info('No vaults found. Create one with `ragbox vault create <name>`');
                return;
            }
            output.subheader(`Vaults (${response.total})`);
            output.table(['ID', 'Name', 'Documents', 'Storage', 'Created'], response.vaults.map(v => [
                v.vault_id,
                v.name,
                String(v.document_count),
                output.formatBytes(v.storage_used_bytes),
                output.formatDate(v.created_at),
            ]));
        }
        catch (err) {
            spinner.fail('Failed to fetch vaults');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    vault
        .command('create <name>')
        .description('Create a new vault')
        .action(async (name) => {
        requireAuth();
        const spinner = (0, ora_1.default)(`Creating vault "${name}"...`).start();
        try {
            const vault = await (0, api_client_js_1.createVault)(name);
            spinner.succeed(`Vault "${name}" created!`);
            output.keyValue([
                ['Vault ID', vault.vault_id],
                ['Name', vault.name],
            ]);
            const { setDefault } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'setDefault',
                    message: 'Set this as your default vault?',
                    default: true,
                },
            ]);
            if (setDefault) {
                (0, config_store_js_1.setConfig)('defaultVaultId', vault.vault_id);
                output.success('Default vault updated.');
            }
        }
        catch (err) {
            spinner.fail('Failed to create vault');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    vault
        .command('info [vault-id]')
        .description('Show vault details')
        .action(async (vaultId) => {
        requireAuth();
        const id = vaultId || (0, config_store_js_1.getConfigValue)('defaultVaultId');
        if (!id) {
            output.error('No vault specified. Provide a vault ID or set a default.');
            process.exit(1);
        }
        const spinner = (0, ora_1.default)('Fetching vault info...').start();
        try {
            const vault = await (0, api_client_js_1.getVault)(id);
            spinner.stop();
            output.subheader('Vault Information');
            output.keyValue([
                ['Vault ID', vault.vault_id],
                ['Name', vault.name],
                ['Tenant ID', vault.tenant_id],
                ['Documents', String(vault.document_count)],
                ['Storage Used', output.formatBytes(vault.storage_used_bytes)],
                ['Created', output.formatDate(vault.created_at)],
            ]);
        }
        catch (err) {
            spinner.fail('Failed to fetch vault');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    // ===========================================
    // Document Commands
    // ===========================================
    vault
        .command('documents')
        .alias('docs')
        .description('List documents in a vault')
        .option('-v, --vault <vault-id>', 'Vault ID')
        .option('-p, --page <number>', 'Page number', '1')
        .option('-s, --size <number>', 'Page size', '20')
        .option('--privileged', 'Include privileged documents')
        .action(async (options) => {
        requireAuth();
        const vaultId = getVaultId(options);
        const spinner = (0, ora_1.default)('Fetching documents...').start();
        try {
            const response = await (0, api_client_js_1.listDocuments)(vaultId, {
                page: parseInt(options.page),
                pageSize: parseInt(options.size),
                includePrivileged: options.privileged,
            });
            spinner.stop();
            if (response.documents.length === 0) {
                output.info('No documents found. Upload one with `ragbox vault upload <file>`');
                return;
            }
            output.subheader(`Documents (${response.total} total)`);
            output.table(['ID', 'Filename', 'Size', 'Status', 'Privilege', 'Uploaded'], response.documents.map(d => [
                output.truncate(d.document_id, 12),
                output.truncate(d.filename, 30),
                output.formatBytes(d.size_bytes),
                d.index_status,
                d.privilege_status,
                output.formatDate(d.uploaded_at),
            ]));
            if (response.total > response.page * response.pageSize) {
                output.info(`Page ${response.page} of ${Math.ceil(response.total / response.pageSize)}`);
            }
        }
        catch (err) {
            spinner.fail('Failed to fetch documents');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    vault
        .command('upload <file>')
        .description('Upload a document to the vault')
        .option('-v, --vault <vault-id>', 'Vault ID')
        .option('--privileged', 'Mark as privileged (attorney-client)')
        .action(async (file, options) => {
        requireAuth();
        const vaultId = getVaultId(options);
        // Resolve file path
        const filePath = path.resolve(file);
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            output.error(`File not found: ${filePath}`);
            process.exit(1);
        }
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);
        output.info(`Uploading: ${filename} (${output.formatBytes(stats.size)})`);
        if (options.privileged) {
            output.warn('Document will be marked as PRIVILEGED');
        }
        const spinner = (0, ora_1.default)('Uploading document...').start();
        try {
            const response = await (0, api_client_js_1.uploadDocument)(vaultId, filePath, {
                privileged: options.privileged,
            });
            spinner.succeed('Document uploaded successfully!');
            output.keyValue([
                ['Document ID', response.document.document_id],
                ['Filename', response.document.filename],
                ['Size', output.formatBytes(response.document.size_bytes)],
                ['Status', response.document.index_status],
                ['Privilege', response.document.privilege_status],
            ]);
            if (response.document.index_status === 'Pending') {
                output.info('Document is being indexed. This may take a moment.');
            }
        }
        catch (err) {
            spinner.fail('Upload failed');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    vault
        .command('delete <document-id>')
        .description('Delete a document from the vault')
        .option('-v, --vault <vault-id>', 'Vault ID')
        .option('-f, --force', 'Skip confirmation')
        .action(async (documentId, options) => {
        requireAuth();
        const vaultId = getVaultId(options);
        // Get document info first
        const spinner = (0, ora_1.default)('Fetching document...').start();
        try {
            const doc = await (0, api_client_js_1.getDocument)(vaultId, documentId);
            spinner.stop();
            output.warn(`Document: ${doc.filename}`);
            if (!options.force) {
                const { confirm } = await inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Are you sure you want to delete this document?',
                        default: false,
                    },
                ]);
                if (!confirm) {
                    output.info('Deletion cancelled.');
                    return;
                }
            }
            const deleteSpinner = (0, ora_1.default)('Deleting document...').start();
            await (0, api_client_js_1.deleteDocument)(vaultId, documentId);
            deleteSpinner.succeed('Document deleted.');
        }
        catch (err) {
            spinner.fail('Operation failed');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    vault
        .command('privilege <document-id>')
        .description('Toggle document privilege status')
        .option('-v, --vault <vault-id>', 'Vault ID')
        .option('--on', 'Mark as privileged')
        .option('--off', 'Mark as public')
        .action(async (documentId, options) => {
        requireAuth();
        const vaultId = getVaultId(options);
        // Get current status
        const spinner = (0, ora_1.default)('Fetching document...').start();
        try {
            const doc = await (0, api_client_js_1.getDocument)(vaultId, documentId);
            spinner.stop();
            output.info(`Document: ${doc.filename}`);
            output.info(`Current status: ${doc.privilege_status}`);
            let newStatus;
            if (options.on !== undefined) {
                newStatus = true;
            }
            else if (options.off !== undefined) {
                newStatus = false;
            }
            else {
                // Toggle
                newStatus = doc.privilege_status !== 'Privileged';
            }
            const action = newStatus ? 'PRIVILEGED' : 'PUBLIC';
            const { confirm } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Change privilege status to ${action}?`,
                    default: true,
                },
            ]);
            if (!confirm) {
                output.info('Operation cancelled.');
                return;
            }
            const updateSpinner = (0, ora_1.default)('Updating privilege status...').start();
            const updated = await (0, api_client_js_1.togglePrivilege)(vaultId, documentId, newStatus);
            updateSpinner.succeed(`Document marked as ${updated.privilege_status}`);
        }
        catch (err) {
            spinner.fail('Operation failed');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    vault
        .command('document <document-id>')
        .alias('doc')
        .description('Show document details')
        .option('-v, --vault <vault-id>', 'Vault ID')
        .action(async (documentId, options) => {
        requireAuth();
        const vaultId = getVaultId(options);
        const spinner = (0, ora_1.default)('Fetching document...').start();
        try {
            const doc = await (0, api_client_js_1.getDocument)(vaultId, documentId);
            spinner.stop();
            output.subheader('Document Information');
            output.keyValue([
                ['Document ID', doc.document_id],
                ['Filename', doc.filename],
                ['MIME Type', doc.mime_type],
                ['Size', output.formatBytes(doc.size_bytes)],
                ['Index Status', doc.index_status],
                ['Privilege Status', doc.privilege_status],
                ['Deletion Status', doc.deletion_status],
                ['Uploaded By', doc.uploaded_by],
                ['Uploaded At', output.formatDate(doc.uploaded_at)],
                ['Checksum', doc.checksum],
            ]);
        }
        catch (err) {
            spinner.fail('Failed to fetch document');
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    return vault;
}
//# sourceMappingURL=vault.js.map