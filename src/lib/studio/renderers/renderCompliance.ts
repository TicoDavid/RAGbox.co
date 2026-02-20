/**
 * Compliance Drill Renderer — JSON → PDF
 *
 * Converts ComplianceDrill data (flashcards + quiz) into a branded PDF
 * using @react-pdf/renderer. Runs server-side only (Node.js).
 */

import React from 'react'
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ComplianceDrill } from '../types'

const BRAND_BLUE = '#2463EB'
const DARK_BG = '#0A192F'
const CARD_BG = '#112240'
const TEXT_PRIMARY = '#E5E7EB'
const TEXT_SECONDARY = '#94A3B8'
const ACCENT_AMBER = '#F59E0B'
const SUCCESS = '#10B981'
const DANGER = '#EF4444'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: SUCCESS,
  medium: ACCENT_AMBER,
  hard: DANGER,
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: DARK_BG,
    padding: 40,
    fontFamily: 'Helvetica',
  },
  watermark: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  header: {
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    color: TEXT_PRIMARY,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  description: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    lineHeight: 1.4,
  },
  sectionLabel: {
    fontSize: 14,
    color: BRAND_BLUE,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BRAND_BLUE,
  },
  // Flashcard grid
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  flashcard: {
    backgroundColor: CARD_BG,
    borderRadius: 6,
    padding: 12,
    width: '47%',
    marginBottom: 10,
  },
  cardCategory: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardQuestion: {
    fontSize: 10,
    color: TEXT_PRIMARY,
    fontWeight: 'bold',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  cardAnswer: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    lineHeight: 1.4,
  },
  difficultyBadge: {
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  // Quiz section
  quizItem: {
    backgroundColor: CARD_BG,
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
  },
  quizNumber: {
    fontSize: 8,
    color: BRAND_BLUE,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quizQuestion: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 1.4,
  },
  optionRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  optionLetter: {
    fontSize: 9,
    fontWeight: 'bold',
    width: 20,
  },
  optionText: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    flex: 1,
  },
  explanation: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#233554',
  },
  explanationLabel: {
    fontSize: 8,
    color: SUCCESS,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  explanationText: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: TEXT_SECONDARY,
  },
})

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function buildComplianceDocument(data: ComplianceDrill) {
  const e = React.createElement

  // Flashcard elements (2-column grid)
  const flashcardElements = data.cards.map((card, i) =>
    e(View, { key: `fc-${i}`, style: styles.flashcard },
      e(Text, { style: { ...styles.cardCategory, color: DIFFICULTY_COLORS[card.difficulty] ?? ACCENT_AMBER } }, card.category),
      e(Text, { style: styles.cardQuestion }, `Q: ${card.question}`),
      e(Text, { style: styles.cardAnswer }, `A: ${card.answer}`),
      e(Text, { style: { ...styles.difficultyBadge, color: DIFFICULTY_COLORS[card.difficulty] ?? ACCENT_AMBER } }, card.difficulty),
    ),
  )

  // Quiz elements
  const quizElements = data.quiz.map((q, i) =>
    e(View, { key: `q-${i}`, style: styles.quizItem },
      e(Text, { style: styles.quizNumber }, `QUESTION ${i + 1}`),
      e(Text, { style: styles.quizQuestion }, q.question),
      ...q.options.map((opt, oi) =>
        e(View, { key: `q-${i}-o-${oi}`, style: styles.optionRow },
          e(Text, {
            style: {
              ...styles.optionLetter,
              color: oi === q.correctIndex ? SUCCESS : TEXT_SECONDARY,
            },
          }, `${OPTION_LETTERS[oi] ?? String(oi + 1)}.`),
          e(Text, {
            style: {
              ...styles.optionText,
              color: oi === q.correctIndex ? SUCCESS : TEXT_SECONDARY,
            },
          }, opt),
        ),
      ),
      e(View, { style: styles.explanation },
        e(Text, { style: styles.explanationLabel }, `ANSWER: ${OPTION_LETTERS[q.correctIndex] ?? String(q.correctIndex + 1)}`),
        e(Text, { style: styles.explanationText }, q.explanation),
      ),
    ),
  )

  // Build pages — flashcards first, then quiz
  const pages = []

  // Page 1+: Flashcards
  pages.push(
    e(Page, { key: 'p-cards', size: 'A4', style: styles.page, wrap: true },
      e(Text, { style: styles.watermark }, 'RAGBOX SOVEREIGN STUDIO'),
      e(View, { style: styles.header },
        e(Text, { style: styles.title }, data.title),
        e(Text, { style: styles.description }, data.description),
      ),
      e(Text, { style: styles.sectionLabel }, `Flashcards (${data.cards.length})`),
      e(View, { style: styles.cardRow }, ...flashcardElements),
      e(Text, { style: styles.footer, fixed: true },
        `Generated by RAGbox Sovereign Studio — ${new Date().toISOString().split('T')[0]}`,
      ),
    ),
  )

  // Page 2+: Quiz
  pages.push(
    e(Page, { key: 'p-quiz', size: 'A4', style: styles.page, wrap: true },
      e(Text, { style: styles.watermark }, 'RAGBOX SOVEREIGN STUDIO'),
      e(Text, { style: styles.sectionLabel }, `Quiz (${data.quiz.length} Questions)`),
      ...quizElements,
      e(Text, { style: styles.footer, fixed: true },
        `Generated by RAGbox Sovereign Studio — ${new Date().toISOString().split('T')[0]}`,
      ),
    ),
  )

  return e(Document, null, ...pages)
}

/**
 * Render compliance drill data to a PDF Buffer.
 */
export async function renderCompliance(data: ComplianceDrill): Promise<Buffer> {
  const doc = buildComplianceDocument(data)
  return Buffer.from(await renderToBuffer(doc))
}
