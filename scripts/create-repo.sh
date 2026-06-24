#!/usr/bin/env bash
# Script to initialize and configure a git repository for recipes

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
  echo "Error: No Git Remote URL provided."
  echo "Usage: ./scripts/create-repo.sh <git-repository-url>"
  echo "Alternatively, configure 'RECIPE_GIT_REPO' in user-settings.json first."
  exit 1
fi

RECIPES_DIR="data/recipes"

# Create recipes directory if it doesn't exist
if [ ! -d "$RECIPES_DIR" ]; then
  mkdir -p "$RECIPES_DIR"
fi

# Change directory to recipes
cd "$RECIPES_DIR"

echo "Initializing / configuring Git in $RECIPES_DIR..."

# Check if git is already initialized
if [ ! -d ".git" ]; then
  git init
fi
# Always ensure branch is main
git branch -M main

# Configure remote origin
if git remote | grep -q "origin"; then
  echo "Setting remote URL to: $REPO_URL"
  git remote set-url origin "$REPO_URL"
else
  echo "Adding remote origin: $REPO_URL"
  git remote add origin "$REPO_URL"
fi

# Add files and commit
echo "Staging files..."
git add .

# Only commit if there are changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "Committing recipes..."
  git commit -m "Initial recipe commit"
else
  echo "No new changes to commit."
fi

# Update user-settings.json with the repository URL
cd ../..
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

# Go back to recipes dir to push
cd "$RECIPES_DIR"
echo "Pushing recipes to remote repository..."
git push -u origin main || git push

echo "Success! Recipe Git repository is set up and pushed to $REPO_URL."
