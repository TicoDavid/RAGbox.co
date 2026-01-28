#!/usr/bin/env node

import { createProgram } from '../index.js'

const program = createProgram()

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Unexpected error:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})

// Parse command line arguments
program.parseAsync(process.argv).catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
