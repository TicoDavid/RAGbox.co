/**
 * BigQuery Client - RAGbox.co
 *
 * Provides BigQuery integration for audit logging.
 * Supports append-only writes for WORM compliance.
 * Lazy-initializes dataset and table on first insert.
 */

import { BigQuery, Table } from '@google-cloud/bigquery'

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID
const DATASET_ID = process.env.BIGQUERY_DATASET || 'ragbox_audit'
const TABLE_ID = process.env.BIGQUERY_TABLE || 'audit_log'

let bigQueryClient: BigQuery | null = null
let tableInitialized = false
let tableInitFailed = false

function getClient(): BigQuery {
  if (!bigQueryClient) {
    if (!PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID environment variable is required')
    }
    bigQueryClient = new BigQuery({
      projectId: PROJECT_ID,
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
        : {}),
    })
  }
  return bigQueryClient
}

const AUDIT_TABLE_SCHEMA = [
  { name: 'event_id', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' as const },
  { name: 'user_id', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'action', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'resource_id', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'resource_type', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'severity', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'details', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'details_hash', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'ip_address', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'user_agent', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'session_id', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'inserted_at', type: 'TIMESTAMP', mode: 'REQUIRED' as const },
]

/**
 * Lazy-init: ensure dataset and table exist on first use
 */
async function ensureTableExists(): Promise<void> {
  if (tableInitialized) return

  try {
    const client = getClient()

    const dataset = client.dataset(DATASET_ID)
    const [datasetExists] = await dataset.exists()

    if (!datasetExists) {
      await client.createDataset(DATASET_ID, { location: 'US' })
      console.log(`[BigQuery] Created dataset: ${DATASET_ID}`)
    }

    const table = dataset.table(TABLE_ID)
    const [tableExists] = await table.exists()

    if (!tableExists) {
      await dataset.createTable(TABLE_ID, {
        schema: AUDIT_TABLE_SCHEMA,
        timePartitioning: {
          type: 'DAY',
          field: 'timestamp',
          expirationMs: String(7 * 365 * 24 * 60 * 60 * 1000),
        },
      })
      console.log(`[BigQuery] Created table: ${DATASET_ID}.${TABLE_ID}`)
    }

    tableInitialized = true
  } catch (error) {
    console.warn('[BigQuery] Table initialization failed (audit writes will be skipped):', error)
    tableInitialized = true
    tableInitFailed = true
  }
}

export async function ensureAuditTable(): Promise<void> {
  return ensureTableExists()
}

function getAuditTable(): Table {
  const client = getClient()
  return client.dataset(DATASET_ID).table(TABLE_ID)
}

export interface BigQueryAuditRow {
  event_id: string
  timestamp: string
  user_id: string | null
  action: string
  resource_id: string | null
  resource_type: string | null
  severity: string
  details: string
  details_hash: string
  ip_address: string | null
  user_agent: string | null
  session_id: string | null
  inserted_at: string
}

/**
 * Insert a single audit row (lazy-inits table)
 */
export async function insertAuditRow(row: BigQueryAuditRow): Promise<void> {
  await ensureTableExists()
  if (tableInitFailed) return

  const table = getAuditTable()
  await table.insert([row], {
    skipInvalidRows: false,
    ignoreUnknownValues: false,
  })
}

/**
 * Insert multiple audit rows (batch)
 */
export async function insertAuditRows(rows: BigQueryAuditRow[]): Promise<void> {
  if (rows.length === 0) return

  await ensureTableExists()
  if (tableInitFailed) return

  const table = getAuditTable()
  await table.insert(rows, {
    skipInvalidRows: false,
    ignoreUnknownValues: false,
  })
}

export interface AuditQueryOptions {
  userId?: string
  action?: string
  startDate?: Date
  endDate?: Date
  resourceType?: string
  resourceId?: string
  limit?: number
  offset?: number
}

export async function queryAuditLogs(
  options: AuditQueryOptions = {}
): Promise<BigQueryAuditRow[]> {
  const client = getClient()
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (options.userId) {
    conditions.push('user_id = @userId')
    params.userId = options.userId
  }

  if (options.action) {
    conditions.push('action = @action')
    params.action = options.action
  }

  if (options.startDate) {
    conditions.push('timestamp >= @startDate')
    params.startDate = options.startDate.toISOString()
  }

  if (options.endDate) {
    conditions.push('timestamp <= @endDate')
    params.endDate = options.endDate.toISOString()
  }

  if (options.resourceType) {
    conditions.push('resource_type = @resourceType')
    params.resourceType = options.resourceType
  }

  if (options.resourceId) {
    conditions.push('resource_id = @resourceId')
    params.resourceId = options.resourceId
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = options.limit || 100
  const offset = options.offset || 0

  const query = `
    SELECT *
    FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const [rows] = await client.query({ query, params })
  return rows as BigQueryAuditRow[]
}

export interface AuditStats {
  totalEvents: number
  eventsByAction: Record<string, number>
  eventsBySeverity: Record<string, number>
  uniqueUsers: number
}

export async function getAuditStats(
  startDate: Date,
  endDate: Date
): Promise<AuditStats> {
  const client = getClient()

  const query = `
    SELECT
      COUNT(*) as total_events,
      COUNT(DISTINCT user_id) as unique_users
    FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE timestamp >= @startDate AND timestamp <= @endDate
  `

  const [rows] = await client.query({
    query,
    params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  })

  const actionQuery = `
    SELECT action, COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE timestamp >= @startDate AND timestamp <= @endDate
    GROUP BY action
  `

  const [actionRows] = await client.query({
    query: actionQuery,
    params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  })

  const severityQuery = `
    SELECT severity, COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE timestamp >= @startDate AND timestamp <= @endDate
    GROUP BY severity
  `

  const [severityRows] = await client.query({
    query: severityQuery,
    params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  })

  const eventsByAction: Record<string, number> = {}
  for (const row of actionRows as Array<{ action: string; count: number }>) {
    eventsByAction[row.action] = Number(row.count)
  }

  const eventsBySeverity: Record<string, number> = {}
  for (const row of severityRows as Array<{ severity: string; count: number }>) {
    eventsBySeverity[row.severity] = Number(row.count)
  }

  return {
    totalEvents: Number((rows[0] as { total_events: number }).total_events),
    eventsByAction,
    eventsBySeverity,
    uniqueUsers: Number((rows[0] as { unique_users: number }).unique_users),
  }
}

export async function checkBigQueryHealth(): Promise<boolean> {
  try {
    const client = getClient()
    const [datasets] = await client.getDatasets()
    return datasets.length >= 0
  } catch (error) {
    console.error('BigQuery health check failed:', error)
    return false
  }
}
