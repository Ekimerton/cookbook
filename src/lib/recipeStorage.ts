import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';

export interface RecipeMetadata {
  title: string;
  originalUrl: string;
  date: string;
  description?: string;
  version: number;
  ingredients: string[];
  instructions: string[];
}

export interface RecipeFile {
  slug: string;
  metadata: RecipeMetadata;
  content: string;
  rawContent: string;
}

export interface RecipeRevision {
  commitSha: string;
  date: string;
  commitMessage: string;
  versionString: string;
}

const RECIPES_DIR = path.join(process.cwd(), 'data', 'recipes');

// Helper to ensure directory exists
function ensureRecipesDir() {
  if (!fs.existsSync(RECIPES_DIR)) {
    fs.mkdirSync(RECIPES_DIR, { recursive: true });
  }
}

// Run git command in the recipes directory
function runGitCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: RECIPES_DIR });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => stdout += data);
    child.stderr.on('data', (data) => stderr += data);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `git exit code ${code}`));
      }
    });
  });
}

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

// Automatically stage, commit and push recipe on creation or update
async function gitCommitAndPushRecipe(filename: string, title: string, isUpdate: boolean = false) {
  try {
    // 1. git add <filename>
    await runGitCommand(['add', filename]);
    
    // 2. Determine commit message (summarize diff if update and Gemini key is available)
    let commitMsg = isUpdate ? `Update ${title}` : `Create ${title}`;
    
    if (isUpdate) {
      try {
        const diff = await runGitCommand(['diff', '--cached', filename]);
        const apiKey = getGeminiApiKey();
        if (diff && apiKey) {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                text: `You are an expert culinary developer. You will be given a git diff of updates made to a recipe file named "${title}".
Generate a concise, single-line git commit message (up to 72 characters) that summarizes the exact changes made to this recipe (e.g. what ingredients were changed, steps updated, or notes added).

CRITICAL INSTRUCTIONS:
1. Return ONLY the single line commit message. No quotes, no prefix, no explanations, no formatting, no markdown.
2. Focus directly on the changes being made, but keep it short and descriptive.
3. Do NOT include "Update recipe: ${title}" or "Update recipe" or the recipe name in the message.
4. Example: "Increase cooking time and add butter"
5. If no meaningful changes can be summarized, return "Update ${title}"

Git Diff:
${diff}`
              }
            ]
          });
          
          if (response.text && response.text.trim()) {
            commitMsg = response.text.trim().replace(/^["']|["']$/g, '');
          }
        }
      } catch (diffErr) {
        console.error('Git: Failed to generate AI commit message, using fallback:', diffErr);
      }
    }
    
    // 3. git commit -m <msg>
    await runGitCommand(['commit', '-m', commitMsg]);
    console.log(`Git: Committed recipe "${title}" (${filename}) with message: "${commitMsg}"`);
    
    // 4. Check if remote exists, then push
    const remote = await runGitCommand(['remote']);
    if (remote) {
      console.log('Git: Pushing to remote...');
      await runGitCommand(['push']);
      console.log('Git: Pushed successfully');
    } else {
      console.log('Git: No remote configured. Skipping push.');
    }
  } catch (err: any) {
    console.error('Git integration error (non-fatal):', err.message || err);
  }
}

// Generate slug from title
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Parse recipe ingredients and instructions directly from the Markdown body content
export function parseMarkdownRecipeBody(body: string): { ingredients: string[]; instructions: string[] } {
  const lines = body.split('\n');
  const ingredients: string[] = [];
  const instructions: string[] = [];
  
  let section: 'none' | 'ingredients' | 'instructions' = 'none';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Detect section headers
    if (trimmed.toLowerCase().includes('## ingredients')) {
      section = 'ingredients';
      continue;
    } else if (trimmed.toLowerCase().includes('## instructions') || trimmed.toLowerCase().includes('## steps')) {
      section = 'instructions';
      continue;
    } else if (trimmed.startsWith('## ')) {
      // If we hit any other H2 header, exit current section
      section = 'none';
      continue;
    }
    
    if (section === 'ingredients') {
      if (trimmed.startsWith('### ')) {
        ingredients.push(trimmed);
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+')) {
        const item = trimmed.replace(/^[-*+]\s*/, '').trim();
        if (item) ingredients.push(item);
      }
    } else if (section === 'instructions') {
      if (trimmed.startsWith('### ')) {
        instructions.push(trimmed); // Keep section sub-headers intact (e.g. ### For the sauce)
      } else if (/^\d+\.\s+/.test(trimmed)) {
        const item = trimmed.replace(/^\d+\.\s+/, '').trim();
        if (item) instructions.push(item);
      }
    }
  }
  
  return { ingredients, instructions };
}

// Save recipe to markdown file
export function saveRecipe(recipe: Omit<RecipeMetadata, 'date' | 'version'>): string {
  ensureRecipesDir();

  const slugBase = slugify(recipe.title) || 'recipe';
  let slug = slugBase;
  let filePath = path.join(RECIPES_DIR, `${slug}.md`);
  let counter = 1;

  // Resolve duplicate slug names
  while (fs.existsSync(filePath)) {
    slug = `${slugBase}-${counter}`;
    filePath = path.join(RECIPES_DIR, `${slug}.md`);
    counter++;
  }

  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Clean frontmatter with ONLY permitted keys
  const frontmatter = {
    title: recipe.title,
    originalUrl: recipe.originalUrl,
    date: dateStr,
    description: recipe.description || '',
    version: 1
  };

  // Build the markdown content body
  let stepNum = 1;
  const stepsMarkdown = recipe.instructions
    .map((step) => {
      if (step.startsWith('### ')) {
        stepNum = 1; // Reset numbering for new section
        return `\n${step}\n`;
      }
      return `${stepNum++}. ${step}`;
    })
    .join('\n');

  const bodyContent = `
# ${recipe.title}

${recipe.description ? `${recipe.description}\n` : ''}
- **Source:** [Original Recipe](${recipe.originalUrl})

## Ingredients

${recipe.ingredients.map((ing) => `- ${ing}`).join('\n')}

## Instructions

${stepsMarkdown}
`.trim();

  // Generate file content with clean frontmatter
  const fileContent = matter.stringify(bodyContent, frontmatter);
  fs.writeFileSync(filePath, fileContent, 'utf-8');

  // Trigger Git operations in the background
  gitCommitAndPushRecipe(`${slug}.md`, recipe.title);

  return slug;
}

// Get all recipes metadata (cards)
export function getAllRecipes(): (RecipeMetadata & { slug: string })[] {
  ensureRecipesDir();

  const files = fs.readdirSync(RECIPES_DIR);
  const recipes = files
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const slug = file.substring(0, file.length - 3);
      const filePath = path.join(RECIPES_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);
      const parsedBody = parseMarkdownRecipeBody(content);
      
      return {
        slug,
        title: data.title || '',
        originalUrl: data.originalUrl || '',
        date: data.date || '',
        description: data.description || '',
        version: data.version || 1,
        ingredients: parsedBody.ingredients,
        instructions: parsedBody.instructions,
      };
    });

  // Sort by date descending (newest first)
  return recipes.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

// Get specific recipe details by slug, optionally from a specific commit
export function getRecipeBySlug(slug: string, commitSha?: string): RecipeFile | null {
  ensureRecipesDir();

  const filePath = path.join(RECIPES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  let fileContent = '';
  if (commitSha) {
    try {
      const { spawnSync } = require('child_process');
      const showResult = spawnSync('git', ['show', `${commitSha}:${slug}.md`], {
        cwd: RECIPES_DIR,
      });
      if (showResult.status === 0) {
        fileContent = showResult.stdout?.toString() || '';
      } else {
        console.error(`Git show failed for commit ${commitSha}:`, showResult.stderr?.toString());
        return null;
      }
    } catch (err) {
      console.error(`Failed to show file at commit ${commitSha}:`, err);
      return null;
    }
  } else {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  }

  const { data, content } = matter(fileContent);
  const parsedBody = parseMarkdownRecipeBody(content);

  const metadata: RecipeMetadata = {
    title: data.title || '',
    originalUrl: data.originalUrl || '',
    date: data.date || '',
    description: data.description || '',
    version: data.version || 1,
    ingredients: parsedBody.ingredients,
    instructions: parsedBody.instructions,
  };

  return {
    slug,
    metadata,
    content,
    rawContent: fileContent,
  };
}

// Get git commit history and version numbering for a recipe
export function getRecipeRevisions(slug: string): RecipeRevision[] {
  ensureRecipesDir();
  const filename = `${slug}.md`;
  const filePath = path.join(RECIPES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('git', ['log', '--follow', '--format=%H|%aI|%s', '--', filename], {
      cwd: RECIPES_DIR,
    });

    if (result.status !== 0) {
      console.warn('Git log failed:', result.stderr?.toString() || 'unknown error');
      return [];
    }

    const output = result.stdout?.toString().trim();
    if (!output) {
      return [];
    }

    const lines = output.split('\n').filter((l: string) => l.trim().length > 0);
    const commits = lines.map((line: string) => {
      const [commitSha, date, ...messageParts] = line.split('|');
      return {
        commitSha,
        date: date ? new Date(date).toISOString().split('T')[0] : '',
        commitMessage: messageParts.join('|'),
      };
    });

    // Chronological order (oldest to newest) to assign version sub-numbers (e.g. 1.1, 1.2, 2.1)
    const chronoCommits = [...commits].reverse();
    const versionCounters: Record<number, number> = {};

    const revisions: RecipeRevision[] = chronoCommits.map((c) => {
      let version = 1;
      try {
        const showResult = spawnSync('git', ['show', `${c.commitSha}:${filename}`], {
          cwd: RECIPES_DIR,
        });
        if (showResult.status === 0) {
          const content = showResult.stdout?.toString() || '';
          const { data } = matter(content);
          if (data && typeof data.version === 'number') {
            version = data.version;
          }
        }
      } catch (err) {
        console.warn(`Failed to read version for commit ${c.commitSha}:`, err);
      }

      versionCounters[version] = (versionCounters[version] || 0) + 1;
      const versionString = `${version}.${versionCounters[version]}`;

      return {
        ...c,
        versionString,
      };
    });

    // Return newest first for display
    return revisions.reverse();
  } catch (e) {
    console.error('Failed to get recipe revisions:', e);
    return [];
  }
}

export function saveNewRecipeFromMarkdown(rawContent: string): { success: boolean; slug?: string; error?: string } {
  ensureRecipesDir();

  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(rawContent);
  } catch (err: unknown) {
    return { success: false, error: `Invalid YAML frontmatter: ${(err as Error).message}` };
  }

  const title = parsed.data.title;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { success: false, error: 'A recipe title is required in the frontmatter.' };
  }

  const slugBase = slugify(title) || 'recipe';
  let slug = slugBase;
  let filePath = path.join(RECIPES_DIR, `${slug}.md`);
  let counter = 1;

  // Resolve duplicate slug names
  while (fs.existsSync(filePath)) {
    slug = `${slugBase}-${counter}`;
    filePath = path.join(RECIPES_DIR, `${slug}.md`);
    counter++;
  }

  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const updatedData = {
    title: title.trim(),
    originalUrl: parsed.data.originalUrl || 'Manual Entry',
    date: parsed.data.date || dateStr,
    description: parsed.data.description || '',
    version: parsed.data.version || 1
  };
  
  const fileContent = matter.stringify(parsed.content, updatedData);
  fs.writeFileSync(filePath, fileContent, 'utf-8');

  // Trigger Git operations in the background
  gitCommitAndPushRecipe(`${slug}.md`, updatedData.title);

  return { success: true, slug };
}

export function updateRecipe(slug: string, rawContent: string): { success: boolean; error?: string } {
  ensureRecipesDir();
  const filePath = path.join(RECIPES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Recipe file does not exist.' };
  }

  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(rawContent);
  } catch (err: unknown) {
    return { success: false, error: `Invalid YAML frontmatter: ${(err as Error).message}` };
  }

  const title = parsed.data.title || slug;
  fs.writeFileSync(filePath, rawContent, 'utf-8');

  // Trigger git update in the background (isUpdate = true)
  gitCommitAndPushRecipe(`${slug}.md`, title, true);

  return { success: true };
}

