#!/bin/bash
# Skill evaluation hook - analyzes prompts and suggests relevant skills

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    exit 0
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the Node.js skill evaluator
node "$SCRIPT_DIR/skill-eval.js" "$@"
