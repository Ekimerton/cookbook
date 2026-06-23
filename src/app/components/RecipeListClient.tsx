'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SimpleRecipe {
  slug: string;
  title: string;
}

interface RecipeListClientProps {
  initialRecipes: SimpleRecipe[];
}

export default function RecipeListClient({ initialRecipes }: RecipeListClientProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecipes = initialRecipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.6rem 1rem',
            fontSize: '1rem',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            outline: 'none',
          }}
        />
      </div>

      {filteredRecipes.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredRecipes.map((recipe) => (
            <li key={recipe.slug}>
              <Link 
                href={`/recipes/${recipe.slug}`} 
                style={{ 
                  fontSize: '1.15rem', 
                  color: 'var(--text-color)', 
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
                className="recipe-list-link"
              >
                {recipe.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
          No recipes found
        </div>
      )}
    </div>
  );
}
