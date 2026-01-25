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
exports.createAuthCommand = createAuthCommand;
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const config_store_js_1 = require("../lib/config-store.js");
const api_client_js_1 = require("../lib/api-client.js");
const output = __importStar(require("../lib/output.js"));
function createAuthCommand() {
    const auth = new commander_1.Command('auth')
        .description('Authentication commands');
    auth
        .command('login')
        .description('Log in to RAGbox')
        .option('-e, --email <email>', 'Email address')
        .action(async (options) => {
        try {
            // Check if already logged in
            if ((0, config_store_js_1.isAuthenticated)()) {
                const { overwrite } = await inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'overwrite',
                        message: 'You are already logged in. Do you want to log in with a different account?',
                        default: false,
                    },
                ]);
                if (!overwrite) {
                    output.info('Login cancelled.');
                    return;
                }
            }
            // Get email
            let email = options.email;
            if (!email) {
                const answers = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'email',
                        message: 'Enter your email address:',
                        validate: (input) => {
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            return emailRegex.test(input) || 'Please enter a valid email address';
                        },
                    },
                ]);
                email = answers.email;
            }
            // Send OTP
            const spinner = (0, ora_1.default)('Sending verification code...').start();
            const otpResponse = await (0, api_client_js_1.sendOTP)(email);
            if (!otpResponse.success) {
                spinner.fail('Failed to send verification code');
                output.error(otpResponse.message || 'Unknown error');
                return;
            }
            spinner.succeed('Verification code sent to your email');
            // In development, show the OTP
            if (otpResponse.otp) {
                output.warn(`Development mode: Your OTP is ${otpResponse.otp}`);
            }
            // Get OTP from user
            const { otp } = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'otp',
                    message: 'Enter the 6-digit verification code:',
                    validate: (input) => {
                        return /^\d{6}$/.test(input) || 'Please enter a valid 6-digit code';
                    },
                },
            ]);
            // Verify OTP
            const verifySpinner = (0, ora_1.default)('Verifying...').start();
            const authResponse = await (0, api_client_js_1.verifyOTP)(email, otp);
            (0, config_store_js_1.setAuthToken)(authResponse.token);
            verifySpinner.succeed('Successfully logged in!');
            output.subheader('Welcome!');
            output.keyValue([
                ['Email', authResponse.user.email],
                ['Role', authResponse.user.role],
                ['User ID', authResponse.user.user_id],
            ]);
        }
        catch (err) {
            if (err instanceof api_client_js_1.ApiError) {
                output.error(err.message);
            }
            else if (err instanceof Error) {
                output.error(err.message);
            }
            process.exit(1);
        }
    });
    auth
        .command('logout')
        .description('Log out from RAGbox')
        .action(async () => {
        if (!(0, config_store_js_1.isAuthenticated)()) {
            output.info('You are not logged in.');
            return;
        }
        const { confirm } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Are you sure you want to log out?',
                default: true,
            },
        ]);
        if (confirm) {
            (0, config_store_js_1.clearAuth)();
            output.success('Successfully logged out.');
        }
        else {
            output.info('Logout cancelled.');
        }
    });
    auth
        .command('whoami')
        .description('Show current user information')
        .action(async () => {
        if (!(0, config_store_js_1.isAuthenticated)()) {
            output.error('You are not logged in. Run `ragbox auth login` to log in.');
            process.exit(1);
        }
        const spinner = (0, ora_1.default)('Fetching user information...').start();
        try {
            const user = await (0, api_client_js_1.getCurrentUser)();
            spinner.stop();
            output.subheader('Current User');
            output.keyValue([
                ['Email', user.email],
                ['Role', user.role],
                ['Status', user.status],
                ['User ID', user.user_id],
                ['Last Login', output.formatDate(user.last_login_at)],
                ['Created At', output.formatDate(user.created_at)],
            ]);
        }
        catch (err) {
            spinner.fail('Failed to fetch user information');
            if (err instanceof api_client_js_1.ApiError) {
                if (err.statusCode === 401) {
                    output.error('Your session has expired. Please log in again.');
                    (0, config_store_js_1.clearAuth)();
                }
                else {
                    output.error(err.message);
                }
            }
            process.exit(1);
        }
    });
    auth
        .command('status')
        .description('Check authentication status')
        .action(() => {
        if ((0, config_store_js_1.isAuthenticated)()) {
            output.success('Authenticated');
            const token = (0, config_store_js_1.getAuthToken)();
            if (token) {
                // Show partial token for debugging
                const masked = token.slice(0, 8) + '...' + token.slice(-8);
                output.info(`Token: ${masked}`);
            }
        }
        else {
            output.warn('Not authenticated');
            output.info('Run `ragbox auth login` to log in.');
        }
    });
    return auth;
}
//# sourceMappingURL=auth.js.map