import { Command } from 'commander'
import { createAuthCommand } from './commands/auth.js'
import { createVaultCommand } from './commands/vault.js'
import { createQueryCommand } from './commands/query.js'
import { createConfigCommand } from './commands/config.js'
import * as output from './lib/output.js'
import { healthCheck, ApiError } from './lib/api-client.js'
import { getConfig } from './lib/config-store.js'

const VERSION = '0.1.0'

export function createProgram(): Command {
  const program = new Command()

  program
    .name('ragbox')
    .description('RAGbox CLI - Your Files Speak. We Make Them Testify.')
    .version(VERSION, '-V, --version', 'Output the version number')

  // Global options
  program
    .option('--json', 'Output in JSON format')
    .option('--verbose', 'Enable verbose output')

  // Add subcommands
  program.addCommand(createAuthCommand())
  program.addCommand(createVaultCommand())
  program.addCommand(createQueryCommand())
  program.addCommand(createConfigCommand())

  // Health check command
  program
    .command('health')
    .description('Check API server health')
    .action(async () => {
      const config = getConfig()
      output.info(`Checking API at ${config.apiUrl}...`)

      try {
        const health = await healthCheck()
        output.success('API is healthy')
        output.keyValue([
          ['Status', health.status],
          ['Version', health.version],
        ])
      } catch (err) {
        output.error('API health check failed')
        if (err instanceof ApiError) {
          output.error(err.message)
        } else if (err instanceof Error) {
          output.error(err.message)
        }
        process.exit(1)
      }
    })

  // Info command
  program
    .command('info')
    .description('Show CLI information')
    .action(() => {
      output.brand()
      const config = getConfig()
      output.keyValue([
        ['CLI Version', VERSION],
        ['API URL', config.apiUrl],
        ['Config File', '~/.config/ragbox-cli/config.json'],
      ])
    })

  return program
}

export { VERSION }
