'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecipeMetadata, RecipeRevision } from '@/lib/recipeStorage';
import { updateRecipeAction, refineRecipeContentAction } from '@/app/actions';
import React from 'react';
import dynamic from 'next/dynamic';

import { MarkdownEditorHandle } from './MarkdownEditor';

// Dynamically import the MarkdownEditor component to prevent SSR "document is not defined" issues
const MarkdownEditor = dynamic(
  () => import('./MarkdownEditor'),
  { ssr: false }
);

interface RecipeDetailClientProps {
  recipe: RecipeMetadata;
  slug: string;
  rawContent: string;
  revisions: RecipeRevision[];
  currentRev?: string;
}

export default function RecipeDetailClient({ 
  recipe, 
  slug, 
  rawContent, 
  revisions, 
  currentRev 
}: RecipeDetailClientProps) {
  const router = useRouter();
  const textareaRef = useRef<MarkdownEditorHandle>(null);
  
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(rawContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // AI Copilot states
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [aiRefineError, setAiRefineError] = useState<string | null>(null);

  // Dropdown states
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSave = async () => {
    if (!editContent.trim()) {
      setSaveError('Recipe content cannot be empty.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await updateRecipeAction(slug, editContent);
      if (result.success) {
        setIsEditing(false);
        // Redirect to the recipe detail page to show the latest version (removing revision queries)
        window.location.href = `/recipes/${slug}`;
      } else {
        setSaveError(result.error || 'Failed to save changes.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiRefine = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsAiRefining(true);
    setAiRefineError(null);
    try {
      const result = await refineRecipeContentAction(editContent, aiPrompt);
      if (result.success && result.refinedContent) {
        const editor = textareaRef.current;
        if (editor) {
          editor.view?.focus();
          editor.applyTextChange(result.refinedContent);
        } else {
          setEditContent(result.refinedContent);
        }
        setAiPrompt('');
      } else {
        setAiRefineError(result.error || 'Failed to refine content.');
      }
    } catch (err: any) {
      setAiRefineError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsAiRefining(false);
    }
  };

  // Determine the display version string (e.g. "1.1")
  let currentVersionString = `${recipe.version}.0`; // Default fallback
  if (currentRev) {
    const matchingRev = revisions.find((r) => r.commitSha === currentRev);
    if (matchingRev) {
      currentVersionString = matchingRev.versionString;
    }
  } else if (revisions.length > 0) {
    currentVersionString = revisions[0].versionString; // Latest committed version
  }

  const isLatest = !currentRev || (revisions.length > 0 && currentRev === revisions[0].commitSha);

  if (isEditing) {
    return (
      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', color: 'var(--secondary)' }}>Edit Recipe Markdown</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You can edit both the YAML frontmatter and the recipe body.</span>
        </div>
        
        {saveError && (
          <div style={{ backgroundColor: 'var(--primary-light)', borderLeft: '4px solid var(--primary)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-color)' }}>
            <strong>Validation Error:</strong> {saveError}
          </div>
        )}

        {/* AI Copilot Panel */}
        <div 
          style={{ 
            marginBottom: '1.5rem', 
            padding: '1.25rem', 
            backgroundColor: 'var(--secondary-light)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)' 
          }}
        >
          <label htmlFor="ai-prompt" style={{ display: 'block', fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--secondary)' }}>
            AI Recipe Assistant (Copilot)
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              id="ai-prompt"
              type="text"
              className="form-input"
              style={{ flex: 1, minWidth: '200px', backgroundColor: '#fff' }}
              placeholder="Ask AI to edit... e.g., 'make green onions optional', 'get rid of the intro bit', 'add a note about freezing'"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAiRefine();
                }
              }}
              disabled={isAiRefining || isSaving}
            />
            <button
              onClick={handleAiRefine}
              className="btn btn-secondary"
              disabled={isAiRefining || isSaving || !aiPrompt.trim()}
              style={{ minWidth: '100px' }}
            >
              {isAiRefining ? (
                <>
                  <div className="spinner" style={{ width: '12px', height: '12px', borderTopColor: '#fff', marginRight: '0.4rem' }} />
                  Refining...
                </>
              ) : (
                'Refine'
              )}
            </button>
          </div>
          
          {aiRefineError && (
            <div style={{ color: 'var(--primary)', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
              Copilot Error: {aiRefineError}
            </div>
          )}
        </div>

        {/* Pre-built Syntax Highlighting Code Editor */}
        <div style={{ minHeight: '60vh', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <MarkdownEditor
            ref={textareaRef}
            value={editContent}
            onChange={(val) => setEditContent(val)}
            disabled={isSaving || isAiRefining}
          />
        </div>

        {/* Save/Cancel Controls */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleSave} className="btn btn-primary" disabled={isSaving || isAiRefining} style={{ minWidth: '120px' }}>
            {isSaving ? (
              <>
                <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          <button 
            type="button"
            onClick={() => { 
              setIsEditing(false); 
              setEditContent(rawContent); 
              setSaveError(null); 
              setAiRefineError(null);
            }} 
            className="btn btn-outline" 
            disabled={isSaving || isAiRefining}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="recipe-container">
      {/* Historical Revision Banner */}
      {/* Historical Revision Banner */}
      {!isLatest && currentRev && (
        <div 
          style={{
            backgroundColor: 'var(--primary-light)',
            borderLeft: '4px solid var(--primary)',
            color: 'var(--text-color)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.95rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <span>
            <strong>Viewing Historical Revision:</strong> You are viewing version <strong>{currentVersionString}</strong> (committed on {revisions.find(r => r.commitSha === currentRev)?.date || recipe.date}).
          </span>
          <button 
            onClick={() => router.push(`/recipes/${slug}`)} 
            className="btn btn-outline" 
            style={{
              padding: '4px 12px',
              fontSize: '0.85rem',
              background: '#fff'
            }}
          >
            Return to latest
          </button>
        </div>
      )}

      {/* Top Navigation Bar: Back button on the left, Version selector on the right */}
      <div className="recipe-top-bar">
        <Link href="/" className="recipe-back-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to recipes</span>
        </Link>
        
        <div className="recipe-meta-actions">
          {/* Edit Button: only show if on latest version */}
          {isLatest && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="recipe-edit-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
              </svg>
              Edit
            </button>
          )}

          {/* Version Dropdown */}
          <div className="recipe-version-wrapper">
            <button 
              onClick={() => setShowVersionDropdown(!showVersionDropdown)} 
              className="recipe-edit-button"
              style={{ fontWeight: 'bold' }}
            >
              v{currentVersionString}
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16" style={{ marginLeft: '4px' }}>
                <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
              </svg>
            </button>
            
            {showVersionDropdown && (
              <div className="version-dropdown">
                <div style={{ padding: '0.25rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Revision History
                </div>

                {revisions.map((revItem, index) => (
                  <button
                    key={revItem.commitSha}
                    onClick={() => {
                      setShowVersionDropdown(false);
                      if (index === 0) {
                        router.push(`/recipes/${slug}`);
                      } else {
                        router.push(`/recipes/${slug}?rev=${revItem.commitSha}`);
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      background: (currentRev === revItem.commitSha || (index === 0 && isLatest)) ? 'var(--secondary-light)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: (currentRev === revItem.commitSha || (index === 0 && isLatest)) ? 'var(--secondary)' : 'var(--text-color)',
                      fontWeight: (currentRev === revItem.commitSha || (index === 0 && isLatest)) ? 'bold' : 'normal',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>v{revItem.versionString}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{revItem.date}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {revItem.commitMessage}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipe Header */}
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 className="recipe-title-small">{recipe.title}</h1>
        {(recipe.description || recipe.originalUrl) && (
          <p className="recipe-description-simple">
            {recipe.description}
            {recipe.originalUrl && (
              <>
                {recipe.description ? ' ' : ''}
                <a 
                  href={recipe.originalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="recipe-original-link"
                >
                  Original Recipe
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 16 16" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/>
                    <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/>
                  </svg>
                </a>
              </>
            )}
          </p>
        )}
      </header>

      {/* Ingredients Section */}
      <section>
        <h2 className="recipe-section-heading">Ingredients</h2>
        <ul className="recipe-ingredients-list">
          {recipe.ingredients.map((ing, idx) => (
            <li key={idx}>{ing}</li>
          ))}
        </ul>
      </section>

      {/* Preparation Section */}
      <section>
        <h2 className="recipe-section-heading">Preparation</h2>
        <div>
          {(() => {
            let stepNumber = 0;
            return recipe.instructions.map((step, idx) => {
              if (step.startsWith('### ')) {
                stepNumber = 0;
                const headingText = step.replace('### ', '');
                return (
                  <h3 key={idx} className="recipe-step-section-heading">
                    {headingText}
                  </h3>
                );
              }

              stepNumber++;

              return (
                <div key={idx} className="recipe-step-group">
                  <h4 className="recipe-step-title">Step {stepNumber}</h4>
                  <p className="recipe-step-text">{step}</p>
                </div>
              );
            });
          })()}
        </div>
      </section>
    </article>
  );
}
