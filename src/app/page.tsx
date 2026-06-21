import Link from 'next/link';
import { getAllRecipes } from '@/lib/recipeStorage';
import SearchBar from './components/SearchBar';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const query = (resolvedParams.q || '').toLowerCase().trim();
  
  const allRecipes = getAllRecipes();
  
  const filteredRecipes = allRecipes.filter((recipe) => {
    if (!query) return true;
    
    const titleMatch = recipe.title.toLowerCase().includes(query);
    const descMatch = recipe.description?.toLowerCase().includes(query);
    const urlMatch = recipe.originalUrl.toLowerCase().includes(query);
    const ingredientMatch = recipe.ingredients.some(ing => 
      ing.toLowerCase().includes(query)
    );
    
    return titleMatch || descMatch || urlMatch || ingredientMatch;
  });

  return (
    <div>
      <section className="text-center mb-8">
        <h1 className="recipe-title" style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>
          Your Culinary Vault
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          Explore, filter, and reference your hand-picked recipes. Gathered and formatted in clean markdown.
        </p>
      </section>

      {allRecipes.length > 0 ? (
        <>
          <Suspense fallback={<div className="text-center">Loading search...</div>}>
            <SearchBar />
          </Suspense>

          {filteredRecipes.length > 0 ? (
            <div className="grid-recipes">
              {filteredRecipes.map((recipe) => (
                <Link key={recipe.slug} href={`/recipes/${recipe.slug}`}>
                  <article className="card card-recipe">
                    <div className="recipe-card-content">
                      <h3 className="recipe-card-title">{recipe.title}</h3>
                      <p className="recipe-card-desc">
                        {recipe.description || 'No description available.'}
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <span className="badge">
                          {recipe.ingredients.length} ingredients
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">🔍</span>
              <h2>No recipes match your search</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Try adjusting your search terms or keywords.
              </p>
              <button 
                className="btn btn-outline"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Clear Search
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon">🍳</span>
          <h2>Your recipe box is empty</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px' }}>
            Get started by parsing a recipe from a URL. We will extract the ingredients and steps for you.
          </p>
          <Link href="/recipes/new" className="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.25rem' }}>
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Add Your First Recipe
          </Link>
        </div>
      )}
    </div>
  );
}
