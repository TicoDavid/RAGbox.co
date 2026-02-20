/**
 * Video Briefing Renderer — NarrationScript → self-contained HTML presentation
 *
 * Generates a slide-by-slide briefing that users open in any browser.
 * Includes narration text, visual cue placeholders, keyboard/click navigation,
 * and an optional auto-advance timer. No native dependencies required.
 */

import {
  DARK_BG,
  CARD_BG,
  TERTIARY_BG,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BRAND_BLUE,
  BRAND_BLUE_HOVER,
  BORDER_DEFAULT,
} from './colors'
import type { NarrationScript } from '../types'

export function renderVideo(script: NarrationScript): Buffer {
  const title = escapeHtml(script.title || 'Video Briefing')
  const intro = escapeHtml(script.introduction || '')
  const conclusion = escapeHtml(script.conclusion || '')
  const totalDuration = script.totalDuration || 0

  const slidesJson = JSON.stringify(
    script.sections.map((s, i) => ({
      index: i,
      title: s.sectionTitle,
      content: s.content,
      duration: s.durationEstimate,
      visual: s.visualCue || null,
    })),
  )

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — RAGbox Video Briefing</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${DARK_BG};
      color: ${TEXT_PRIMARY};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; text-align: center; }
    .watermark { font-size: 0.7rem; color: ${TEXT_SECONDARY}; margin-bottom: 0.5rem; }
    .meta { font-size: 0.75rem; color: ${TEXT_SECONDARY}; margin-bottom: 1.5rem; }

    .stage {
      width: 100%;
      max-width: 800px;
      background: ${CARD_BG};
      border: 1px solid ${BORDER_DEFAULT};
      border-radius: 12px;
      overflow: hidden;
    }

    /* Slide area */
    .slide {
      padding: 2rem 2.5rem;
      min-height: 320px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .slide-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${BRAND_BLUE};
      font-weight: 600;
    }
    .slide-title { font-size: 1.25rem; font-weight: 700; }
    .slide-content {
      font-size: 0.95rem;
      line-height: 1.65;
      color: ${TEXT_PRIMARY};
      white-space: pre-wrap;
    }
    .visual-cue {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: ${TERTIARY_BG};
      border-radius: 8px;
      font-size: 0.8rem;
      color: ${TEXT_SECONDARY};
      font-style: italic;
    }
    .visual-cue::before { content: '\\1F3AC'; font-style: normal; }
    .duration-badge {
      font-size: 0.7rem;
      color: ${TEXT_SECONDARY};
      align-self: flex-end;
    }

    /* Controls bar */
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      border-top: 1px solid ${BORDER_DEFAULT};
      background: ${TERTIARY_BG};
    }
    .controls button {
      background: ${BRAND_BLUE};
      color: #fff;
      border: none;
      padding: 0.5rem 1.25rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .controls button:hover { background: ${BRAND_BLUE_HOVER}; }
    .controls button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .progress {
      font-size: 0.8rem;
      color: ${TEXT_SECONDARY};
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .progress-bar {
      width: 120px;
      height: 4px;
      background: ${BORDER_DEFAULT};
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: ${BRAND_BLUE};
      transition: width 0.3s ease;
    }
    .auto-toggle {
      font-size: 0.75rem;
      color: ${TEXT_SECONDARY};
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .auto-toggle input { accent-color: ${BRAND_BLUE}; }

    .footer {
      margin-top: 2rem;
      font-size: 0.65rem;
      color: ${TEXT_SECONDARY};
    }

    /* Intro / Conclusion overlays */
    .bookend {
      padding: 2rem 2.5rem;
      min-height: 320px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      gap: 1rem;
    }
    .bookend h2 { font-size: 1.15rem; font-weight: 600; }
    .bookend p {
      font-size: 0.9rem;
      line-height: 1.6;
      color: ${TEXT_SECONDARY};
      max-width: 600px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="watermark">RAGBOX SOVEREIGN STUDIO</div>
  <div class="meta">${script.sections.length} sections &middot; ~${formatDuration(totalDuration)} estimated</div>

  <div class="stage">
    <div id="slide-area"></div>
    <div class="controls">
      <button id="prev-btn" onclick="prev()">&larr; Prev</button>
      <div class="progress">
        <span id="counter">1 / 1</span>
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <label class="auto-toggle">
          <input type="checkbox" id="auto-advance" /> Auto
        </label>
      </div>
      <button id="next-btn" onclick="next()">Next &rarr;</button>
    </div>
  </div>

  <div class="footer">Generated by RAGbox Sovereign Studio &mdash; ${new Date().toISOString().split('T')[0]}</div>

  <script>
    var slides = ${slidesJson};
    var intro = ${JSON.stringify(intro)};
    var conclusion = ${JSON.stringify(conclusion)};
    var totalSlides = slides.length + 2; // intro + sections + conclusion
    var current = 0;
    var timer = null;

    function esc(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function render() {
      var area = document.getElementById('slide-area');
      var html = '';

      if (current === 0) {
        html = '<div class="bookend">'
          + '<div class="slide-label">Introduction</div>'
          + '<h2>' + esc(${JSON.stringify(title)}) + '</h2>'
          + '<p>' + esc(intro) + '</p>'
          + '</div>';
      } else if (current === totalSlides - 1) {
        html = '<div class="bookend">'
          + '<div class="slide-label">Conclusion</div>'
          + '<h2>Summary</h2>'
          + '<p>' + esc(conclusion) + '</p>'
          + '</div>';
      } else {
        var s = slides[current - 1];
        html = '<div class="slide">'
          + '<div class="slide-label">Section ' + current + ' of ' + slides.length + '</div>'
          + '<div class="slide-title">' + esc(s.title) + '</div>'
          + '<div class="slide-content">' + esc(s.content) + '</div>';
        if (s.visual) {
          html += '<div class="visual-cue">' + esc(s.visual) + '</div>';
        }
        if (s.duration) {
          html += '<div class="duration-badge">~' + s.duration + 's</div>';
        }
        html += '</div>';
      }

      area.innerHTML = html;
      document.getElementById('counter').textContent = (current + 1) + ' / ' + totalSlides;
      document.getElementById('progress-fill').style.width = ((current + 1) / totalSlides * 100) + '%';
      document.getElementById('prev-btn').disabled = current === 0;
      document.getElementById('next-btn').disabled = current === totalSlides - 1;

      scheduleAuto();
    }

    function next() { if (current < totalSlides - 1) { current++; render(); } }
    function prev() { if (current > 0) { current--; render(); } }

    function scheduleAuto() {
      clearTimeout(timer);
      if (!document.getElementById('auto-advance').checked) return;
      var delay = 5000;
      if (current > 0 && current < totalSlides - 1) {
        delay = (slides[current - 1].duration || 5) * 1000;
      }
      timer = setTimeout(function() { next(); }, delay);
    }

    document.getElementById('auto-advance').addEventListener('change', scheduleAuto);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });

    render();
  </script>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}
