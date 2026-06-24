#!/usr/bin/env bash
# Script to import an existing recipes git repository (clones it into data/recipes)

# Exit on error
set -e

# Change directory to the root of the project
cd "$(dirname "$0")/.."

# Check if URL argument is provided
REPO_URL="$1"

# If not provided, try to read from user-settings.json using node
if [ -z "$REPO_URL" ]; then
  if [ -f "user-settings.json" ]; then
    REPO_URL=$(node -e "
      try {
        const settings = require('./user-settings.json');
        console.log(settings.RECIPE_GIT_REPO || settings.recipeGitRepo || settings.recipe_git_repo || '');
      } catch(e) {
        console.log('');
      }
    ")
  fi
fi

# Trim whitespace
REPO_URL=$(echo "$REPO_URL" | xargs)

if [ -z "$REPO_URL" ]; then
  echo "Error: No Git Repository URL provided."
  echo "Usage: ./scripts/import-repo.sh <git-repository-url>"
  echo "Alternatively, configure 'RECIPE_GIT_REPO' in user-settings.json first."
  exit 1
fi

RECIPES_DIR="data/recipes"

# If recipes directory already exists, rename it as a backup
if [ -d "$RECIPES_DIR" ]; then
  BACKUP_DIR="data/recipes_backup_$(date +%s)"
  echo "Warning: $RECIPES_DIR already exists. Backing it up to $BACKUP_DIR..."
  mv "$RECIPES_DIR" "$BACKUP_DIR"
fi

# Ensure data directory exists
mkdir -p data

echo "Cloning recipe repository from $REPO_URL..."
git clone "$REPO_URL" "$RECIPES_DIR"

echo "Updating user-settings.json..."
node -e "
const fs = require('fs');
const path = './user-settings.json';
let settings = {};
if (fs.existsSync(path)) {
  try {
    settings = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch(e) {}
}
// Support existing capitalization or default to RECIPE_GIT_REPO
if (settings.recipeGitRepo !== undefined) {
  settings.recipeGitRepo = process.argv[1];
} else if (settings.recipe_git_repo !== undefined) {
  settings.recipe_git_repo = process.argv[1];
} else {
  settings.RECIPE_GIT_REPO = process.argv[1];
}
fs.writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8');
" "$REPO_URL"

echo "Success! Recipes imported successfully and saved to $RECIPES_DIR."
