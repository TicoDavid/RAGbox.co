"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.sendOTP = sendOTP;
exports.verifyOTP = verifyOTP;
exports.getCurrentUser = getCurrentUser;
exports.listVaults = listVaults;
exports.getVault = getVault;
exports.createVault = createVault;
exports.listDocuments = listDocuments;
exports.getDocument = getDocument;
exports.uploadDocument = uploadDocument;
exports.deleteDocument = deleteDocument;
exports.togglePrivilege = togglePrivilege;
exports.query = query;
exports.queryStream = queryStream;
exports.getAuditLog = getAuditLog;
exports.exportAuditLog = exportAuditLog;
exports.healthCheck = healthCheck;
const config_store_js_1 = require("./config-store.js");
const output_js_1 = require("./output.js");
class ApiError extends Error {
    statusCode;
    code;
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
async function request(endpoint, options = {}) {
    const config = (0, config_store_js_1.getConfig)();
    const token = (0, config_store_js_1.getAuthToken)();
    const url = `${config.apiUrl}${endpoint}`;
    (0, output_js_1.debug)(`API Request: ${options.method || 'GET'} ${url}`);
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new ApiError(data.error || `HTTP ${response.status}`, response.status);
        }
        if (!data.success && data.error) {
            throw new ApiError(data.error, response.status);
        }
        return data.data;
    }
    catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        if (err instanceof TypeError && err.message.includes('fetch')) {
            throw new ApiError(`Cannot connect to API at ${config.apiUrl}. Is the server running?`, 0, 'CONNECTION_ERROR');
        }
        throw err;
    }
}
async function requestRaw(endpoint, options = {}) {
    const config = (0, config_store_js_1.getConfig)();
    const token = (0, config_store_js_1.getAuthToken)();
    const url = `${config.apiUrl}${endpoint}`;
    (0, output_js_1.debug)(`API Request (raw): ${options.method || 'GET'} ${url}`);
    const headers = {
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
        ...options,
        headers,
    });
}
// ===========================================
// Authentication
// ===========================================
async function sendOTP(email) {
    const config = (0, config_store_js_1.getConfig)();
    const response = await fetch(`${config.apiUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const data = await response.json();
    return data;
}
async function verifyOTP(email, otp) {
    const config = (0, config_store_js_1.getConfig)();
    const response = await fetch(`${config.apiUrl}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new ApiError(data.error || 'Invalid OTP', response.status);
    }
    const data = await response.json();
    return data;
}
async function getCurrentUser() {
    return request('/api/auth/me');
}
// ===========================================
// Vaults
// ===========================================
async function listVaults() {
    return request('/api/vaults');
}
async function getVault(vaultId) {
    return request(`/api/vaults/${vaultId}`);
}
async function createVault(name) {
    return request('/api/vaults', {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
}
// ===========================================
// Documents
// ===========================================
async function listDocuments(vaultId, options = {}) {
    const params = new URLSearchParams();
    if (options.page)
        params.set('page', String(options.page));
    if (options.pageSize)
        params.set('pageSize', String(options.pageSize));
    if (options.includePrivileged)
        params.set('includePrivileged', 'true');
    const queryStr = params.toString();
    return request(`/api/vaults/${vaultId}/documents${queryStr ? `?${queryStr}` : ''}`);
}
async function getDocument(vaultId, documentId) {
    return request(`/api/vaults/${vaultId}/documents/${documentId}`);
}
async function uploadDocument(vaultId, filePath, options = {}) {
    const fs = await import('fs');
    const path = await import('path');
    const FormData = (await import('form-data')).default;
    const filename = path.basename(filePath);
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);
    const form = new FormData();
    form.append('file', fileStream, {
        filename,
        knownLength: stats.size,
    });
    if (options.privileged) {
        form.append('privileged', 'true');
    }
    const config = (0, config_store_js_1.getConfig)();
    const token = (0, config_store_js_1.getAuthToken)();
    const headers = {
        ...form.getHeaders(),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    // Use node-fetch compatible approach
    const nodeFetch = (await import('node-fetch')).default;
    const response = await nodeFetch(`${config.apiUrl}/api/vaults/${vaultId}/documents`, {
        method: 'POST',
        headers,
        body: form,
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new ApiError(data.error || 'Upload failed', response.status);
    }
    return data.data;
}
async function deleteDocument(vaultId, documentId) {
    return request(`/api/vaults/${vaultId}/documents/${documentId}`, {
        method: 'DELETE',
    });
}
async function togglePrivilege(vaultId, documentId, privileged) {
    return request(`/api/vaults/${vaultId}/documents/${documentId}/privilege`, {
        method: 'PATCH',
        body: JSON.stringify({ privileged }),
    });
}
// ===========================================
// Queries (RAG)
// ===========================================
async function query(vaultId, queryText) {
    return request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
            query: queryText,
            vault_id: vaultId,
        }),
    });
}
async function* queryStream(vaultId, queryText) {
    const config = (0, config_store_js_1.getConfig)();
    const token = (0, config_store_js_1.getAuthToken)();
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${config.apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            query: queryText,
            vault_id: vaultId,
        }),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new ApiError(data.error || 'Query failed', response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) {
        throw new ApiError('No response body', 500);
    }
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const eventData = line.slice(6);
                if (eventData === '[DONE]')
                    return;
                try {
                    const parsed = JSON.parse(eventData);
                    if (parsed.text) {
                        yield parsed.text;
                    }
                }
                catch {
                    // Skip invalid JSON
                }
            }
        }
    }
}
// ===========================================
// Audit Log
// ===========================================
async function getAuditLog(options = {}) {
    const params = new URLSearchParams();
    if (options.page)
        params.set('page', String(options.page));
    if (options.pageSize)
        params.set('pageSize', String(options.pageSize));
    if (options.actionType)
        params.set('actionType', options.actionType);
    if (options.userId)
        params.set('userId', options.userId);
    if (options.startDate)
        params.set('startDate', options.startDate);
    if (options.endDate)
        params.set('endDate', options.endDate);
    const queryStr = params.toString();
    return request(`/api/audit${queryStr ? `?${queryStr}` : ''}`);
}
async function exportAuditLog(format = 'pdf') {
    const response = await requestRaw(`/api/audit/export?format=${format}`);
    if (!response.ok) {
        const data = await response.json();
        throw new ApiError(data.error || 'Export failed', response.status);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
// ===========================================
// Health Check
// ===========================================
async function healthCheck() {
    const config = (0, config_store_js_1.getConfig)();
    const response = await fetch(`${config.apiUrl}/api/health`);
    const data = await response.json();
    return data;
}
//# sourceMappingURL=api-client.js.map