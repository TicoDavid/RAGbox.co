import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerateContentResult,
} from '@google-cloud/vertexai'
import type { LLMProvider } from './provider'
import type { LLMResponse, LLMStreamChunk } from '@/types'
import { buildRAGPrompt, RAGBOX_SYSTEM_PROMPT } from './provider'

/**
 * Vertex AI Gemini Provider
 *
 * Production fallback provider that stays within GCP trust boundary.
 * Uses Gemini 1.5 Pro via Vertex AI for RAG query generation.
 *
 * Requires:
 * - GOOGLE_CLOUD_PROJECT environment variable
 * - VERTEX_AI_LOCATION environment variable (defaults to us-central1)
 * - Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
 */
export class VertexGeminiProvider implements LLMProvider {
  private vertexAI: VertexAI
  readonly model: string
  readonly name = 'vertex-gemini'

  constructor(
    projectId: string,
    location: string = 'us-central1',
    model: string = 'gemini-1.5-pro'
  ) {
    if (!projectId) {
      throw new Error('GCP project ID is required for Vertex Gemini provider')
    }
    this.vertexAI = new VertexAI({ project: projectId, location })
    this.model = model
  }

  async generate(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): Promise<LLMResponse> {
    const generativeModel = this.vertexAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    })

    const result: GenerateContentResult = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildRAGPrompt(prompt, context) }],
        },
      ],
    })

    const response = result.response
    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('') ?? ''

    return {
      text,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      model: this.model,
    }
  }

  async *stream(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): AsyncIterable<LLMStreamChunk> {
    const generativeModel = this.vertexAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    })

    const streamResult = await generativeModel.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildRAGPrompt(prompt, context) }],
        },
      ],
    })

    for await (const chunk of streamResult.stream) {
      const text =
        chunk.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('') ?? ''

      const finishReason = chunk.candidates?.[0]?.finishReason

      if (text) {
        yield { text, done: false }
      }

      if (finishReason) {
        yield { text: '', done: true }
      }
    }
  }
}
