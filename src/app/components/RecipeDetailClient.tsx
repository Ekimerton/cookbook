'use client';

import { useState } from 'react';
import { RecipeMetadata } from '@/lib/recipeStorage';

interface RecipeDetailClientProps {
  recipe: RecipeMetadata;
}

export default function RecipeDetailClient({ recipe }: RecipeDetailClientProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

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

  return (
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
  );
}
