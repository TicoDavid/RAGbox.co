/**
 * Audio Conversion — ffmpeg OGG/Opus → WAV
 *
 * Converts WhatsApp voice messages (OGG/Opus) to PCM WAV
 * for STT transcription. Requires ffmpeg installed in the container.
 *
 * S-P0-03
 */

import { spawn } from 'child_process'
import { logger } from '@/lib/logger'

/**
 * Convert an OGG/Opus audio buffer to 16-bit PCM WAV at 16 kHz mono.
 * This format is optimal for STT services (Deepgram, Google STT).
 */
export async function convertOggToWav(oggBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',       // Read from stdin
      '-ar', '16000',        // 16 kHz sample rate (STT standard)
      '-ac', '1',            // Mono
      '-f', 'wav',           // Output format
      '-acodec', 'pcm_s16le', // 16-bit PCM
      'pipe:1',              // Write to stdout
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const chunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    ffmpeg.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks))
      } else {
        const stderr = Buffer.concat(stderrChunks).toString()
        logger.error('[AudioConvert] ffmpeg failed', { code, stderr: stderr.slice(-500) })
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })

    ffmpeg.on('error', (err) => {
      logger.error('[AudioConvert] ffmpeg spawn error', err)
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`))
    })

    ffmpeg.stdin.write(oggBuffer)
    ffmpeg.stdin.end()
  })
}

/**
 * Convert an OGG/Opus audio buffer to MP3 for browser playback.
 */
export async function convertOggToMp3(oggBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-ar', '44100',
      '-ac', '1',
      '-b:a', '128k',
      '-f', 'mp3',
      'pipe:1',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const chunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    ffmpeg.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks))
      } else {
        const stderr = Buffer.concat(stderrChunks).toString()
        logger.error('[AudioConvert] ffmpeg MP3 conversion failed', { code, stderr: stderr.slice(-500) })
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`))
    })

    ffmpeg.stdin.write(oggBuffer)
    ffmpeg.stdin.end()
  })
}
