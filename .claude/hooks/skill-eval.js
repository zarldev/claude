#!/usr/bin/env node

/**
 * Skill Evaluation Hook
 *
 * Analyzes user prompts and suggests relevant skills based on:
 * - Keywords in the prompt
 * - File paths mentioned
 * - Directory context
 * - Intent patterns
 */

const fs = require('fs');
const path = require('path');

// Load skill rules
const rulesPath = path.join(__dirname, 'skill-rules.json');
let rules;

try {
  rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
} catch (error) {
  // Silently exit if rules can't be loaded
  process.exit(0);
}

// Read prompt from stdin or environment
const prompt = process.env.CLAUDE_USER_PROMPT || '';

if (!prompt) {
  process.exit(0);
}

// Configuration
const config = rules.config || {
  minConfidence: 3,
  maxSkills: 5,
  showMatchReasons: true,
};

const scoreWeights = rules.scoreWeights || {
  keyword: 2,
  keywordPattern: 3,
  pathPattern: 4,
  directoryMatch: 5,
  intentPattern: 4,
  contentPattern: 3,
};

/**
 * Extract file paths from prompt
 */
function extractFilePaths(text) {
  const patterns = [
    // Quoted paths
    /["']([^"']+\.[a-zA-Z]+)["']/g,
    // Paths with common extensions
    /\b([\w\-./]+\.(go|ts|tsx|js|jsx|proto|sql|md|yaml|json))\b/g,
    // Directory paths
    /\b((?:pkg|cmd|internal|service|handler|repository|frontend|src)\/[\w\-./]+)\b/g,
  ];

  const paths = new Set();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      paths.add(match[1]);
    }
  }

  return Array.from(paths);
}

/**
 * Match a skill against the prompt
 */
function matchSkill(skillName, skillConfig, prompt, filePaths) {
  const triggers = skillConfig.triggers || {};
  const matches = [];
  let score = 0;

  const lowerPrompt = prompt.toLowerCase();

  // Check keywords
  if (triggers.keywords) {
    for (const keyword of triggers.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        matches.push(`keyword "${keyword}"`);
        score += scoreWeights.keyword;
      }
    }
  }

  // Check keyword patterns (regex)
  if (triggers.keywordPatterns) {
    for (const pattern of triggers.keywordPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(prompt)) {
          matches.push(`pattern /${pattern}/`);
          score += scoreWeights.keywordPattern;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
  }

  // Check file path patterns
  if (triggers.pathPatterns && filePaths.length > 0) {
    for (const pathPattern of triggers.pathPatterns) {
      const regex = globToRegex(pathPattern);
      for (const filePath of filePaths) {
        if (regex.test(filePath)) {
          matches.push(`path "${filePath}"`);
          score += scoreWeights.pathPattern;
        }
      }
    }
  }

  // Check directory mappings
  if (rules.directoryMappings) {
    for (const filePath of filePaths) {
      for (const [dir, mappedSkill] of Object.entries(rules.directoryMappings)) {
        if (filePath.includes(dir) && mappedSkill === skillName) {
          matches.push(`directory "${dir}"`);
          score += scoreWeights.directoryMatch;
        }
      }
    }
  }

  // Check intent patterns
  if (triggers.intentPatterns) {
    for (const pattern of triggers.intentPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(prompt)) {
          matches.push(`intent /${pattern}/`);
          score += scoreWeights.intentPattern;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
  }

  // Check content patterns against mentioned files
  if (triggers.contentPatterns && filePaths.length > 0) {
    for (const filePath of filePaths) {
      try {
        const absPath = path.resolve(filePath);
        if (fs.existsSync(absPath)) {
          const content = fs.readFileSync(absPath, 'utf8');
          for (const pattern of triggers.contentPatterns) {
            try {
              const regex = new RegExp(pattern);
              if (regex.test(content)) {
                matches.push(`content /${pattern}/`);
                score += scoreWeights.contentPattern;
              }
            } catch (e) {
              // Invalid regex, skip
            }
          }
        }
      } catch (e) {
        // File not readable, skip
      }
    }
  }

  // Check for exclusion patterns
  if (skillConfig.excludePatterns) {
    for (const pattern of skillConfig.excludePatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(prompt)) {
          return { skillName, score: 0, matches: [], excluded: true };
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
  }

  // Apply priority multiplier
  const priority = skillConfig.priority || 5;
  score = score * (priority / 5);

  return { skillName, score, matches };
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(glob) {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape special chars
    .replace(/\*\*\//g, '(?:[^/]+/)*')      // **/ matches zero or more dirs
    .replace(/\*\*/g, '.*')                  // ** alone matches anything
    .replace(/\*/g, '[^/]*')                 // * matches within path segment
    .replace(/\?/g, '[^/]');                 // ? matches single char (not /)
  return new RegExp('^' + pattern + '$');    // anchor to full match
}

/**
 * Get confidence level from score
 */
function getConfidenceLevel(score) {
  if (score >= 8) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  if (score >= config.minConfidence) return 'LOW';
  return 'NONE';
}

// Main execution
const filePaths = extractFilePaths(prompt);
const skillMatches = [];

for (const [skillName, skillConfig] of Object.entries(rules.skills || {})) {
  const match = matchSkill(skillName, skillConfig, prompt, filePaths);
  if (match.score >= config.minConfidence && !match.excluded) {
    skillMatches.push(match);
  }
}

// Sort by score descending
skillMatches.sort((a, b) => b.score - a.score);

// Limit to max skills
const topMatches = skillMatches.slice(0, config.maxSkills);

if (topMatches.length === 0) {
  process.exit(0);
}

// Output skill suggestions
console.log('\nSKILL SUGGESTIONS');
console.log('=================\n');

if (filePaths.length > 0) {
  console.log(`Detected file paths: ${filePaths.join(', ')}\n`);
}

console.log('Matched skills (ranked by relevance):');
for (let i = 0; i < topMatches.length; i++) {
  const match = topMatches[i];
  const confidence = getConfidenceLevel(match.score);
  console.log(`${i + 1}. ${match.skillName} (${confidence} confidence - score: ${match.score.toFixed(1)})`);
  if (config.showMatchReasons && match.matches.length > 0) {
    console.log(`   Matched: ${match.matches.slice(0, 3).join(', ')}`);
  }
}

console.log('\nTo activate a skill, mention it or use: "Apply the <skill-name> skill"\n');
