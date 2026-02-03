import { PredictionServiceClient } from '@google-cloud/aiplatform'
import type { LLMProvider } from './provider'
import type { LLMResponse, LLMStreamChunk } from '@/types'
import { buildRAGPrompt, RAGBOX_SYSTEM_PROMPT } from './provider'

/**
 * Vertex AI Llama Provider
 *
 * Production provider using Llama 3.3 70B hosted on Vertex AI Model Garden.
 * Provides high-quality RAG responses with strong reasoning capabilities.
 *
 * Requires:
 * - GOOGLE_CLOUD_PROJECT environment variable
 * - VERTEX_AI_LOCATION environment variable (defaults to us-central1)
 * - VERTEX_LLAMA_ENDPOINT_ID environment variable (Model Garden endpoint)
 * - Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
 */
export class VertexLlamaProvider implements LLMProvider {
  private client: PredictionServiceClient
  private endpointPath: string
  readonly model: string
  readonly name = 'vertex-llama'

  constructor(
    projectId: string,
    location: string = 'us-central1',
    endpointId?: string,
    model: string = 'llama-3.3-70b-instruct'
  ) {
    if (!projectId) {
      throw new Error('GCP project ID is required for Vertex Llama provider')
    }

    this.client = new PredictionServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    })

    // For Model Garden publisher models, use the publisher model path
    // For deployed endpoints, use the endpoint path
    if (endpointId) {
      this.endpointPath = `projects/${projectId}/locations/${location}/endpoints/${endpointId}`
    } else {
      // Use Model Garden publisher model endpoint for Llama 3.3
      this.endpointPath = `projects/${projectId}/locations/${location}/publishers/meta/models/${model}`
    }

    this.model = model
  }

  async generate(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): Promise<LLMResponse> {
    const fullPrompt = this.formatPrompt(prompt, context, systemPrompt)

    const [response] = await this.client.predict({
      endpoint: this.endpointPath,
      instances: [
        {
          structValue: {
            fields: {
              prompt: { stringValue: fullPrompt },
              max_tokens: { numberValue: 2048 },
              temperature: { numberValue: 0.3 },
              top_p: { numberValue: 0.95 },
            },
          },
        },
      ],
      parameters: {
        structValue: {
          fields: {
            max_tokens: { numberValue: 2048 },
            temperature: { numberValue: 0.3 },
          },
        },
      },
    })

    const predictions = response.predictions ?? []
    const prediction = predictions[0]

    let text = ''
    if (prediction?.structValue?.fields?.content?.stringValue) {
      text = prediction.structValue.fields.content.stringValue
    } else if (prediction?.stringValue) {
      text = prediction.stringValue
    }

    // Extract token counts from metadata if available
    const metadata = response.metadata?.structValue?.fields
    const inputTokens = metadata?.input_token_count?.numberValue ?? 0
    const outputTokens = metadata?.output_token_count?.numberValue ?? 0

    return {
      text,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
      model: this.model,
    }
  }

  async *stream(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): AsyncIterable<LLMStreamChunk> {
    // Vertex AI Llama endpoints support streaming via serverStreamingPredict
    const fullPrompt = this.formatPrompt(prompt, context, systemPrompt)

    const request = {
      endpoint: this.endpointPath,
      inputs: [
        {
          structValue: {
            fields: {
              prompt: { stringValue: fullPrompt },
              max_tokens: { numberValue: 2048 },
              temperature: { numberValue: 0.3 },
              top_p: { numberValue: 0.95 },
              stream: { boolValue: true },
            },
          },
        },
      ],
    }

    const stream = this.client.serverStreamingPredict(request)

    for await (const chunk of stream) {
      const outputs = chunk.outputs ?? []
      for (const output of outputs) {
        let text = ''
        if (output?.structValue?.fields?.content?.stringValue) {
          text = output.structValue.fields.content.stringValue
        } else if (output?.stringValue) {
          text = output.stringValue
        }

        if (text) {
          yield { text, done: false }
        }
      }
    }

    yield { text: '', done: true }
  }

  /**
   * Format prompt in Llama instruction format
   */
  private formatPrompt(
    prompt: string,
    context: string[],
    systemPrompt: string
  ): string {
    const ragPrompt = buildRAGPrompt(prompt, context)

    // Llama 3 instruction format
    return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

${ragPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`
  }
}
