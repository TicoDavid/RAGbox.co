/**
 * Citations — Barrel export
 *
 * Types, transform, and channel-specific renderers.
 */

// Types
export type {
  CitationBlock,
  ConfidenceLevel,
  ConfidenceColor,
  SourceType,
} from './types'
export { getConfidenceLevel, getConfidenceColor, isLowConfidence } from './types'

// Transform
export { toCitationBlocks } from './transform'
export type { TransformOptions } from './transform'

// Renderers
export { formatCitationBlocksForRoam } from './renderers/roam'
export { CitationCard } from './renderers/dashboard'
export { formatCitationBlocksForApi } from './renderers/api'
export { formatCitationBlocksForMercury } from './renderers/mercury'
