'use server';

import { scrapeRecipe, ExtractedRecipe, parseRecipeContentWithGemini } from '@/lib/recipeParser';
import { saveRecipe, RecipeMetadata, updateRecipe } from '@/lib/recipeStorage';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

// Helper to load the local settings key on the server
function getGeminiApiKey(): string | undefined {
  let apiKey = process.env.GEMINI_API_KEY;
  try {
    const settingsPath = path.join(process.cwd(), 'user-settings.json');
    if (fs.existsSync(settingsPath)) {
      const fileContent = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(fileContent);
      const key = settings.GEMINI_API_KEY || settings.geminiApiKey || settings.gemini_api_key;
      if (key) {
        apiKey = key;
      }
    }
  } catch (e) {
    console.error('Failed to read user-settings.json:', e);
  }
  return apiKey;
}

export async function extractRecipeAction(url: string) {
  try {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Please enter a valid URL.' };
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    const recipe = await scrapeRecipe(targetUrl);
    return { success: true, data: recipe };
  } catch (error: any) {
    console.error('Error extracting recipe:', error);
    return { 
      success: false, 
      error: error.message || 'Unable to extract recipe from this URL. You can still enter details manually.' 
    };
  }
}

export async function extractRecipeFromContentAction(content: string, url: string) {
  try {
    if (!content || typeof content !== 'string') {
      return { success: false, error: 'Pasted content cannot be empty.' };
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return { 
        success: false, 
        error: 'Gemini API Key is not configured. Please add your GEMINI_API_KEY in user-settings.json to enable copy-paste extraction.' 
      };
    }

    const recipe = await parseRecipeContentWithGemini(content, url || 'Pasted Content', apiKey);
    return { success: true, data: recipe };
  } catch (error: any) {
    console.error('Error parsing pasted recipe:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to extract recipe details from the pasted content.' 
    };
  }
}

export async function saveRecipeAction(recipeData: Omit<RecipeMetadata, 'date' | 'version'>) {
  try {
    if (!recipeData.title) {
      return { success: false, error: 'Recipe title is required.' };
    }
    if (!recipeData.originalUrl) {
      return { success: false, error: 'Recipe original URL is required.' };
    }

    const slug = saveRecipe(recipeData);
    
    // Revalidate paths to refresh the home page listing
    revalidatePath('/');
    
    return { success: true, slug };
  } catch (error: any) {
    console.error('Error saving recipe:', error);
    return { success: false, error: error.message || 'Failed to save recipe.' };
  }
}

export async function updateRecipeAction(slug: string, rawContent: string) {
  try {
    if (!slug) {
      return { success: false, error: 'Slug is required.' };
    }
    if (!rawContent) {
      return { success: false, error: 'Content is required.' };
    }

    const result = updateRecipe(slug, rawContent);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Revalidate lists and this specific details route
    revalidatePath('/');
    revalidatePath(`/recipes/${slug}`);

    return { success: true };
  } catch (error: any) {
    console.error('Error updating recipe:', error);
    return { success: false, error: error.message || 'Failed to update recipe.' };
  }
}
