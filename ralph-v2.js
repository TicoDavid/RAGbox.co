#!/usr/bin/env node
/**
 * 🎭 Ralph Wiggum Agent - Story Runner v2.0
 * 
 * "I'm helping!" - Ralph Wiggum
 * 
 * This script picks the next story from RAGbox_stories_v2.json
 * and generates a prompt for Claude Code or Claude.ai
 * 
 * Usage:
 *   node ralph-v2.js           # Generate prompt for next story
 *   node ralph-v2.js --dry-run # Preview without generating
 *   node ralph-v2.js --status  # Show project status
 *   node ralph-v2.js --epic E7 # Work on specific epic
 */

const fs = require('fs');
const path = require('path');

// Load stories
const storiesPath = path.join(__dirname, 'RAGbox_stories_v2.json');
const stories = JSON.parse(fs.readFileSync(storiesPath, 'utf8'));

// ANSI colors for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(color, text) {
  console.log(`${color}${text}${colors.reset}`);
}

function showStatus() {
  log(colors.cyan, '\n🎭 RAGböx.co® Build Status\n');
  log(colors.bright, '─'.repeat(60));
  
  const statusCounts = { done: 0, todo: 0, new: 0, in_progress: 0 };
  const epicCounts = {};
  
  stories.stories.forEach(story => {
    statusCounts[story.status] = (statusCounts[story.status] || 0) + 1;
    
    if (!epicCounts[story.epic]) {
      epicCounts[story.epic] = { total: 0, done: 0, points: 0 };
    }
    epicCounts[story.epic].total++;
    epicCounts[story.epic].points += story.story_points || 0;
    if (story.status === 'done') epicCounts[story.epic].done++;
  });
  
  // Overall progress
  const total = stories.stories.length;
  const done = statusCounts.done || 0;
  const progress = Math.round((done / total) * 100);
  
  log(colors.green, `✅ Completed: ${done}/${total} stories (${progress}%)`);
  log(colors.yellow, `📋 To Do: ${statusCounts.todo || 0}`);
  log(colors.blue, `🆕 New: ${statusCounts.new || 0}`);
  log(colors.magenta, `🔄 In Progress: ${statusCounts.in_progress || 0}`);
  
  log(colors.bright, '\n📊 Progress by Epic:');
  log(colors.bright, '─'.repeat(60));
  
  stories.epics.forEach(epic => {
    const count = epicCounts[epic.id] || { total: 0, done: 0, points: 0 };
    const pct = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    const statusIcon = epic.status === 'new' ? '🆕' : epic.status === 'in_progress' ? '🔄' : '✅';
    
    console.log(`  ${statusIcon} ${epic.id}: ${epic.name}`);
    console.log(`     ${bar} ${pct}% (${count.done}/${count.total}) | ${count.points} pts`);
  });
  
  log(colors.bright, '\n─'.repeat(60));
  log(colors.cyan, `Total Story Points: ${stories.summary.total_story_points}`);
}

function getNextStory(epicFilter = null) {
  // Priority order: critical > high > medium > low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  
  // Filter to actionable stories
  let actionable = stories.stories.filter(s => 
    s.status === 'todo' || s.status === 'new'
  );
  
  // Apply epic filter if specified
  if (epicFilter) {
    actionable = actionable.filter(s => s.epic === epicFilter);
  }
  
  // Sort by priority, then by story ID
  actionable.sort((a, b) => {
    const pA = priorityOrder[a.priority] ?? 99;
    const pB = priorityOrder[b.priority] ?? 99;
    if (pA !== pB) return pA - pB;
    return a.id.localeCompare(b.id);
  });
  
  return actionable[0] || null;
}

function generatePrompt(story) {
  const epic = stories.epics.find(e => e.id === story.epic);
  
  let prompt = `# 🎭 Ralph Wiggum Agent - Story Implementation

## Story: ${story.id} - ${story.title}
**Epic:** ${epic?.name || story.epic}
**Priority:** ${story.priority?.toUpperCase()}
**Points:** ${story.story_points}

## Description
${story.description || 'No description provided.'}

## Acceptance Criteria
${(story.acceptance_criteria || []).map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

## Files to Create
${(story.files_to_create || []).map(f => `- \`${f}\``).join('\n') || '- None specified'}

## Files to Modify
${(story.files_to_modify || []).map(f => `- \`${f}\``).join('\n') || '- None specified'}

## Tech Stack Reference
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS + Framer Motion
- **Backend:** Vertex AI (Gemini 1.5 Pro), AlloyDB + pgvector
- **Auth:** Firebase Authentication
- **Storage:** GCP Cloud Storage with CMEK
- **Audit:** BigQuery (WORM-compliant)

## Design System
- **Background:** #050505 (OLED Black)
- **Primary:** #0000FF (Electric Blue)
- **Accent:** #00F0FF (Electric Cyan)
- **Warning:** #FFAB00 (Amber)
- **Danger:** #FF3D00 (Neon Red)
- **Fonts:** Space Grotesk (headers), Inter (body), JetBrains Mono (code)

## Instructions
1. Implement each acceptance criterion
2. Create the specified files
3. Follow existing code patterns in the codebase
4. Test the implementation
5. Update story status to "done" in RAGbox_stories_v2.json

---

*"I'm helping!" - Ralph Wiggum*
`;

  return prompt;
}

// Main execution
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const showStatusFlag = args.includes('--status');
const epicIndex = args.indexOf('--epic');
const epicFilter = epicIndex !== -1 ? args[epicIndex + 1] : null;

console.log(`${colors.cyan}🎭 Ralph Wiggum Agent v2.0${colors.reset}`);
console.log(`${colors.cyan}   "I'm helping!"${colors.reset}\n`);

if (showStatusFlag) {
  showStatus();
  process.exit(0);
}

const nextStory = getNextStory(epicFilter);

if (!nextStory) {
  log(colors.green, '🎉 All stories complete! Great job!');
  process.exit(0);
}

log(colors.yellow, `📝 Next Story: ${nextStory.id} - ${nextStory.title}`);
log(colors.blue, `   Epic: ${nextStory.epic}`);
log(colors.magenta, `   Priority: ${nextStory.priority}`);
log(colors.cyan, `   Points: ${nextStory.story_points}`);

if (isDryRun) {
  log(colors.yellow, '\n🔍 DRY RUN - Prompt preview:\n');
  console.log(generatePrompt(nextStory).substring(0, 500) + '...');
} else {
  const prompt = generatePrompt(nextStory);
  const promptPath = path.join(__dirname, 'current_prompt.md');
  fs.writeFileSync(promptPath, prompt);
  
  log(colors.green, `\n✅ Prompt saved to: ${promptPath}`);
  log(colors.cyan, '\nCopy this prompt to Claude Code or Claude.ai to implement the story.\n');
  
  console.log('─'.repeat(60));
  console.log(prompt);
  console.log('─'.repeat(60));
}

// Show overall progress
const total = stories.stories.length;
const done = stories.stories.filter(s => s.status === 'done').length;
log(colors.bright, `\n📊 Progress: ${done}/${total} stories (${Math.round((done/total)*100)}%)`);
