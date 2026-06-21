'use server';

import { scrapeRecipe, ExtractedRecipe, parseRecipeContentWithGemini } from '@/lib/recipeParser';
import { saveRecipe, RecipeMetadata, updateRecipe } from '@/lib/recipeStorage';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

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

export async function refineRecipeContentAction(rawContent: string, prompt: string) {
  try {
    if (!rawContent) {
      return { success: false, error: 'Recipe content is required.' };
    }
    if (!prompt) {
      return { success: false, error: 'Prompt is required.' };
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return { 
        success: false, 
        error: 'Gemini API Key is not configured. Please add your GEMINI_API_KEY in user-settings.json to enable the AI Recipe Assistant.' 
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          text: `You are an expert culinary editor. You will be given the raw recipe markdown content (including YAML frontmatter at the top) and a prompt describing a refinement or edit.
Apply the requested changes to the recipe content and output the entire modified raw markdown file.

CRITICAL INSTRUCTIONS:
1. Output the entire markdown file, including the unchanged parts.
2. Maintain the YAML frontmatter format (title, originalUrl, date, description, version) exactly.
3. Do NOT wrap your output in triple backticks (e.g. \`\`\`markdown or \`\`\`yaml). Return the raw text directly.
4. Do NOT include any conversational filler, notes, or intros/outros. Return ONLY the raw modified markdown file.
5. If the request is invalid or cannot be fulfilled, return the original raw content exactly.

User Refinement Request: "${prompt}"

Current Raw Recipe Content:
${rawContent}`
        }
      ]
    });

    if (!response.text) {
      throw new Error('Gemini returned an empty response.');
    }

    // Clean up if the model wrapped it in markdown backticks anyway
    let cleanedText = response.text;
    const match = cleanedText.match(/^(?:```(?:markdown|yaml|md)?\n)?([\s\S]*?)(?:\n```)?$/i);
    if (match) {
      cleanedText = match[1];
    }

    return { success: true, refinedContent: cleanedText.trim() };
  } catch (error: any) {
    console.error('Error refining recipe with AI:', error);
    return { success: false, error: error.message || 'AI refinement failed.' };
  }
}
