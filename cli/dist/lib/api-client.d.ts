import type { AuthResponse, OTPResponse, Document, DocumentListResponse, UploadResponse, Vault, VaultListResponse, QueryResponse, RefusalResponse, AuditLogResponse, User } from '../types.js';
export declare class ApiError extends Error {
    statusCode: number;
    code?: string | undefined;
    constructor(message: string, statusCode: number, code?: string | undefined);
}
export declare function sendOTP(email: string): Promise<OTPResponse>;
export declare function verifyOTP(email: string, otp: string): Promise<AuthResponse>;
export declare function getCurrentUser(): Promise<User>;
export declare function listVaults(): Promise<VaultListResponse>;
export declare function getVault(vaultId: string): Promise<Vault>;
export declare function createVault(name: string): Promise<Vault>;
export declare function listDocuments(vaultId: string, options?: {
    page?: number;
    pageSize?: number;
    includePrivileged?: boolean;
}): Promise<DocumentListResponse>;
export declare function getDocument(vaultId: string, documentId: string): Promise<Document>;
export declare function uploadDocument(vaultId: string, filePath: string, options?: {
    privileged?: boolean;
}): Promise<UploadResponse>;
export declare function deleteDocument(vaultId: string, documentId: string): Promise<void>;
export declare function togglePrivilege(vaultId: string, documentId: string, privileged: boolean): Promise<Document>;
export declare function query(vaultId: string, queryText: string): Promise<QueryResponse | RefusalResponse>;
export declare function queryStream(vaultId: string, queryText: string): AsyncGenerator<string, void, unknown>;
export declare function getAuditLog(options?: {
    page?: number;
    pageSize?: number;
    actionType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
}): Promise<AuditLogResponse>;
export declare function exportAuditLog(format?: 'pdf' | 'csv'): Promise<Buffer>;
export declare function healthCheck(): Promise<{
    status: string;
    version: string;
}>;
//# sourceMappingURL=api-client.d.ts.map