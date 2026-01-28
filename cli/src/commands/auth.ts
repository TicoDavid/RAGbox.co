import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import {
  setAuthToken,
  clearAuth,
  isAuthenticated,
  getAuthToken,
} from '../lib/config-store.js'
import { sendOTP, verifyOTP, getCurrentUser, ApiError } from '../lib/api-client.js'
import * as output from '../lib/output.js'

export function createAuthCommand(): Command {
  const auth = new Command('auth')
    .description('Authentication commands')

  auth
    .command('login')
    .description('Log in to RAGbox')
    .option('-e, --email <email>', 'Email address')
    .action(async (options) => {
      try {
        // Check if already logged in
        if (isAuthenticated()) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: 'You are already logged in. Do you want to log in with a different account?',
              default: false,
            },
          ])
          if (!overwrite) {
            output.info('Login cancelled.')
            return
          }
        }

        // Get email
        let email = options.email
        if (!email) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'email',
              message: 'Enter your email address:',
              validate: (input: string) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                return emailRegex.test(input) || 'Please enter a valid email address'
              },
            },
          ])
          email = answers.email
        }

        // Send OTP
        const spinner = ora('Sending verification code...').start()
        const otpResponse = await sendOTP(email)

        if (!otpResponse.success) {
          spinner.fail('Failed to send verification code')
          output.error(otpResponse.message || 'Unknown error')
          return
        }

        spinner.succeed('Verification code sent to your email')

        // In development, show the OTP
        if (otpResponse.otp) {
          output.warn(`Development mode: Your OTP is ${otpResponse.otp}`)
        }

        // Get OTP from user
        const { otp } = await inquirer.prompt([
          {
            type: 'input',
            name: 'otp',
            message: 'Enter the 6-digit verification code:',
            validate: (input: string) => {
              return /^\d{6}$/.test(input) || 'Please enter a valid 6-digit code'
            },
          },
        ])

        // Verify OTP
        const verifySpinner = ora('Verifying...').start()
        const authResponse = await verifyOTP(email, otp)

        setAuthToken(authResponse.token)
        verifySpinner.succeed('Successfully logged in!')

        output.subheader('Welcome!')
        output.keyValue([
          ['Email', authResponse.user.email],
          ['Role', authResponse.user.role],
          ['User ID', authResponse.user.user_id],
        ])
      } catch (err) {
        if (err instanceof ApiError) {
          output.error(err.message)
        } else if (err instanceof Error) {
          output.error(err.message)
        }
        process.exit(1)
      }
    })

  auth
    .command('logout')
    .description('Log out from RAGbox')
    .action(async () => {
      if (!isAuthenticated()) {
        output.info('You are not logged in.')
        return
      }

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to log out?',
          default: true,
        },
      ])

      if (confirm) {
        clearAuth()
        output.success('Successfully logged out.')
      } else {
        output.info('Logout cancelled.')
      }
    })

  auth
    .command('whoami')
    .description('Show current user information')
    .action(async () => {
      if (!isAuthenticated()) {
        output.error('You are not logged in. Run `ragbox auth login` to log in.')
        process.exit(1)
      }

      const spinner = ora('Fetching user information...').start()

      try {
        const user = await getCurrentUser()
        spinner.stop()

        output.subheader('Current User')
        output.keyValue([
          ['Email', user.email],
          ['Role', user.role],
          ['Status', user.status],
          ['User ID', user.user_id],
          ['Last Login', output.formatDate(user.last_login_at)],
          ['Created At', output.formatDate(user.created_at)],
        ])
      } catch (err) {
        spinner.fail('Failed to fetch user information')
        if (err instanceof ApiError) {
          if (err.statusCode === 401) {
            output.error('Your session has expired. Please log in again.')
            clearAuth()
          } else {
            output.error(err.message)
          }
        }
        process.exit(1)
      }
    })

  auth
    .command('status')
    .description('Check authentication status')
    .action(() => {
      if (isAuthenticated()) {
        output.success('Authenticated')
        const token = getAuthToken()
        if (token) {
          // Show partial token for debugging
          const masked = token.slice(0, 8) + '...' + token.slice(-8)
          output.info(`Token: ${masked}`)
        }
      } else {
        output.warn('Not authenticated')
        output.info('Run `ragbox auth login` to log in.')
      }
    })

  return auth
}
