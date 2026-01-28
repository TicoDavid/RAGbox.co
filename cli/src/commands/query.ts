import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { isAuthenticated, getConfigValue } from '../lib/config-store.js'
import { query, queryStream, ApiError } from '../lib/api-client.js'
import * as output from '../lib/output.js'
import type { QueryResponse, RefusalResponse } from '../types.js'

const CONFIDENCE_THRESHOLD = 0.85

function requireAuth(): void {
  if (!isAuthenticated()) {
    output.error('You must be logged in. Run `ragbox auth login` first.')
    process.exit(1)
  }
}

function getVaultId(options: { vault?: string }): string {
  const vaultId = options.vault || getConfigValue('defaultVaultId')
  if (!vaultId) {
    output.error('No vault specified. Use --vault or set a default with `ragbox config set defaultVaultId <id>`')
    process.exit(1)
  }
  return vaultId
}

function isRefusal(response: QueryResponse | RefusalResponse): response is RefusalResponse {
  return 'refused' in response && response.refused === true
}

export function createQueryCommand(): Command {
  const queryCmd = new Command('query')
    .alias('q')
    .description('Query your documents (The Interrogation)')

  queryCmd
    .command('ask [question]')
    .description('Ask a question about your documents')
    .option('-v, --vault <vault-id>', 'Vault ID')
    .option('-s, --stream', 'Stream the response')
    .option('--no-citations', 'Hide citations')
    .action(async (question: string | undefined, options) => {
      requireAuth()

      const vaultId = getVaultId(options)

      // Get question interactively if not provided
      let queryText: string = question || ''
      if (!queryText) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'question',
            message: 'Enter your question:',
            validate: (input: string) => input.trim().length > 0 || 'Please enter a question',
          },
        ])
        queryText = answers.question as string
      }

      output.header('The Interrogation')
      output.info(`Query: ${queryText}`)

      if (options.stream) {
        // Streaming response
        process.stdout.write('\n')

        try {
          let fullResponse = ''
          for await (const chunk of queryStream(vaultId, queryText)) {
            process.stdout.write(chunk)
            fullResponse += chunk
          }
          process.stdout.write('\n\n')
          output.success('Response complete.')
        } catch (err) {
          output.error('Query failed')
          if (err instanceof ApiError) {
            output.error(err.message)
          }
          process.exit(1)
        }
      } else {
        // Non-streaming response
        const spinner = ora('Interrogating documents...').start()

        try {
          const response = await query(vaultId, queryText)
          spinner.stop()

          if (isRefusal(response)) {
            // Handle refusal (Silence Protocol)
            output.warn('SILENCE PROTOCOL ENGAGED')
            output.subheader('Query Refused')
            output.info(`Reason: ${response.reason}`)
            output.confidence(response.confidence_score, CONFIDENCE_THRESHOLD)
            return
          }

          // Display answer
          output.subheader('Answer')
          output.answer(response.answer_text)

          // Display confidence metrics
          output.subheader('Confidence Analysis')
          output.confidence(response.confidence_score, CONFIDENCE_THRESHOLD)
          output.keyValue([
            ['Retrieval Coverage', `${(response.retrieval_coverage * 100).toFixed(1)}%`],
            ['Source Agreement', `${(response.source_agreement * 100).toFixed(1)}%`],
            ['Model Certainty', `${(response.model_certainty * 100).toFixed(1)}%`],
          ])

          // Display citations
          if (options.citations !== false && response.citations.length > 0) {
            output.subheader(`Citations (${response.citations.length})`)
            response.citations.forEach((cite, index) => {
              output.citation(
                index + 1,
                cite.document_name || cite.document_id,
                cite.excerpt || '(No excerpt available)',
                cite.relevance_score
              )
            })
          }
        } catch (err) {
          spinner.fail('Query failed')
          if (err instanceof ApiError) {
            output.error(err.message)
          }
          process.exit(1)
        }
      }
    })

  queryCmd
    .command('interactive')
    .alias('chat')
    .description('Start an interactive query session')
    .option('-v, --vault <vault-id>', 'Vault ID')
    .action(async (options) => {
      requireAuth()

      const vaultId = getVaultId(options)

      output.brand()
      output.header('Interactive Interrogation')
      output.info('Type your questions. Enter "exit" or "quit" to end the session.')
      output.info('Commands: /help, /clear, /stats')
      console.log()

      let queryCount = 0
      let totalConfidence = 0

      while (true) {
        const { question } = await inquirer.prompt([
          {
            type: 'input',
            name: 'question',
            message: '>',
            prefix: '',
          },
        ])

        const trimmedQuestion = question.trim().toLowerCase()

        // Handle special commands
        if (trimmedQuestion === 'exit' || trimmedQuestion === 'quit') {
          output.info('Session ended.')
          break
        }

        if (trimmedQuestion === '/help') {
          console.log()
          output.info('Available commands:')
          output.info('  /help   - Show this help')
          output.info('  /clear  - Clear the screen')
          output.info('  /stats  - Show session statistics')
          output.info('  exit    - End the session')
          console.log()
          continue
        }

        if (trimmedQuestion === '/clear') {
          console.clear()
          output.brand()
          continue
        }

        if (trimmedQuestion === '/stats') {
          console.log()
          output.keyValue([
            ['Queries', String(queryCount)],
            ['Avg Confidence', queryCount > 0 ? `${(totalConfidence / queryCount * 100).toFixed(1)}%` : 'N/A'],
          ])
          console.log()
          continue
        }

        if (!question.trim()) {
          continue
        }

        // Process query
        const spinner = ora('Interrogating...').start()

        try {
          const response = await query(vaultId, question)
          spinner.stop()

          queryCount++

          if (isRefusal(response)) {
            output.warn('SILENCE PROTOCOL')
            output.info(response.reason)
            totalConfidence += response.confidence_score
          } else {
            totalConfidence += response.confidence_score

            console.log()
            output.answer(response.answer_text)

            if (response.citations.length > 0) {
              output.info(`[${response.citations.length} citations] Confidence: ${(response.confidence_score * 100).toFixed(0)}%`)
            }
            console.log()
          }
        } catch (err) {
          spinner.fail('Query failed')
          if (err instanceof ApiError) {
            output.error(err.message)
          }
        }
      }

      // Show session summary
      if (queryCount > 0) {
        output.subheader('Session Summary')
        output.keyValue([
          ['Total Queries', String(queryCount)],
          ['Average Confidence', `${(totalConfidence / queryCount * 100).toFixed(1)}%`],
        ])
      }
    })

  return queryCmd
}
