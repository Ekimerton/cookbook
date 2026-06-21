'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeMetadata, RecipeRevision } from '@/lib/recipeStorage';
import { updateRecipeAction } from '@/app/actions';

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
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(rawContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await updateRecipeAction(slug, editContent);
      if (result.success) {
        setIsEditing(false);
        // Refresh page to load parsed changes
        window.location.reload();
      } else {
        setSaveError(result.error || 'Failed to save changes.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
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

        <textarea
          className="form-input"
          style={{ fontFamily: 'monospace', fontSize: '0.95rem', width: '100%', minHeight: '60vh', resize: 'vertical', padding: '1rem', lineHeight: '1.6' }}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          disabled={isSaving}
        />

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} className="btn btn-primary" disabled={isSaving} style={{ minWidth: '120px' }}>
            {isSaving ? (
              <>
                <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#fff', marginRight: '0.5rem' }} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          <button onClick={() => { setIsEditing(false); setEditContent(rawContent); setSaveError(null); }} className="btn btn-outline" disabled={isSaving}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Historical Revision Banner */}
      {currentRev && (
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

      {/* Metadata strip (date, version dropdown trigger, original url) */}
      <div className="recipe-meta-strip" style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
        <div className="recipe-meta-item">
          <span>Saved on <strong>{recipe.date}</strong></span>
        </div>

        {/* Clickable Version Dropdown Trigger */}
        <div className="recipe-meta-item" style={{ position: 'relative' }}>
          <span style={{ marginRight: '0.25rem' }}>Version:</span>
          <button 
            onClick={() => setShowVersionDropdown(!showVersionDropdown)} 
            className="version-trigger"
            style={{
              background: 'var(--secondary-light)',
              border: '1px solid var(--border-color)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              color: 'var(--secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {currentVersionString}
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16">
              <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
            </svg>
          </button>
          
          {showVersionDropdown && (
            <div 
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 50,
                backgroundColor: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                minWidth: '240px',
                marginTop: '6px',
                padding: '0.5rem 0',
              }}
            >
              <div style={{ padding: '0.25rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', marginBottom: '0.25rem', fontWeight: 600 }}>
                Revision History
              </div>
              
              <button
                onClick={() => {
                  setShowVersionDropdown(false);
                  router.push(`/recipes/${slug}`);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 1rem',
                  background: !currentRev ? 'var(--secondary-light)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: !currentRev ? 'var(--secondary)' : 'var(--text-color)',
                  fontWeight: !currentRev ? 'bold' : 'normal',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>Latest version</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{revisions[0]?.versionString || `${recipe.version}.x`}</span>
              </button>

              {revisions.map((revItem) => (
                <button
                  key={revItem.commitSha}
                  onClick={() => {
                    setShowVersionDropdown(false);
                    router.push(`/recipes/${slug}?rev=${revItem.commitSha}`);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    background: currentRev === revItem.commitSha ? 'var(--secondary-light)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: currentRev === revItem.commitSha ? 'var(--secondary)' : 'var(--text-color)',
                    fontWeight: currentRev === revItem.commitSha ? 'bold' : 'normal',
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

        {recipe.originalUrl && (
          <div className="recipe-meta-item">
            <a 
              href={recipe.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              Original Recipe
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/>
                <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/>
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Edit Mode Toggle Button (Only visible on the latest version) */}
      {!currentRev && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button onClick={() => setIsEditing(true)} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
              <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
            </svg>
            Edit Markdown
          </button>
        </div>
      )}

      <div className="recipe-grid">
        {/* Ingredients Column */}
        <aside className="ingredients-box">
          <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', color: 'var(--secondary)' }}>
            Ingredients
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recipe.ingredients.map((ing, idx) => (
              <label key={idx} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={!!checkedIngredients[idx]}
                  onChange={() => toggleIngredient(idx)}
                />
                <span className="checkbox-custom" />
                <span className="checkbox-text">{ing}</span>
              </label>
            ))}
          </div>
        </aside>

        {/* Instructions/Steps Column */}
        <section>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', color: 'var(--secondary)' }}>
            Instructions
          </h2>
          <div className="step-list">
            {(() => {
              let stepNumber = 0;
              return recipe.instructions.map((step, idx) => {
                if (step.startsWith('### ')) {
                  const headingText = step.replace('### ', '');
                  return (
                    <h3 key={idx} className="step-section-header">
                      {headingText}
                    </h3>
                  );
                }

                stepNumber++;

                return (
                  <div
                    key={idx}
                    className={`step-card ${completedSteps[idx] ? 'completed' : ''}`}
                    onClick={() => toggleStep(idx)}
                  >
                    <div className="step-number">
                      {stepNumber}
                    </div>
                    <div className="step-text">{step}</div>
                  </div>
                );
              });
            })()}
          </div>
        </section>
      </div>
    </div>
  );
}
