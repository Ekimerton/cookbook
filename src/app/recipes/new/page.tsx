'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { extractRecipeAction, saveRecipeAction, extractRecipeFromContentAction, extractRecipeFromYoutubeAction } from '@/app/actions';
import { ExtractedRecipe } from '@/lib/recipeParser';

export default function NewRecipePage() {
  const router = useRouter();
  
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

  // Form states
  const [recipe, setRecipe] = useState<ExtractedRecipe>({
    title: '',
    description: '',
    ingredients: [],
    instructions: [],
    originalUrl: '',
  });

  const [ingredientsText, setIngredientsText] = useState('');
  const [instructionsText, setInstructionsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // View state: 'url_input' | 'edit_form'
  const [viewState, setViewState] = useState<'url_input' | 'edit_form'>('url_input');

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
        
        // If the scraper returned no ingredients and no instructions, treat it as a failure
        if (extracted.ingredients.length === 0 && extracted.instructions.length === 0) {
          throw new Error('We could not extract any ingredients or instructions from this page. You can still add it manually.');
        }

        // Save immediately!
        const saveResult = await saveRecipeAction(extracted);
        if (saveResult.success && saveResult.slug) {
          keepSpinner = true;
          // Take them directly to the recipe page
          router.push(`/recipes/${saveResult.slug}`);
          return; // Skip setting isExtracting to false to keep spinner active during redirect transition
        } else {
          setExtractError(saveResult.error || 'Failed to save the extracted recipe.');
        }
      } else {
        setExtractError(result.error || 'Failed to extract recipe.');
      }
    } catch (err: any) {
      setExtractError(err.message || 'An unexpected error occurred during extraction.');
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

        const saveResult = await saveRecipeAction(extracted);
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
    } catch (err: any) {
      setExtractError(err.message || 'An unexpected error occurred during copy-paste extraction.');
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

        // Save immediately!
        const saveResult = await saveRecipeAction(extracted);
        if (saveResult.success && saveResult.slug) {
          keepSpinner = true;
          // Take them directly to the recipe page
          router.push(`/recipes/${saveResult.slug}`);
          return; // Skip setting isExtracting to false to keep spinner active during redirect transition
        } else {
          setExtractError(saveResult.error || 'Failed to save the extracted recipe.');
        }
      } else {
        setExtractError(result.error || 'Failed to extract recipe.');
      }
    } catch (err: any) {
      setExtractError(err.message || 'An unexpected error occurred during YouTube extraction.');
    } finally {
      if (!keepSpinner) {
        setIsExtracting(false);
      }
    }
  };

  // Skip scraping and create manually
  const handleCreateManually = () => {
    setRecipe({
      title: '',
      description: '',
      ingredients: [],
      instructions: [],
      originalUrl: '',
    });
    setIngredientsText('');
    setInstructionsText('');
    setViewState('edit_form');
  };

  // Handle manual field updates
  const handleFieldChange = (key: keyof ExtractedRecipe, value: string) => {
    setRecipe((prev) => ({ ...prev, [key]: value }));
  };

  // Submit the form to save
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipe.title.trim()) {
      setSaveError('A recipe title is required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    // Process ingredients from textarea
    const parsedIngredients = ingredientsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Process instructions from textarea
    const parsedInstructions = instructionsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const recipeData = {
      ...recipe,
      title: recipe.title.trim(),
      originalUrl: recipe.originalUrl.trim() || url.trim() || 'Manual Entry',
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
    };

    const result = await saveRecipeAction(recipeData);

    if (result.success && result.slug) {
      router.push(`/recipes/${result.slug}`);
      // Do not set isSaving to false, keeping the spinner active during redirect
    } else {
      setIsSaving(false);
      setSaveError(result.error || 'Failed to save recipe.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {viewState === 'url_input' ? (
        <div style={{ marginTop: '0.5rem' }}>
          <form onSubmit={handleExtract} style={{ marginBottom: '1.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="recipe-url" className="form-label" style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-sans)', display: 'block', color: 'var(--secondary)' }}>
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
              {isExtracting && !youtubeUrl ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                  Extracting Recipe...
                </>
              ) : (
                'Extract Recipe'
              )}
            </button>
          </form>

          <form onSubmit={handleExtractYoutube} style={{ marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="youtube-url" className="form-label" style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-sans)', display: 'block', color: 'var(--secondary)' }}>
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
                'Extract Recipe'
              )}
            </button>
          </form>

          {extractError && (
            <div 
              style={{ 
                backgroundColor: 'var(--primary-light)', 
                borderLeft: '4px solid var(--primary)', 
                padding: '1rem', 
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.25rem',
                fontSize: '0.9rem',
                color: 'var(--text-color)'
              }}
            >
              <strong>Scraping Alert:</strong> {extractError}
            </div>
          )}

          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={handleCreateManually}
              disabled={isExtracting}
              style={{ width: '100%' }}
            >
              Write Manually
            </button>
          </div>

          {/* Copy-paste bypass section */}
          {(extractError || showPasteBox) && (
            <div style={{ margin: '1.5rem 0 0 0', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
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
                  className="btn btn-secondary w-full"
                  disabled={isExtracting || !pasteContent.trim()}
                >
                  {isExtracting ? (
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
          )}

          {!extractError && !showPasteBox && (
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'underline' }}
                onClick={() => setShowPasteBox(true)}
              >
                Or parse via copy-pasted text/HTML
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', fontFamily: 'var(--font-sans)', color: 'var(--secondary)' }}>
            New Recipe Details
          </h2>
          <form onSubmit={handleSaveRecipe}>
            <div className="form-group">
              <label htmlFor="title" className="form-label">Recipe Title *</label>
              <input
                id="title"
                type="text"
                className="form-input"
                value={recipe.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea
                id="description"
                className="form-input"
                rows={3}
                value={recipe.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ingredients" className="form-label">Ingredients (one per line) *</label>
              <textarea
                id="ingredients"
                className="form-input"
                rows={8}
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder="1 cup flour&#10;2 large eggs&#10;1/2 tsp salt"
                required
                style={{ resize: 'vertical', fontFamily: 'monospace' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="instructions" className="form-label">Instructions (one step per line) *</label>
              <textarea
                id="instructions"
                className="form-input"
                rows={8}
                value={instructionsText}
                onChange={(e) => setInstructionsText(e.target.value)}
                placeholder="Preheat the oven to 350°F.&#10;Mix the ingredients in a large bowl.&#10;### For the frosting&#10;Beat the butter and sugar until smooth."
                required
                style={{ resize: 'vertical', fontFamily: 'monospace' }}
              />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Tip: Use lines starting with <code>### </code> to create section sub-headers (like <code>### For the sauce</code>).
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="originalUrl" className="form-label">Original Source URL</label>
              <input
                id="originalUrl"
                type="text"
                className="form-input"
                value={recipe.originalUrl || url}
                onChange={(e) => handleFieldChange('originalUrl', e.target.value)}
              />
            </div>

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
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                    Saving Recipe...
                  </>
                ) : (
                  'Save Recipe'
                )}
              </button>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setViewState('url_input')}
                disabled={isSaving}
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
