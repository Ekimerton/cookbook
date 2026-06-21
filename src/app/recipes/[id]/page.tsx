import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecipeBySlug } from '@/lib/recipeStorage';
import RecipeDetailClient from '@/app/components/RecipeDetailClient';

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RecipePageProps) {
  const { id } = await params;
  const recipeFile = getRecipeBySlug(id);
  if (!recipeFile) {
    return { title: 'Recipe Not Found' };
  }
  return {
    title: `${recipeFile.metadata.title} - NourishVault`,
    description: recipeFile.metadata.description || `View ingredients and steps for ${recipeFile.metadata.title}.`,
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;
  const recipeFile = getRecipeBySlug(id);

  if (!recipeFile) {
    notFound();
  }

  const { metadata } = recipeFile;

  return (
    <article style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Back navigation link */}
      <Link 
        href="/" 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          marginBottom: '2rem',
          fontSize: '0.95rem'
        }}
        className="nav-link"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"/>
        </svg>
        Back to recipes
      </Link>

      <header className="recipe-header">
        <h1 className="recipe-title">{metadata.title}</h1>
        
        <div className="recipe-meta-strip">
          <div className="recipe-meta-item">
            <span>Saved on <strong>{metadata.date}</strong></span>
          </div>
          {metadata.originalUrl && (
            <div className="recipe-meta-item">
              <a 
                href={metadata.originalUrl} 
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

        {metadata.description && (
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '2.5rem', borderLeft: '3px solid var(--accent)', paddingLeft: '1rem', lineHeight: '1.7' }}>
            {metadata.description}
          </p>
        )}
      </header>

      {/* Render the interactive recipe checklist details */}
      <RecipeDetailClient recipe={metadata} />
    </article>
  );
}
