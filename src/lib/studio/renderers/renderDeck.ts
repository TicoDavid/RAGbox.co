/**
 * Deck Renderer — JSON → PPTX
 *
 * Converts DeckStructure JSON into a PowerPoint file using pptxgenjs.
 */

import PptxGenJS from 'pptxgenjs'
import type { DeckStructure, SlideContent } from '../types'

const BRAND_BLUE = '2463EB'
const DARK_BG = '0A192F'
const TEXT_LIGHT = 'E5E7EB'
const TEXT_MUTED = '94A3B8'

/**
 * Render a DeckStructure to a .pptx Buffer.
 */
export async function renderDeck(deck: DeckStructure): Promise<Buffer> {
  const pptx = new PptxGenJS()

  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches
  pptx.author = 'RAGbox Sovereign Studio'

  // Define master slide
  pptx.defineSlideMaster({
    title: 'RAGBOX_MASTER',
    background: { color: DARK_BG },
    objects: [
      {
        text: {
          text: 'RAGbox Sovereign Studio',
          options: {
            x: 0.5,
            y: 7.0,
            w: 5,
            h: 0.3,
            fontSize: 8,
            color: TEXT_MUTED,
            fontFace: 'Arial',
          },
        },
      },
    ],
  })

  // Title slide
  const titleSlide = pptx.addSlide({ masterName: 'RAGBOX_MASTER' })
  titleSlide.addText(deck.title, {
    x: 1,
    y: 2.2,
    w: 11,
    h: 1.5,
    fontSize: 36,
    fontFace: 'Arial',
    color: TEXT_LIGHT,
    bold: true,
  })
  if (deck.subtitle) {
    titleSlide.addText(deck.subtitle, {
      x: 1,
      y: 3.8,
      w: 11,
      h: 0.8,
      fontSize: 18,
      fontFace: 'Arial',
      color: TEXT_MUTED,
    })
  }

  // Content slides
  const allSlides = [...deck.slides, ...(deck.appendix || [])]
  for (const slideData of allSlides) {
    addContentSlide(pptx, slideData)
  }

  // Generate buffer
  const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}

function addContentSlide(pptx: PptxGenJS, data: SlideContent) {
  const slide = pptx.addSlide({ masterName: 'RAGBOX_MASTER' })

  // Slide title
  slide.addText(data.title, {
    x: 0.8,
    y: 0.4,
    w: 11.5,
    h: 0.8,
    fontSize: 24,
    fontFace: 'Arial',
    color: BRAND_BLUE,
    bold: true,
  })

  // Underline bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8,
    y: 1.2,
    w: 2,
    h: 0.04,
    fill: { color: BRAND_BLUE },
  })

  switch (data.layout) {
    case 'title':
      // Title-only — center the bullets as a subtitle
      if (data.bullets.length > 0) {
        slide.addText(data.bullets.join('\n'), {
          x: 1,
          y: 2.5,
          w: 11,
          h: 3,
          fontSize: 18,
          fontFace: 'Arial',
          color: TEXT_LIGHT,
          lineSpacingMultiple: 1.5,
        })
      }
      break

    case 'two-column': {
      const mid = Math.ceil(data.bullets.length / 2)
      const left = data.bullets.slice(0, mid)
      const right = data.bullets.slice(mid)

      addBullets(slide, left, 0.8, 1.6, 5.5)
      addBullets(slide, right, 6.8, 1.6, 5.5)
      break
    }

    case 'bullets':
    default:
      addBullets(slide, data.bullets, 0.8, 1.6, 11.5)
      break
  }

  // Speaker notes
  if (data.speakerNotes) {
    slide.addNotes(data.speakerNotes)
  }
}

function addBullets(
  slide: PptxGenJS.Slide,
  bullets: string[],
  x: number,
  y: number,
  w: number,
) {
  const textRows = bullets.map((b) => ({
    text: b,
    options: {
      fontSize: 16,
      fontFace: 'Arial' as const,
      color: TEXT_LIGHT,
      bullet: { code: '2022' as const }, // bullet char •
      paraSpaceAfter: 8,
    },
  }))

  slide.addText(textRows, { x, y, w, h: 5, valign: 'top' as const })
}
