"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.setConfig = setConfig;
exports.getConfigValue = getConfigValue;
exports.clearAuth = clearAuth;
exports.setAuthToken = setAuthToken;
exports.getAuthToken = getAuthToken;
exports.isAuthenticated = isAuthenticated;
exports.getConfigPath = getConfigPath;
exports.resetConfig = resetConfig;
exports.getAllConfig = getAllConfig;
const conf_1 = __importDefault(require("conf"));
const types_js_1 = require("../types.js");
const configDefaults = {
    apiUrl: types_js_1.DEFAULT_CONFIG.apiUrl,
    outputFormat: types_js_1.DEFAULT_CONFIG.outputFormat,
    verbose: types_js_1.DEFAULT_CONFIG.verbose,
};
const config = new conf_1.default({
    projectName: 'ragbox-cli',
    defaults: configDefaults,
    schema: {
        apiUrl: {
            type: 'string',
            default: types_js_1.DEFAULT_CONFIG.apiUrl,
        },
        authToken: {
            type: 'string',
        },
        defaultVaultId: {
            type: 'string',
        },
        outputFormat: {
            type: 'string',
            enum: ['json', 'table', 'plain'],
            default: types_js_1.DEFAULT_CONFIG.outputFormat,
        },
        verbose: {
            type: 'boolean',
            default: types_js_1.DEFAULT_CONFIG.verbose,
        },
    },
});
function getConfig() {
    return {
        apiUrl: config.get('apiUrl'),
        authToken: config.get('authToken'),
        defaultVaultId: config.get('defaultVaultId'),
        outputFormat: config.get('outputFormat'),
        verbose: config.get('verbose'),
    };
}
function setConfig(key, value) {
    config.set(key, value);
}
function getConfigValue(key) {
    return config.get(key);
}
function clearAuth() {
    config.delete('authToken');
}
function setAuthToken(token) {
    config.set('authToken', token);
}
function getAuthToken() {
    return config.get('authToken');
}
function isAuthenticated() {
    return !!config.get('authToken');
}
function getConfigPath() {
    return config.path;
}
function resetConfig() {
    config.clear();
}
function getAllConfig() {
    return { ...config.store };
}
//# sourceMappingURL=config-store.js.map