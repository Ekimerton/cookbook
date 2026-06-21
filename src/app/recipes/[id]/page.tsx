import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecipeBySlug, getRecipeRevisions } from '@/lib/recipeStorage';
import RecipeDetailClient from '@/app/components/RecipeDetailClient';

interface RecipePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rev?: string }>;
}

export async function generateMetadata({ params, searchParams }: RecipePageProps) {
  const { id } = await params;
  const { rev } = await searchParams;
  const recipeFile = getRecipeBySlug(id, rev);
  if (!recipeFile) {
    return { title: 'Recipe Not Found' };
  }
  return {
    title: `${recipeFile.metadata.title} - NourishVault`,
    description: recipeFile.metadata.description || `View ingredients and steps for ${recipeFile.metadata.title}.`,
  };
}

export default async function RecipePage({ params, searchParams }: RecipePageProps) {
  const { id } = await params;
  const { rev } = await searchParams;
  const recipeFile = getRecipeBySlug(id, rev);

  if (!recipeFile) {
    notFound();
  }

  const { metadata } = recipeFile;
  const revisions = getRecipeRevisions(id);

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

        {metadata.description && (
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '2.5rem', borderLeft: '3px solid var(--accent)', paddingLeft: '1rem', lineHeight: '1.7' }}>
            {metadata.description}
          </p>
        )}
      </header>

      {/* Render the interactive recipe checklist details */}
      <RecipeDetailClient 
        recipe={metadata} 
        slug={recipeFile.slug}
        rawContent={recipeFile.rawContent}
        revisions={revisions}
        currentRev={rev}
      />
    </article>
  );
}
