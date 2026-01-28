import { Command } from 'commander'
import inquirer from 'inquirer'
import {
  getConfig,
  setConfig,
  getConfigValue,
  getConfigPath,
  resetConfig,
  getAllConfig,
} from '../lib/config-store.js'
import * as output from '../lib/output.js'
import type { CLIConfig } from '../types.js'

const CONFIG_KEYS: Array<keyof CLIConfig> = [
  'apiUrl',
  'defaultVaultId',
  'outputFormat',
  'verbose',
]

const CONFIG_DESCRIPTIONS: Record<keyof CLIConfig, string> = {
  apiUrl: 'API server URL (default: http://localhost:3000)',
  authToken: 'Authentication token (managed by auth commands)',
  defaultVaultId: 'Default vault ID for commands',
  outputFormat: 'Output format: json, table, or plain',
  verbose: 'Enable verbose output',
}

export function createConfigCommand(): Command {
  const config = new Command('config')
    .description('Manage CLI configuration')

  config
    .command('list')
    .alias('ls')
    .description('List all configuration values')
    .action(() => {
      const cfg = getConfig()

      output.subheader('Configuration')
      output.keyValue([
        ['API URL', cfg.apiUrl],
        ['Default Vault', cfg.defaultVaultId],
        ['Output Format', cfg.outputFormat],
        ['Verbose', String(cfg.verbose)],
        ['Authenticated', cfg.authToken ? 'Yes' : 'No'],
      ])

      console.log()
      output.info(`Config file: ${getConfigPath()}`)
    })

  config
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      if (!CONFIG_KEYS.includes(key as keyof CLIConfig)) {
        output.error(`Unknown config key: ${key}`)
        output.info(`Valid keys: ${CONFIG_KEYS.join(', ')}`)
        process.exit(1)
      }

      const value = getConfigValue(key as keyof CLIConfig)
      if (value === undefined) {
        output.info(`${key}: (not set)`)
      } else {
        output.info(`${key}: ${value}`)
      }
    })

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string) => {
      if (!CONFIG_KEYS.includes(key as keyof CLIConfig)) {
        output.error(`Unknown config key: ${key}`)
        output.info(`Valid keys: ${CONFIG_KEYS.join(', ')}`)
        process.exit(1)
      }

      // Validate specific keys
      if (key === 'outputFormat') {
        const validFormats = ['json', 'table', 'plain']
        if (!validFormats.includes(value)) {
          output.error(`Invalid output format. Valid values: ${validFormats.join(', ')}`)
          process.exit(1)
        }
      }

      if (key === 'verbose') {
        const boolValue = value.toLowerCase()
        if (!['true', 'false', '1', '0', 'yes', 'no'].includes(boolValue)) {
          output.error('Verbose must be true/false')
          process.exit(1)
        }
        const parsedValue = ['true', '1', 'yes'].includes(boolValue)
        setConfig('verbose', parsedValue)
        output.success(`${key} = ${parsedValue}`)
        return
      }

      if (key === 'apiUrl') {
        try {
          new URL(value)
        } catch {
          output.error('Invalid URL format')
          process.exit(1)
        }
      }

      setConfig(key as keyof CLIConfig, value as never)
      output.success(`${key} = ${value}`)
    })

  config
    .command('unset <key>')
    .description('Remove a configuration value')
    .action((key: string) => {
      if (!CONFIG_KEYS.includes(key as keyof CLIConfig)) {
        output.error(`Unknown config key: ${key}`)
        output.info(`Valid keys: ${CONFIG_KEYS.join(', ')}`)
        process.exit(1)
      }

      if (key === 'authToken') {
        output.error('Use `ragbox auth logout` to clear authentication')
        process.exit(1)
      }

      setConfig(key as keyof CLIConfig, undefined as never)
      output.success(`${key} unset`)
    })

  config
    .command('reset')
    .description('Reset all configuration to defaults')
    .action(async () => {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'This will reset all configuration including authentication. Continue?',
          default: false,
        },
      ])

      if (confirm) {
        resetConfig()
        output.success('Configuration reset to defaults.')
      } else {
        output.info('Reset cancelled.')
      }
    })

  config
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      output.info(getConfigPath())
    })

  config
    .command('edit')
    .description('Open configuration in interactive editor')
    .action(async () => {
      const cfg = getConfig()

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiUrl',
          message: 'API URL:',
          default: cfg.apiUrl,
          validate: (input: string) => {
            try {
              new URL(input)
              return true
            } catch {
              return 'Please enter a valid URL'
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
      ])

      setConfig('apiUrl', answers.apiUrl)
      setConfig('defaultVaultId', answers.defaultVaultId || undefined)
      setConfig('outputFormat', answers.outputFormat)
      setConfig('verbose', answers.verbose)

      output.success('Configuration updated.')
    })

  config
    .command('keys')
    .description('List all available configuration keys')
    .action(() => {
      output.subheader('Configuration Keys')
      CONFIG_KEYS.forEach(key => {
        console.log(`  ${key}`)
        console.log(`    ${CONFIG_DESCRIPTIONS[key]}`)
        console.log()
      })
    })

  config
    .command('json')
    .description('Output full configuration as JSON')
    .action(() => {
      const all = getAllConfig()
      // Mask the auth token for security
      if (all.authToken) {
        const token = all.authToken as string
        all.authToken = token.slice(0, 8) + '...' + token.slice(-8)
      }
      output.json(all)
    })

  return config
}
