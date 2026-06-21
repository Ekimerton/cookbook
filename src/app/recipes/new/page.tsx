'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { extractRecipeAction, saveRecipeAction, extractRecipeFromContentAction } from '@/app/actions';
import { ExtractedRecipe } from '@/lib/recipeParser';

export default function NewRecipePage() {
  const router = useRouter();
  
  // Scraper states
  const [url, setUrl] = useState('');
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
      setIsExtracting(false);
    }
  };

  const handleExtractPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    setIsExtracting(true);
    setExtractError(null);

    try {
      const result = await extractRecipeFromContentAction(pasteContent, url);
      if (result.success && result.data) {
        const extracted = result.data;
        
        if (extracted.ingredients.length === 0 && extracted.instructions.length === 0) {
          throw new Error('We could not extract any ingredients or instructions from the pasted content.');
        }

        const saveResult = await saveRecipeAction(extracted);
        if (saveResult.success && saveResult.slug) {
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
      setIsExtracting(false);
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
    setIsSaving(false);

    if (result.success && result.slug) {
      router.push(`/recipes/${result.slug}`);
    } else {
      setSaveError(result.error || 'Failed to save recipe.');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="recipe-header text-center">
        <h1 className="recipe-title" style={{ fontSize: '3rem' }}>
          Add a New Recipe
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Enter a web link to scrape its details, or fill them in yourself.
        </p>
      </div>

      {viewState === 'url_input' ? (
        <div className="card">
          <form onSubmit={handleExtract}>
            <div className="form-group">
              <label htmlFor="recipe-url" className="form-label">
                Recipe Website URL
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
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                We will attempt to automatically pull the ingredients, steps, and details from the page.
              </p>
            </div>

            {extractError && (
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
                <strong>Scraping Alert:</strong> {extractError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                    Extracting Recipe...
                  </>
                ) : (
                  'Extract Recipe'
                )}
              </button>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={handleCreateManually}
                disabled={isExtracting}
              >
                Write Manually
              </button>
            </div>
          </form>

          {/* Copy-paste bypass section */}
          {(extractError || showPasteBox) && (
            <div style={{ margin: '2rem 0 0 0', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: 'var(--font-sans)', color: 'var(--primary)' }}>
                Bypass Scraper Block with Copy-Paste
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Recipe websites often block server requests (like 403 Forbidden). To bypass this, open the recipe page in your browser, select and copy everything (Ctrl+A / Cmd+A), paste it below, and Gemini will extract the details!
              </p>
              
              <form onSubmit={handleExtractPaste}>
                <div className="form-group">
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
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
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
        <div className="card">
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
