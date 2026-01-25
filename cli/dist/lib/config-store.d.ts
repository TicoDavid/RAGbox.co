import type { CLIConfig } from '../types.js';
export declare function getConfig(): CLIConfig;
export declare function setConfig<K extends keyof CLIConfig>(key: K, value: CLIConfig[K]): void;
export declare function getConfigValue<K extends keyof CLIConfig>(key: K): CLIConfig[K];
export declare function clearAuth(): void;
export declare function setAuthToken(token: string): void;
export declare function getAuthToken(): string | undefined;
export declare function isAuthenticated(): boolean;
export declare function getConfigPath(): string;
export declare function resetConfig(): void;
export declare function getAllConfig(): Record<string, unknown>;
//# sourceMappingURL=config-store.d.ts.map