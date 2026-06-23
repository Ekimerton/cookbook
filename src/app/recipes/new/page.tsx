'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  extractRecipeAction, 
  extractRecipeFromContentAction, 
  extractRecipeFromYoutubeAction,
  saveNewRecipeMarkdownAction
} from '@/app/actions';
import { MarkdownEditorHandle } from '@/app/components/MarkdownEditor';
import { ExtractedRecipe } from '@/lib/recipeParser';

const MarkdownEditor = dynamic(
  () => import('@/app/components/MarkdownEditor'),
  { ssr: false }
);

const DEFAULT_MARKDOWN_TEMPLATE = `---
originalUrl: "Manual Entry"
version: 1
---

# New Recipe

Describe the recipe here.

## Ingredients

- 

## Instructions

1. 
`;

export default function NewRecipePage() {
  const router = useRouter();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  
  // View state: 'scrapers' | 'editor'
  const [viewState, setViewState] = useState<'scrapers' | 'editor'>('scrapers');

  // Manual editor state
  const [markdownContent, setMarkdownContent] = useState(DEFAULT_MARKDOWN_TEMPLATE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Scraper states
  const [url, setUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeStartTime, setYoutubeStartTime] = useState('');
  const [youtubeEndTime, setYoutubeEndTime] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  
  // Copy-paste states
  const [pasteContent, setPasteContent] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markdownContent.trim()) {
      setSaveError('Recipe content cannot be empty.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await saveNewRecipeMarkdownAction(markdownContent);
      if (result.success && result.slug) {
        router.push(`/recipes/${result.slug}`);
      } else {
        setIsSaving(false);
        setSaveError(result.error || 'Failed to save recipe.');
      }
    } catch (err: unknown) {
      setIsSaving(false);
      setSaveError((err as Error).message || 'An unexpected error occurred during save.');
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsExtracting(true);
    setExtractError(null);
    let keepSpinner = false;

    try {
      const result = await extractRecipeAction(url);
      if (result.success && result.data) {
        const extracted = result.data;
        if (extracted.ingredients.length === 0 && extracted.instructions.length === 0) {
          throw new Error('We could not extract any ingredients or instructions from this page. You can still add it manually.');
        }

        // Save immediately!
        const saveResult = await saveNewRecipeMarkdownAction(
          formatExtractedToMarkdown(extracted)
        );
        if (saveResult.success && saveResult.slug) {
          keepSpinner = true;
          router.push(`/recipes/${saveResult.slug}`);
          return;
        } else {
          setExtractError(saveResult.error || 'Failed to save the extracted recipe.');
        }
      } else {
        setExtractError(result.error || 'Failed to extract recipe.');
      }
    } catch (err: unknown) {
      setExtractError((err as Error).message || 'An unexpected error occurred during extraction.');
    } finally {
      if (!keepSpinner) {
        setIsExtracting(false);
      }
    }
  };

  const handleExtractPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    setIsExtracting(true);
    setExtractError(null);
    let keepSpinner = false;

    try {
      const result = await extractRecipeFromContentAction(pasteContent, url);
      if (result.success && result.data) {
        const extracted = result.data;
        if (extracted.ingredients.length === 0 && extracted.instructions.length === 0) {
          throw new Error('We could not extract any ingredients or instructions from the pasted content.');
        }

        const saveResult = await saveNewRecipeMarkdownAction(
          formatExtractedToMarkdown(extracted)
        );
        if (saveResult.success && saveResult.slug) {
          keepSpinner = true;
          router.push(`/recipes/${saveResult.slug}`);
          return;
        } else {
          setExtractError(saveResult.error || 'Failed to save the extracted recipe.');
        }
      } else {
        setExtractError(result.error || 'Failed to parse the pasted content.');
      }
    } catch (err: unknown) {
      setExtractError((err as Error).message || 'An unexpected error occurred during copy-paste extraction.');
    } finally {
      if (!keepSpinner) {
        setIsExtracting(false);
      }
    }
  };

  const handleExtractYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setIsExtracting(true);
    setExtractError(null);
    let keepSpinner = false;

    try {
      const result = await extractRecipeFromYoutubeAction(
        youtubeUrl,
        youtubeStartTime.trim() || undefined,
        youtubeEndTime.trim() || undefined
      );

      if (result.success && result.data) {
        const extracted = result.data;
        if (extracted.ingredients.length === 0 && extracted.instructions.length === 0) {
          throw new Error('We could not extract any ingredients or instructions from this YouTube video transcript. You can still add it manually.');
        }

        const saveResult = await saveNewRecipeMarkdownAction(
          formatExtractedToMarkdown(extracted)
        );
        if (saveResult.success && saveResult.slug) {
          keepSpinner = true;
          router.push(`/recipes/${saveResult.slug}`);
          return;
        } else {
          setExtractError(saveResult.error || 'Failed to save the extracted recipe.');
        }
      } else {
        setExtractError(result.error || 'Failed to extract recipe.');
      }
    } catch (err: unknown) {
      setExtractError((err as Error).message || 'An unexpected error occurred during YouTube extraction.');
    } finally {
      if (!keepSpinner) {
        setIsExtracting(false);
      }
    }
  };

  // Helper to serialize ExtractedRecipe object to markdown template format
  const formatExtractedToMarkdown = (ext: ExtractedRecipe) => {
    const frontmatter = `---
originalUrl: "${ext.originalUrl || 'Manual Entry'}"
version: 1
---`;

    let stepNum = 1;
    const stepsMarkdown = ext.instructions
      .map((step: string) => {
        if (step.startsWith('### ')) {
          stepNum = 1;
          return `\n${step}\n`;
        }
        return `${stepNum++}. ${step}`;
      })
      .join('\n');

    return `${frontmatter}

# ${ext.title || 'New Recipe'}

${ext.description ? `${ext.description}\n` : ''}
- **Source:** [Original Recipe](${ext.originalUrl || '#'})

## Ingredients

${ext.ingredients.map((ing: string) => ing.startsWith('### ') ? `\n${ing}\n` : `- ${ing}`).join('\n')}

## Instructions

${stepsMarkdown}
`.trim();
  };

  return (
    <div className="recipe-container" style={{ marginTop: '0.5rem' }}>
      {viewState === 'scrapers' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <h1 className="recipe-title-small" style={{ marginBottom: '0.5rem' }}>New Recipe</h1>

          {extractError && (
            <div 
              style={{ 
                backgroundColor: 'var(--primary-light)', 
                borderLeft: '4px solid var(--primary)', 
                padding: '1rem', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                color: 'var(--text-color)'
              }}
            >
              <strong>Scraping Alert:</strong> {extractError}
            </div>
          )}

          <form onSubmit={handleExtract} style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="recipe-url" className="form-label" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', fontFamily: 'var(--font-sans)', display: 'block', color: 'var(--secondary)' }}>
                New Recipe from URL
              </label>
              <input
                id="recipe-url"
                type="text"
                className="form-input"
                placeholder="https://www.allrecipes.com/recipe/... or Serious Eats, etc."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={isExtracting}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.75rem' }}
              disabled={isExtracting}
            >
              {isExtracting && !youtubeUrl && !pasteContent ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                  Extracting Recipe...
                </>
              ) : (
                'Extract Recipe'
              )}
            </button>
          </form>

          <form onSubmit={handleExtractYoutube} style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="youtube-url" className="form-label" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', fontFamily: 'var(--font-sans)', display: 'block', color: 'var(--secondary)' }}>
                New Recipe from YouTube
              </label>
              <input
                id="youtube-url"
                type="text"
                className="form-input"
                placeholder="https://www.youtube.com/watch?v=... or YouTube Shorts link"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                required
                disabled={isExtracting}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: 0 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="youtube-start-time" className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  Start Time (Optional)
                </label>
                <input
                  id="youtube-start-time"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1:30 or 90s"
                  value={youtubeStartTime}
                  onChange={(e) => setYoutubeStartTime(e.target.value)}
                  disabled={isExtracting}
                  style={{ padding: '0.6rem 0.8rem', fontSize: '0.95rem' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="youtube-end-time" className="form-label" style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  End Time (Optional)
                </label>
                <input
                  id="youtube-end-time"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 5:00 or 300s"
                  value={youtubeEndTime}
                  onChange={(e) => setYoutubeEndTime(e.target.value)}
                  disabled={isExtracting}
                  style={{ padding: '0.6rem 0.8rem', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.75rem' }}
              disabled={isExtracting}
            >
              {isExtracting && youtubeUrl ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                  Extracting YouTube...
                </>
              ) : (
                'Extract YouTube Recipe'
              )}
            </button>
          </form>

          {/* Copy-paste bypass section */}
          {(extractError || showPasteBox) ? (
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', fontFamily: 'var(--font-sans)', color: 'var(--primary)' }}>
                Bypass Scraper Block with Copy-Paste
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Recipe websites often block server requests (like 403 Forbidden). To bypass this, open the recipe page in your browser, select and copy everything (Ctrl+A / Cmd+A), paste it below, and Gemini will extract the details!
              </p>
              
              <form onSubmit={handleExtractPaste}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="Paste webpage text content or raw HTML here..."
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    disabled={isExtracting}
                    required
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                </div>
                
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  disabled={isExtracting || !pasteContent.trim()}
                >
                  {isExtracting && pasteContent ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                      Extracting Paste...
                    </>
                  ) : (
                    'Extract & Save Pasted Content'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'underline' }}
                onClick={() => setShowPasteBox(true)}
              >
                Or parse via copy-pasted text/HTML
              </button>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1rem' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setViewState('editor')}
              disabled={isExtracting}
              style={{ width: '100%' }}
            >
              Write Manually
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="recipe-title-small" style={{ marginBottom: '0.25rem' }}>New Recipe</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Write your recipe manually using markdown.
          </p>

          {saveError && (
            <div 
              style={{ 
                backgroundColor: 'var(--primary-light)', 
                borderLeft: '4px solid var(--primary)', 
                padding: '1rem', 
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                color: 'var(--text-color)'
              }}
            >
              <strong>Validation Error:</strong> {saveError}
            </div>
          )}

          {/* Pre-built Syntax Highlighting Code Editor */}
          <div className="editor-wrapper-responsive">
            <MarkdownEditor
              ref={editorRef}
              value={markdownContent}
              onChange={(val) => setMarkdownContent(val)}
              disabled={isSaving}
            />
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button 
              onClick={handleSaveRecipe} 
              className="btn btn-primary" 
              disabled={isSaving}
              style={{ minWidth: '120px' }}
            >
              {isSaving ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                  Saving...
                </>
              ) : (
                'Save Recipe'
              )}
            </button>
            <button 
              type="button"
              onClick={() => setViewState('scrapers')} 
              className="btn btn-outline" 
              disabled={isSaving}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
