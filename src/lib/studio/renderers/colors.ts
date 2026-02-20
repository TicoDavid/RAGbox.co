/**
 * Centralized color constants for Sovereign Studio renderers.
 *
 * These renderers generate static files (PDF, PPTX, XLSX, HTML) that cannot
 * reference CSS custom properties at runtime. All renderer colors live here
 * so a theme change only requires updating one file.
 *
 * Values mirror the Midnight Cobalt theme from design-tokens.css.
 */

// ─── Brand ───
export const BRAND_BLUE = '#2463EB'
export const BRAND_BLUE_HOVER = '#60A5FA'

// ─── Backgrounds ───
export const DARK_BG = '#0A192F'
export const CARD_BG = '#112240'
export const TERTIARY_BG = '#1B2D4B'

// ─── Text ───
export const TEXT_PRIMARY = '#E5E7EB'
export const TEXT_SECONDARY = '#94A3B8'

// ─── Borders ───
export const BORDER_DEFAULT = '#233554'

// ─── Status ───
export const SUCCESS = '#10B981'
export const DANGER = '#EF4444'
export const WARNING = '#F59E0B'
export const WARNING_DIM = '#D97706'
export const INFO_BLUE = '#3B82F6'

// ─── PPTX-specific (no # prefix — pptxgenjs uses bare hex) ───
export const PPTX_BRAND = '2463EB'
export const PPTX_DARK_BG = '0A192F'
export const PPTX_TEXT_LIGHT = 'E5E7EB'
export const PPTX_TEXT_MUTED = '94A3B8'

// ─── XLSX-specific (ARGB with FF prefix — exceljs format) ───
export const XLSX_HEADER_BG = 'FF0A192F'
export const XLSX_HEADER_FG = 'FFE5E7EB'
export const XLSX_SEVERITY: Record<string, string> = {
  critical: 'FFDC2626',
  high: 'FFF59E0B',
  medium: 'FF3B82F6',
  low: 'FF10B981',
}
