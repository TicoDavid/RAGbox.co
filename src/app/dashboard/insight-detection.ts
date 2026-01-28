/**
 * Insight Detection Module for RAGbox
 * Pattern-based detection for extracting actionable insights from AI responses
 */

import type { InsightType, ParsedInsight, InsightAction, ArtifactType } from './types';

// Detection rule configuration
export interface InsightDetectionRule {
  type: InsightType;
  patterns: RegExp[];
  keywords: string[];
  actions: InsightAction[];
}

// Insight detection rules
const INSIGHT_RULES: InsightDetectionRule[] = [
  {
    type: 'data_trend',
    patterns: [
      /(?:increased|decreased|grew|fell|rose|dropped)\s+(?:by\s+)?(\d+(?:\.\d+)?%?)/gi,
      /(\d+(?:\.\d+)?%?)\s+(?:increase|decrease|growth|decline|change)/gi,
      /(?:YoY|QoQ|MoM|year-over-year|quarter-over-quarter)/gi,
      /(?:from|was)\s+\$?[\d,]+(?:\.\d+)?[MBK]?\s+(?:to|reaching)\s+\$?[\d,]+(?:\.\d+)?[MBK]?/gi,
      /revenue|profit|margin|sales|growth\s+(?:of|at)\s+\d+/gi
    ],
    keywords: ['revenue', 'growth', 'trend', 'increased', 'decreased', 'YoY', 'QoQ', 'MoM', 'quarterly', 'annual'],
    actions: [
      { id: 'visualize_trend', label: 'Visualize Trend', icon: 'chart', artifactType: 'chart' },
      { id: 'generate_report', label: 'Generate Report', icon: 'file', artifactType: 'ui' }
    ]
  },
  {
    type: 'risk_assessment',
    patterns: [
      /risk\s+(?:identified|found|detected|level|assessment)/gi,
      /(?:compliance|regulatory)\s+(?:exposure|issue|concern|violation)/gi,
      /(?:liability|exposure|vulnerability)\s+(?:in|regarding|related)/gi,
      /(?:requires?|needs?)\s+(?:immediate|urgent)\s+attention/gi,
      /(?:high|medium|low)\s+(?:risk|priority|severity)/gi
    ],
    keywords: ['risk', 'compliance', 'liability', 'exposure', 'vulnerability', 'urgent', 'attention', 'violation'],
    actions: [
      { id: 'create_assessment', label: 'Risk Assessment', icon: 'alert', artifactType: 'ui' },
      { id: 'generate_brief', label: 'Video Brief', icon: 'video', artifactType: 'video' }
    ]
  },
  {
    type: 'key_clause',
    patterns: [
      /(?:clause|section|article|provision)\s+(?:\d+(?:\.\d+)?|[IVX]+)/gi,
      /(?:pursuant|according|subject)\s+to\s+(?:article|section|clause)/gi,
      /"[^"]{20,}"/g, // Quoted text longer than 20 chars
      /(?:shall|must|will)\s+(?:maintain|provide|ensure|comply)/gi,
      /(?:terms?|condition|requirement)\s+(?:states?|specif(?:y|ies)|requires?)/gi
    ],
    keywords: ['clause', 'section', 'article', 'pursuant', 'shall', 'terms', 'provision', 'agreement'],
    actions: [
      { id: 'highlight_doc', label: 'Highlight Source', icon: 'file', artifactType: 'ui' },
      { id: 'summarize_clause', label: 'Summarize Clause', icon: 'text', artifactType: 'ui' }
    ]
  },
  {
    type: 'comparison',
    patterns: [
      /(?:compared|versus|vs\.?|relative)\s+to/gi,
      /(?:higher|lower|greater|less)\s+than/gi,
      /(?:outperformed|underperformed|exceeded|fell short)/gi,
      /(?:difference|gap|variance)\s+(?:of|between)/gi,
      /(\d+(?:\.\d+)?%?)\s+(?:more|less|higher|lower)\s+than/gi
    ],
    keywords: ['compared', 'versus', 'vs', 'than', 'difference', 'gap', 'relative', 'benchmark'],
    actions: [
      { id: 'create_chart', label: 'Comparison Chart', icon: 'chart', artifactType: 'chart' },
      { id: 'generate_table', label: 'Comparison Table', icon: 'table', artifactType: 'ui' }
    ]
  },
  {
    type: 'recommendation',
    patterns: [
      /(?:recommend|suggest|advise|propose)\s+(?:that|to)?/gi,
      /(?:should|could|would)\s+(?:consider|implement|review|address)/gi,
      /(?:action\s+item|next\s+step|follow-up)/gi,
      /(?:priority|prioritize)\s+(?:action|task|item)/gi,
      /(?:immediate|prompt|urgent)\s+(?:action|attention|review)/gi
    ],
    keywords: ['recommend', 'suggest', 'should', 'action', 'priority', 'implement', 'consider', 'advise'],
    actions: [
      { id: 'create_action', label: 'Action Card', icon: 'lightbulb', artifactType: 'ui' },
      { id: 'priority_matrix', label: 'Priority Matrix', icon: 'chart', artifactType: 'chart' }
    ]
  }
];

/**
 * Extract key datapoints from insight content
 */
function extractKeyDatapoints(content: string, type: InsightType): Record<string, string> {
  const datapoints: Record<string, string> = {};

  if (type === 'data_trend') {
    // Extract percentages
    const percentMatch = content.match(/(\d+(?:\.\d+)?%)/);
    if (percentMatch) {
      datapoints['change'] = percentMatch[1];
    }
    // Extract monetary values
    const moneyMatch = content.match(/\$[\d,]+(?:\.\d+)?[MBK]?/g);
    if (moneyMatch && moneyMatch.length >= 2) {
      datapoints['from'] = moneyMatch[0];
      datapoints['to'] = moneyMatch[1];
    }
    // Extract time period
    const periodMatch = content.match(/Q[1-4]\s+20\d{2}|20\d{2}/g);
    if (periodMatch) {
      datapoints['period'] = periodMatch.join(' to ');
    }
  }

  if (type === 'risk_assessment') {
    // Extract risk level
    const levelMatch = content.match(/(?:high|medium|low)\s+(?:risk|priority|severity)/i);
    if (levelMatch) {
      datapoints['level'] = levelMatch[0];
    }
    // Extract section reference
    const sectionMatch = content.match(/section\s+[\d.]+/i);
    if (sectionMatch) {
      datapoints['section'] = sectionMatch[0];
    }
  }

  if (type === 'key_clause') {
    // Extract clause reference
    const clauseMatch = content.match(/(?:clause|section|article)\s+[\d.]+/i);
    if (clauseMatch) {
      datapoints['reference'] = clauseMatch[0];
    }
  }

  return datapoints;
}

/**
 * Extract citations from content
 */
function extractCitations(content: string): string[] {
  const citations: string[] = [];

  // Match [Document: X] pattern
  const docMatches = content.match(/\[Document:\s*[^\]]+\]/g);
  if (docMatches) {
    citations.push(...docMatches);
  }

  // Match source references
  const sourceMatches = content.match(/\[Source:\s*[^\]]+\]/g);
  if (sourceMatches) {
    citations.push(...sourceMatches);
  }

  return Array.from(new Set(citations));
}

/**
 * Generate a title for the insight based on type and content
 */
function generateInsightTitle(content: string, type: InsightType): string {
  const maxLength = 60;

  switch (type) {
    case 'data_trend': {
      const percentMatch = content.match(/(\d+(?:\.\d+)?%)/);
      const directionMatch = content.match(/(increased|decreased|grew|fell|rose|dropped)/i);
      if (percentMatch && directionMatch) {
        return `${directionMatch[1].charAt(0).toUpperCase() + directionMatch[1].slice(1)} ${percentMatch[1]}`;
      }
      return 'Data Trend Identified';
    }
    case 'risk_assessment': {
      const levelMatch = content.match(/(high|medium|low)\s+(risk|priority)/i);
      if (levelMatch) {
        return `${levelMatch[1].charAt(0).toUpperCase() + levelMatch[1].slice(1)} ${levelMatch[2].charAt(0).toUpperCase() + levelMatch[2].slice(1)} Alert`;
      }
      return 'Risk Assessment';
    }
    case 'key_clause': {
      const clauseMatch = content.match(/(?:clause|section|article)\s+[\d.]+/i);
      if (clauseMatch) {
        return `Key ${clauseMatch[0].charAt(0).toUpperCase() + clauseMatch[0].slice(1)}`;
      }
      return 'Key Clause Identified';
    }
    case 'comparison':
      return 'Comparison Analysis';
    case 'recommendation':
      return 'Recommended Action';
    default:
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }
}

/**
 * Calculate confidence score for an insight match
 */
function calculateConfidence(content: string, rule: InsightDetectionRule): number {
  let score = 0;

  // Check pattern matches
  for (const pattern of rule.patterns) {
    const matches = content.match(pattern);
    if (matches) {
      score += matches.length * 15;
    }
  }

  // Check keyword matches
  const lowerContent = content.toLowerCase();
  for (const keyword of rule.keywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

/**
 * Detect insights in a message text
 */
export function detectInsights(messageId: string, text: string): ParsedInsight[] {
  const insights: ParsedInsight[] = [];

  // Split text into logical blocks (by bullet points or paragraphs)
  const blocks = text.split(/(?:^|\n)\s*[•\-\*]\s*/);

  blocks.forEach((block, index) => {
    if (!block.trim() || block.length < 20) return;

    // Find best matching rule
    let bestRule: InsightDetectionRule | null = null;
    let bestConfidence = 0;

    for (const rule of INSIGHT_RULES) {
      const confidence = calculateConfidence(block, rule);
      if (confidence > bestConfidence && confidence >= 25) {
        bestConfidence = confidence;
        bestRule = rule;
      }
    }

    if (bestRule) {
      const insight: ParsedInsight = {
        id: `${messageId}_insight_${index}`,
        sourceMessageId: messageId,
        type: bestRule.type,
        title: generateInsightTitle(block, bestRule.type),
        content: block.trim(),
        keyDatapoints: extractKeyDatapoints(block, bestRule.type),
        sourceCitations: extractCitations(block)
      };

      insights.push(insight);
    }
  });

  return insights;
}

/**
 * Get available actions for an insight type
 */
export function getActionsForInsight(type: InsightType): InsightAction[] {
  const rule = INSIGHT_RULES.find(r => r.type === type);
  return rule?.actions || [];
}

/**
 * Get the primary color for an insight type
 */
export function getInsightColor(type: InsightType): string {
  switch (type) {
    case 'data_trend':
      return '#0000FF'; // Blue
    case 'risk_assessment':
      return '#FF3D00'; // Red
    case 'key_clause':
      return '#FFAB00'; // Amber
    case 'comparison':
      return '#06b6d4'; // Cyan
    case 'recommendation':
      return '#10B981'; // Green
    default:
      return '#0000FF';
  }
}

/**
 * Get display name for insight type
 */
export function getInsightTypeName(type: InsightType): string {
  switch (type) {
    case 'data_trend':
      return 'Data Trend';
    case 'risk_assessment':
      return 'Risk Alert';
    case 'key_clause':
      return 'Key Clause';
    case 'comparison':
      return 'Comparison';
    case 'recommendation':
      return 'Recommendation';
    default:
      return 'Insight';
  }
}
