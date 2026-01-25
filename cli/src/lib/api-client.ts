import { getConfig, getAuthToken } from './config-store.js'
import { debug } from './output.js'
import type {
  ApiResponse,
  AuthResponse,
  OTPResponse,
  Document,
  DocumentListResponse,
  UploadResponse,
  Vault,
  VaultListResponse,
  QueryResponse,
  RefusalResponse,
  AuditLogResponse,
  User,
} from '../types.js'

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getConfig()
  const token = getAuthToken()

  const url = `${config.apiUrl}${endpoint}`
  debug(`API Request: ${options.method || 'GET'} ${url}`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    const data = await response.json() as ApiResponse<T>

    if (!response.ok) {
      throw new ApiError(
        data.error || `HTTP ${response.status}`,
        response.status
      )
    }

    if (!data.success && data.error) {
      throw new ApiError(data.error, response.status)
    }

    return data.data as T
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new ApiError(
        `Cannot connect to API at ${config.apiUrl}. Is the server running?`,
        0,
        'CONNECTION_ERROR'
      )
    }
    throw err
  }
}

async function requestRaw(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const config = getConfig()
  const token = getAuthToken()

  const url = `${config.apiUrl}${endpoint}`
  debug(`API Request (raw): ${options.method || 'GET'} ${url}`)

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

// ===========================================
// Authentication
// ===========================================

export async function sendOTP(email: string): Promise<OTPResponse> {
  const config = getConfig()
  const response = await fetch(`${config.apiUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = await response.json() as OTPResponse
  return data
}

export async function verifyOTP(
  email: string,
  otp: string
): Promise<AuthResponse> {
  const config = getConfig()
  const response = await fetch(`${config.apiUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  })

  if (!response.ok) {
    const data = await response.json() as { error?: string }
    throw new ApiError(data.error || 'Invalid OTP', response.status)
  }

  const data = await response.json() as AuthResponse
  return data
}

export async function getCurrentUser(): Promise<User> {
  return request<User>('/api/auth/me')
}

// ===========================================
// Vaults
// ===========================================

export async function listVaults(): Promise<VaultListResponse> {
  return request<VaultListResponse>('/api/vaults')
}

export async function getVault(vaultId: string): Promise<Vault> {
  return request<Vault>(`/api/vaults/${vaultId}`)
}

export async function createVault(name: string): Promise<Vault> {
  return request<Vault>('/api/vaults', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

// ===========================================
// Documents
// ===========================================

export async function listDocuments(
  vaultId: string,
  options: { page?: number; pageSize?: number; includePrivileged?: boolean } = {}
): Promise<DocumentListResponse> {
  const params = new URLSearchParams()
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.includePrivileged) params.set('includePrivileged', 'true')

  const queryStr = params.toString()
  return request<DocumentListResponse>(
    `/api/vaults/${vaultId}/documents${queryStr ? `?${queryStr}` : ''}`
  )
}

export async function getDocument(
  vaultId: string,
  documentId: string
): Promise<Document> {
  return request<Document>(`/api/vaults/${vaultId}/documents/${documentId}`)
}

export async function uploadDocument(
  vaultId: string,
  filePath: string,
  options: { privileged?: boolean } = {}
): Promise<UploadResponse> {
  const fs = await import('fs')
  const path = await import('path')
  const FormData = (await import('form-data')).default

  const filename = path.basename(filePath)
  const fileStream = fs.createReadStream(filePath)
  const stats = fs.statSync(filePath)

  const form = new FormData()
  form.append('file', fileStream, {
    filename,
    knownLength: stats.size,
  })

  if (options.privileged) {
    form.append('privileged', 'true')
  }

  const config = getConfig()
  const token = getAuthToken()

  const headers: Record<string, string> = {
    ...form.getHeaders(),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Use node-fetch compatible approach
  const nodeFetch = (await import('node-fetch')).default
  const response = await nodeFetch(`${config.apiUrl}/api/vaults/${vaultId}/documents`, {
    method: 'POST',
    headers,
    body: form as unknown as import('node-fetch').BodyInit,
  })

  const data = await response.json() as ApiResponse<UploadResponse>

  if (!response.ok || !data.success) {
    throw new ApiError(data.error || 'Upload failed', response.status)
  }

  return data.data as UploadResponse
}

export async function deleteDocument(
  vaultId: string,
  documentId: string
): Promise<void> {
  return request<void>(`/api/vaults/${vaultId}/documents/${documentId}`, {
    method: 'DELETE',
  })
}

export async function togglePrivilege(
  vaultId: string,
  documentId: string,
  privileged: boolean
): Promise<Document> {
  return request<Document>(
    `/api/vaults/${vaultId}/documents/${documentId}/privilege`,
    {
      method: 'PATCH',
      body: JSON.stringify({ privileged }),
    }
  )
}

// ===========================================
// Queries (RAG)
// ===========================================

export async function query(
  vaultId: string,
  queryText: string
): Promise<QueryResponse | RefusalResponse> {
  return request<QueryResponse | RefusalResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      query: queryText,
      vault_id: vaultId,
    }),
  })
}

export async function* queryStream(
  vaultId: string,
  queryText: string
): AsyncGenerator<string, void, unknown> {
  const config = getConfig()
  const token = getAuthToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${config.apiUrl}/api/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: queryText,
      vault_id: vaultId,
    }),
  })

  if (!response.ok) {
    const data = await response.json() as { error?: string }
    throw new ApiError(data.error || 'Query failed', response.status)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new ApiError('No response body', 500)
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const eventData = line.slice(6)
        if (eventData === '[DONE]') return
        try {
          const parsed = JSON.parse(eventData) as { text?: string }
          if (parsed.text) {
            yield parsed.text
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

// ===========================================
// Audit Log
// ===========================================

export async function getAuditLog(
  options: {
    page?: number
    pageSize?: number
    actionType?: string
    userId?: string
    startDate?: string
    endDate?: string
  } = {}
): Promise<AuditLogResponse> {
  const params = new URLSearchParams()
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.actionType) params.set('actionType', options.actionType)
  if (options.userId) params.set('userId', options.userId)
  if (options.startDate) params.set('startDate', options.startDate)
  if (options.endDate) params.set('endDate', options.endDate)

  const queryStr = params.toString()
  return request<AuditLogResponse>(`/api/audit${queryStr ? `?${queryStr}` : ''}`)
}

export async function exportAuditLog(
  format: 'pdf' | 'csv' = 'pdf'
): Promise<Buffer> {
  const response = await requestRaw(`/api/audit/export?format=${format}`)

  if (!response.ok) {
    const data = await response.json() as { error?: string }
    throw new ApiError(data.error || 'Export failed', response.status)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ===========================================
// Health Check
// ===========================================

export async function healthCheck(): Promise<{ status: string; version: string }> {
  const config = getConfig()
  const response = await fetch(`${config.apiUrl}/api/health`)
  const data = await response.json() as { status: string; version: string }
  return data
}
