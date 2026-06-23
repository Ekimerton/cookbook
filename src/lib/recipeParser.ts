import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import { YoutubeTranscript } from 'youtube-transcript';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  originalUrl: string;
}

const TEMPLATE_RECIPE_JSON = {
  title: "Ahi Poke (Hawaiian Raw Tuna Salad)",
  description: "A Hawaiian dish typically made with raw fish marinated in sesame oil and soy sauce, tossed with sweet onion and sea salt, and seasoned with sesame seeds and other flavors. This version is a fresh tuna and seaweed salad, usually served on its own as a starter or on a bed of steamed rice as a main dish.",
  ingredients: [
    "1 lb fresh ahi tuna, cut into 3/4-inch cubes",
    "1/2 cup sweet Maui onion, thinly sliced",
    "1/4 cup green onions, sliced",
    "2 tbsp soy sauce",
    "1 tbsp toasted sesame oil",
    "1 tsp black sesame seeds"
  ],
  instructions: [
    "Place the cubed ahi tuna in a medium bowl.",
    "### Marinade Prep",
    "In a separate small bowl, whisk together the soy sauce and toasted sesame oil.",
    "Pour the marinade over the tuna cubes.",
    "Add the sliced Maui onions, green onions, and black sesame seeds to the bowl.",
    "### Toss and Serve",
    "Toss everything gently until the tuna is well coated.",
    "Cover and refrigerate for at least 15 minutes before serving."
  ]
};

// Generate search keywords from URL to guide grounding searches
function getSearchKeywordsFromUrl(urlStr: string): string {
  try {
    const parsedUrl = new URL(urlStr);
    const domain = parsedUrl.hostname.replace('www.', '').split('.')[0];
    const pathWords = parsedUrl.pathname
      .replace(/\.(html|htm|php)$/i, '')
      .split(/[-_/]/)
      .filter((w) => w.length > 0)
      .join(' ');
    const brand = domain.charAt(0).toUpperCase() + domain.slice(1);
    return `${brand} ${pathWords}`;
  } catch (e) {
    return urlStr;
  }
}

// Fetch page HTML using system curl binary to bypass TLS fingerprint blocks
function fetchHtmlViaCurl(urlStr: string): { html: string; statusCode: number } {
  const result = spawnSync('curl', [
    '-s',
    '-L',
    '--max-time', '10', // 10 seconds timeout
    '-w', '\n%{http_code}', // Print status code on a new line at the end
    '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    '-H', 'Accept-Language: en-US,en;q=0.9',
    urlStr
  ], {
    maxBuffer: 10 * 1024 * 1024 // 10 MB buffer
  });

  if (result.error) {
    throw result.error;
  }
  
  if (result.status !== 0) {
    throw new Error(`curl failed with exit code ${result.status}: ${result.stderr?.toString() || ''}`);
  }

  const output = result.stdout.toString().trim();
  const lastNewlineIndex = output.lastIndexOf('\n');
  if (lastNewlineIndex === -1) {
    return { html: output, statusCode: 200 };
  }

  const html = output.substring(0, lastNewlineIndex);
  const codeStr = output.substring(lastNewlineIndex + 1).trim();
  const statusCode = parseInt(codeStr, 10) || 200;

  return { html, statusCode };
}

// Fetch markdown representation of a page via Jina Reader proxy
async function fetchViaJina(urlStr: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(urlStr)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    const response = await fetch(jinaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
      next: { revalidate: 0 }
    });
    if (!response.ok) {
      throw new Error(`Jina Reader returned status: ${response.statusText} (${response.status})`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Clean HTML content to reduce context window tokens
function cleanHtmlForModel(content: string): string {
  if (/<[a-z][\s\S]*>/i.test(content)) {
    try {
      const $ = cheerio.load(content);
      $('script, style, iframe, nav, footer, header, svg, noscript, link, head, iframe').remove();
      $('*').each((_, el) => {
        if (el.type === 'tag') {
          const attribs = el.attribs;
          for (const attr of Object.keys(attribs)) {
            if (attr !== 'href' && attr !== 'src') {
              $(el).removeAttr(attr);
            }
          }
        }
      });
      return $('body').html() || $.html() || content;
    } catch (e) {
      console.warn('Failed to clean HTML content, passing raw:', e);
    }
  }
  return content.replace(/\s+/g, ' ').trim();
}

// Helper to retry Gemini API calls on transient errors (503, 429)
export async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isTransient = 
      error.status === 503 || 
      error.status === 429 || 
      (error.message && (
        error.message.includes('503') || 
        error.message.includes('429') || 
        error.message.includes('temporary') || 
        error.message.includes('overloaded') || 
        error.message.includes('unavailable')
      ));
      
    if (retries > 0 && isTransient) {
      console.warn(`Transient API error encountered (${error.status || 'unknown status'}). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Parse recipe content (HTML or plain text) using Google Gemini LLM with Structured Schema Output
export async function parseRecipeContentWithGemini(content: string, url: string, apiKey: string): Promise<ExtractedRecipe> {
  const cleanedContent = cleanHtmlForModel(content);
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        text: `You are an expert culinary scraper. Extract the recipe details from the provided webpage text or HTML. You MUST use the following reference template structure for the JSON output:
Reference Template:
${JSON.stringify(TEMPLATE_RECIPE_JSON, null, 2)}

Webpage URL Reference: ${url}
Recipe Page Content:
${cleanedContent}`
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title/name of the recipe' },
          description: { type: 'string', description: 'A short summary/description of the recipe' },
          ingredients: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of ingredients with quantities and names'
          },
          instructions: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of instruction steps. Use "### Section Name" for section headings if instructions are divided into parts.'
          }
        },
        required: ['title', 'ingredients', 'instructions']
      }
    }
  }));

  if (!response.text) {
    throw new Error('Gemini returned an empty response.');
  }

  const parsed = JSON.parse(response.text);
  
  return {
    title: parsed.title || 'Untitled Recipe',
    description: parsed.description || '',
    ingredients: parsed.ingredients || [],
    instructions: parsed.instructions || [],
    originalUrl: url
  };
}

// Scrape recipe using Google Search grounding when standard fetch is blocked
async function scrapeRecipeWithGeminiGrounding(url: string, apiKey: string): Promise<ExtractedRecipe> {
  const ai = new GoogleGenAI({ apiKey });
  const keywords = getSearchKeywordsFromUrl(url);
  
  const response = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        text: `You are an expert culinary scraper. Search for and retrieve the recipe content for the URL: ${url} using the Google Search tool.
You can query Google Search for the exact URL or use keywords like "${keywords}" to find the recipe page.

Extract the recipe details from the search results and output them EXACTLY as a JSON block wrapped in triple backticks matching the reference template structure below:
Reference Template:
\`\`\`json
${JSON.stringify(TEMPLATE_RECIPE_JSON, null, 2)}
\`\`\`

If the instructions are divided into parts, make sure to prefix the section headers with "### " (e.g. "### For the sauce") inside the instructions list.
Do not search for other pages; focus on extracting the details specifically from the provided URL. Do not include any other conversational text or introduction. Only output the JSON block. If you cannot find the recipe page or details, return an empty structure but ALWAYS output valid JSON inside the code block.`
      }
    ],
    config: {
      tools: [{ googleSearch: {} }] // Enabled search grounding, NO responseMimeType / responseSchema!
    }
  }));

  if (!response.text) {
    throw new Error('Gemini returned an empty response.');
  }

  const match = response.text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonText = match ? match[1] : response.text;
  
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText.trim());
  } catch (parseError) {
    console.error('Failed to parse Gemini output as JSON:', response.text);
    throw new Error(`Failed to parse structured recipe from model grounding output: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
  
  return {
    title: parsed.title || keywords || 'Untitled Recipe',
    description: parsed.description || '',
    ingredients: parsed.ingredients || [],
    instructions: parsed.instructions || [],
    originalUrl: url
  };
}

// Find a Recipe object inside the JSON-LD payload (for Cheerio fallback)
function findRecipeInJson(obj: any): any | null {
  if (!obj || typeof obj !== 'object') return null;

  if (obj['@type'] === 'Recipe' || (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))) {
    return obj;
  }

  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const found = findRecipeInJson(item);
      if (found) return found;
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipeInJson(item);
      if (found) return found;
    }
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const found = findRecipeInJson(obj[key]);
      if (found) return found;
    }
  }

  return null;
}

// Custom Cheerio static scraper (serves as fallback)
function parseHtmlLocally(html: string, cleanUrl: string): ExtractedRecipe {
  const $ = cheerio.load(html);
  let recipeData: any = null;

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const text = $(element).text().trim();
      if (!text) return;
      const parsed = JSON.parse(text);
      const found = findRecipeInJson(parsed);
      if (found) {
        recipeData = found;
        return false;
      }
    } catch (e) {
      // Ignore
    }
  });

  if (recipeData) {
    const title = recipeData.name || $('title').text().trim() || 'Untitled Recipe';
    const description = recipeData.description || $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    
    let ingredients: string[] = [];
    if (recipeData.recipeIngredient) {
      ingredients = Array.isArray(recipeData.recipeIngredient) 
        ? recipeData.recipeIngredient.map((i: any) => String(i).trim())
        : [String(recipeData.recipeIngredient).trim()];
    }

    const instructions = Array.isArray(recipeData.recipeInstructions)
      ? recipeData.recipeInstructions.map((step: any) => {
          if (typeof step === 'string') return step.trim();
          return (step.text || step.description || step.name || '').trim();
        }).filter((s: string) => s.length > 0)
      : [];

    return {
      title: title.replace(/<[^>]*>/g, '').trim(),
      description: description.replace(/<[^>]*>/g, '').trim(),
      ingredients,
      instructions,
      originalUrl: cleanUrl
    };
  }

  // Fallback selector-based scraping
  const title = $('h1').first().text().trim() || $('title').text().trim() || 'Untitled Recipe';
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

  const ingredients: string[] = [];
  $('[class*="ingredient" i], [id*="ingredient" i]').find('li').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt && txt.length > 2 && !ingredients.includes(txt)) {
      ingredients.push(txt);
    }
  });

  const instructions: string[] = [];
  $('[class*="instruction" i], [class*="direction" i], [class*="step" i]').find('li, p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt && txt.length > 5 && !instructions.includes(txt)) {
      instructions.push(txt);
    }
  });

  return {
    title: title.replace(/<[^>]*>/g, '').trim(),
    description: description.replace(/<[^>]*>/g, '').trim(),
    ingredients,
    instructions,
    originalUrl: cleanUrl
  };
}

// Helper to read the API key from settings
function getGeminiApiKeyLocal(): string | undefined {
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

export function getYoutubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toLowerCase();
  
  // If it's just digits with an optional 's' at the end (e.g. 90 or 90s)
  if (/^\d+s?$/.test(cleaned)) {
    return parseInt(cleaned.replace('s', ''), 10);
  }
  
  // HH:MM:SS or MM:SS format
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      return minutes * 60 + seconds;
    }
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }
  
  return null;
}

export interface TranscriptSegment {
  text: string;
  start: number; // in seconds
  duration: number; // in seconds
}

export async function getYoutubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map(t => ({
      text: t.text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim(),
      start: t.offset / 1000,
      duration: t.duration / 1000
    }));
  } catch (err: any) {
    console.error('Error fetching transcript via youtube-transcript:', err);
    throw new Error(err.message || 'Transcripts are disabled or not available for this YouTube video.');
  }
}

export async function parseYoutubeTranscriptWithGemini(
  transcriptText: string,
  url: string,
  apiKey: string
): Promise<ExtractedRecipe> {
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        text: `You are an expert culinary scraper and editor. Extract the recipe details from the provided YouTube video transcript. 
The transcript contains timestamp markers in the format [MM:SS] and represents spoken dialogue, which can be conversational, informal, and contains digressions or multiple dishes.

CRITICAL INSTRUCTIONS:
1. Zero in on ONE main recipe discussed in this transcript.
2. Extract the ingredients (with quantities and names) and step-by-step instructions.
3. Clean up the language to be professional, clear, and structured recipe text.
4. If the instructions are divided into parts/sections, prefix the section headers with "### " (e.g. "### For the sauce") inside the instructions list.
5. You MUST use the following reference template structure for the JSON output:

Reference Template:
${JSON.stringify(TEMPLATE_RECIPE_JSON, null, 2)}

YouTube URL Reference: ${url}
YouTube Video Transcript:
${transcriptText}`
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title/name of the recipe' },
          description: { type: 'string', description: 'A short summary/description of the recipe' },
          ingredients: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of ingredients with quantities and names'
          },
          instructions: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of instruction steps. Use "### Section Name" for section headings if instructions are divided into parts.'
          }
        },
        required: ['title', 'ingredients', 'instructions']
      }
    }
  }));

  if (!response.text) {
    throw new Error('Gemini returned an empty response.');
  }

  const parsed = JSON.parse(response.text);
  
  return {
    title: parsed.title || 'Untitled YouTube Recipe',
    description: parsed.description || '',
    ingredients: parsed.ingredients || [],
    instructions: parsed.instructions || [],
    originalUrl: url
  };
}

// Scrape and parse the webpage using a multi-layered fallback pipeline
export async function scrapeRecipe(url: string): Promise<ExtractedRecipe> {
  let cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const apiKey = getGeminiApiKeyLocal();

  // Layer 1: Attempt native curl fetch (bypasses TLS blocks)
  let html = '';
  let fetchFailed = false;
  let fetchErrorMsg = '';

  try {
    console.log(`Fetching ${cleanUrl} via system curl...`);
    const curlResult = fetchHtmlViaCurl(cleanUrl);
    if (curlResult.statusCode >= 200 && curlResult.statusCode < 400) {
      html = curlResult.html;
    } else {
      fetchFailed = true;
      fetchErrorMsg = `Forbidden (${curlResult.statusCode})`;
    }
  } catch (e: any) {
    fetchFailed = true;
    fetchErrorMsg = e.message || 'System curl connection failed.';
  }

  // Case A: Fetch succeeded and we have a Gemini API key
  if (!fetchFailed && apiKey) {
    try {
      console.log('Attempting recipe extraction using Gemini 2.5 Flash from HTML...');
      return await parseRecipeContentWithGemini(html, cleanUrl, apiKey);
    } catch (geminiError) {
      console.error('Gemini HTML extraction failed, falling back to static parser:', geminiError);
    }
  }

  // Case B: Fetch failed or HTML extraction failed, and we have a Gemini API key
  if (apiKey) {
    // Pipeline Layer 2: Gemini Google Search Grounding
    try {
      console.log(`Attempting native Gemini search grounding bypass for ${cleanUrl}...`);
      return await scrapeRecipeWithGeminiGrounding(cleanUrl, apiKey);
    } catch (groundingError) {
      console.warn('Gemini search grounding bypass failed, trying Jina Reader proxy:', groundingError);
      
      // Pipeline Layer 3: Jina Reader API
      try {
        console.log(`Attempting Jina Reader fetch for ${cleanUrl}...`);
        const jinaMarkdown = await fetchViaJina(cleanUrl);
        console.log('Jina fetch succeeded. Parsing content with Gemini...');
        return await parseRecipeContentWithGemini(jinaMarkdown, cleanUrl, apiKey);
      } catch (jinaError) {
        console.error('Jina Reader bypass also failed:', jinaError);
        throw new Error(
          `Failed to scrape recipe: ${fetchErrorMsg || 'Extraction failed'}. ` +
          `(Bypass 1 [Search Grounding] failed: ${groundingError instanceof Error ? groundingError.message : String(groundingError)}; ` +
          `Bypass 2 [Jina Proxy] failed: ${jinaError instanceof Error ? jinaError.message : String(jinaError)})`
        );
      }
    }
  }

  // Case C: Fetch succeeded but no API key (use local parser)
  if (!fetchFailed) {
    console.log('Using standard selector-based extraction...');
    return parseHtmlLocally(html, cleanUrl);
  }

  // Case D: Fetch failed and no API key (throw fetch error)
  throw new Error(`Failed to fetch recipe page: ${fetchErrorMsg}. Add a GEMINI_API_KEY in user-settings.json to enable automated Google Search bypass.`);
}
