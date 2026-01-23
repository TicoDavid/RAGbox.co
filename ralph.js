#!/usr/bin/env node

/**
 * ralph.js - The Ralph Wiggum Agent Runner
 * 
 * This script implements the "Ralph Wiggum" autonomous agent workflow:
 * 1. Load stories from stories.json
 * 2. Pick the next todo story (respecting priority and dependencies)
 * 3. Execute the story by generating code
 * 4. Commit the changes
 * 5. Update stories.json with status
 * 6. Log progress to progress.txt
 * 7. Loop until all stories are done
 * 
 * Usage: node ralph.js [--dry-run] [--story S001]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  storiesFile: './stories.json',
  progressFile: './progress.txt',
  agentsFile: './agents.md',
  maxIterations: 100,
  dryRun: process.argv.includes('--dry-run'),
  targetStory: process.argv.find(arg => arg.startsWith('--story='))?.split('=')[1]
};

// Load stories
function loadStories() {
  const content = fs.readFileSync(CONFIG.storiesFile, 'utf-8');
  return JSON.parse(content);
}

// Save stories
function saveStories(data) {
  fs.writeFileSync(CONFIG.storiesFile, JSON.stringify(data, null, 2));
}

// Load progress
function loadProgress() {
  return fs.readFileSync(CONFIG.progressFile, 'utf-8');
}

// Save progress
function saveProgress(content) {
  fs.writeFileSync(CONFIG.progressFile, content);
}

// Load agents memory
function loadAgentsMemory() {
  return fs.readFileSync(CONFIG.agentsFile, 'utf-8');
}

// Get next story to work on
function getNextStory(data) {
  if (CONFIG.targetStory) {
    return data.stories.find(s => s.id === CONFIG.targetStory && s.status === 'todo');
  }
  
  // Priority order: critical > high > medium > low
  const priorityOrder = ['critical', 'high', 'medium', 'low'];
  
  // Filter todo stories
  const todoStories = data.stories.filter(s => s.status === 'todo');
  
  if (todoStories.length === 0) return null;
  
  // Sort by priority
  todoStories.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.priority);
    const bIndex = priorityOrder.indexOf(b.priority);
    return aIndex - bIndex;
  });
  
  return todoStories[0];
}

// Generate the prompt for Claude
function generatePrompt(story, data, agentsMemory, progress) {
  return `
# Ralph Wiggum Agent - Story Implementation

## Context
You are implementing a feature for RAGbox.co, a secure RAG platform for compliance-sensitive SMBs.
Review the agents.md file for architectural decisions and coding standards.

## Tech Stack
${JSON.stringify(data.tech_stack, null, 2)}

## Current Progress
${progress}

## Long-Term Memory (agents.md)
${agentsMemory}

## Story to Implement
**ID:** ${story.id}
**Title:** ${story.title}
**Epic:** ${story.epic}
**Priority:** ${story.priority}
**Story Points:** ${story.story_points}

**Description:**
${story.description}

**Acceptance Criteria:**
${story.acceptance_criteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

**Files to Create/Modify:**
${story.files_to_create.map(f => `- ${f}`).join('\n')}

## Instructions
1. Implement ALL acceptance criteria
2. Create ALL specified files
3. Follow the coding standards in agents.md
4. Use TypeScript with strict types
5. Include necessary imports
6. Add comments for complex logic
7. Ensure code is production-ready

## Output Format
For each file, output:
\`\`\`filepath
// File: {filepath}
{file contents}
\`\`\`

After implementation, output:
\`\`\`status
PASS or FAIL
Reason: {explanation}
\`\`\`
`;
}

// Log iteration to progress.txt
function logIteration(iteration, story, status, message) {
  const progress = loadProgress();
  const timestamp = new Date().toISOString();
  
  const newEntry = `
### Iteration ${iteration} (${timestamp})
- Story: ${story.id} - ${story.title}
- Status: ${status}
- ${message}
`;
  
  const updatedProgress = progress.replace(
    '## Iteration Log',
    `## Iteration Log\n${newEntry}`
  );
  
  saveProgress(updatedProgress);
}

// Update story status
function updateStoryStatus(data, storyId, status) {
  const story = data.stories.find(s => s.id === storyId);
  if (story) {
    story.status = status;
    saveStories(data);
  }
}

// Main execution loop
async function main() {
  console.log('🎭 Ralph Wiggum Agent Starting...\n');
  
  let iteration = 1;
  
  while (iteration <= CONFIG.maxIterations) {
    console.log(`\n📍 Iteration ${iteration}`);
    console.log('─'.repeat(40));
    
    // Load current state
    const data = loadStories();
    const agentsMemory = loadAgentsMemory();
    const progress = loadProgress();
    
    // Get next story
    const story = getNextStory(data);
    
    if (!story) {
      console.log('\n✅ All stories completed! Ralph is done.');
      break;
    }
    
    console.log(`📝 Working on: ${story.id} - ${story.title}`);
    console.log(`   Priority: ${story.priority}`);
    console.log(`   Story Points: ${story.story_points}`);
    
    // Mark as in progress
    updateStoryStatus(data, story.id, 'in_progress');
    
    // Generate prompt
    const prompt = generatePrompt(story, data, agentsMemory, progress);
    
    if (CONFIG.dryRun) {
      console.log('\n🔍 DRY RUN - Prompt would be:');
      console.log(prompt.substring(0, 500) + '...');
      logIteration(iteration, story, 'DRY_RUN', 'Dry run mode - no changes made');
      updateStoryStatus(data, story.id, 'todo');
      break;
    }
    
    // Here you would call Claude Code or Claude API
    // For now, we'll output the prompt for manual execution
    console.log('\n📤 PROMPT FOR CLAUDE:');
    console.log('═'.repeat(60));
    console.log(prompt);
    console.log('═'.repeat(60));
    
    // In a real implementation:
    // const result = await callClaudeAPI(prompt);
    // processResult(result, story);
    
    // Log and wait for manual intervention
    console.log('\n⏳ Waiting for manual implementation...');
    console.log('   After implementing, update stories.json manually');
    console.log('   or re-run with: node ralph.js');
    
    logIteration(iteration, story, 'PROMPTED', 'Prompt generated - awaiting implementation');
    
    // For now, break after one iteration (manual mode)
    break;
    
    iteration++;
  }
  
  // Final summary
  const data = loadStories();
  const completed = data.stories.filter(s => s.status === 'done').length;
  const total = data.stories.length;
  
  console.log('\n📊 Summary');
  console.log('─'.repeat(40));
  console.log(`   Completed: ${completed}/${total} stories`);
  console.log(`   Progress: ${Math.round(completed/total * 100)}%`);
}

// Run
main().catch(console.error);
