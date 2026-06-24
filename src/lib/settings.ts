import fs from 'fs';
import path from 'path';

export interface UserSettings {
  GEMINI_API_KEY?: string;
  RECIPE_GIT_REPO?: string;
}

const SETTINGS_FILE = path.join(process.cwd(), 'user-settings.json');

export function getSettings(): UserSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      // Support case variants
      const GEMINI_API_KEY = parsed.GEMINI_API_KEY || parsed.geminiApiKey || parsed.gemini_api_key;
      const RECIPE_GIT_REPO = parsed.RECIPE_GIT_REPO || parsed.recipeGitRepo || parsed.recipe_git_repo;
      return {
        GEMINI_API_KEY,
        RECIPE_GIT_REPO,
      };
    }
  } catch (e) {
    console.error('Failed to read user-settings.json:', e);
  }
  return {};
}

export function saveSettings(settings: UserSettings): void {
  try {
    let current: any = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      try {
        current = JSON.parse(content);
      } catch (e) {
        console.error('Failed to parse existing user-settings.json, overwriting:', e);
      }
    }
    
    // Update fields, preferring existing naming conventions if found
    if (settings.GEMINI_API_KEY !== undefined) {
      if (current.geminiApiKey !== undefined) {
        current.geminiApiKey = settings.GEMINI_API_KEY;
      } else if (current.gemini_api_key !== undefined) {
        current.gemini_api_key = settings.GEMINI_API_KEY;
      } else {
        current.GEMINI_API_KEY = settings.GEMINI_API_KEY;
      }
    }
    
    if (settings.RECIPE_GIT_REPO !== undefined) {
      if (current.recipeGitRepo !== undefined) {
        current.recipeGitRepo = settings.RECIPE_GIT_REPO;
      } else if (current.recipe_git_repo !== undefined) {
        current.recipe_git_repo = settings.RECIPE_GIT_REPO;
      } else {
        current.RECIPE_GIT_REPO = settings.RECIPE_GIT_REPO;
      }
    }
    
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write user-settings.json:', e);
    throw new Error('Failed to save settings.');
  }
}

export function getGeminiApiKey(): string | undefined {
  return getSettings().GEMINI_API_KEY || process.env.GEMINI_API_KEY;
}

export function getRecipeGitRepo(): string | undefined {
  return getSettings().RECIPE_GIT_REPO;
}
