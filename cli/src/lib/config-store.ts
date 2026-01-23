import Conf from 'conf'
import type { CLIConfig } from '../types.js'
import { DEFAULT_CONFIG } from '../types.js'

interface ConfigSchema {
  apiUrl: string
  authToken?: string
  defaultVaultId?: string
  outputFormat: 'json' | 'table' | 'plain'
  verbose: boolean
}

const configDefaults: ConfigSchema = {
  apiUrl: DEFAULT_CONFIG.apiUrl,
  outputFormat: DEFAULT_CONFIG.outputFormat,
  verbose: DEFAULT_CONFIG.verbose,
}

const config = new Conf<ConfigSchema>({
  projectName: 'ragbox-cli',
  defaults: configDefaults,
  schema: {
    apiUrl: {
      type: 'string',
      default: DEFAULT_CONFIG.apiUrl,
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
      default: DEFAULT_CONFIG.outputFormat,
    },
    verbose: {
      type: 'boolean',
      default: DEFAULT_CONFIG.verbose,
    },
  },
})

export function getConfig(): CLIConfig {
  return {
    apiUrl: config.get('apiUrl'),
    authToken: config.get('authToken'),
    defaultVaultId: config.get('defaultVaultId'),
    outputFormat: config.get('outputFormat'),
    verbose: config.get('verbose'),
  }
}

export function setConfig<K extends keyof CLIConfig>(
  key: K,
  value: CLIConfig[K]
): void {
  config.set(key, value as ConfigSchema[K])
}

export function getConfigValue<K extends keyof CLIConfig>(
  key: K
): CLIConfig[K] {
  return config.get(key) as CLIConfig[K]
}

export function clearAuth(): void {
  config.delete('authToken')
}

export function setAuthToken(token: string): void {
  config.set('authToken', token)
}

export function getAuthToken(): string | undefined {
  return config.get('authToken')
}

export function isAuthenticated(): boolean {
  return !!config.get('authToken')
}

export function getConfigPath(): string {
  return config.path
}

export function resetConfig(): void {
  config.clear()
}

export function getAllConfig(): Record<string, unknown> {
  return { ...config.store }
}
