import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecipeBySlug, getRecipeRevisions } from '@/lib/recipeStorage';
import RecipeDetailClient from '@/app/components/RecipeDetailClient';
import { pullFromRemote, getGitStatus } from '@/lib/git';

export const dynamic = 'force-dynamic';

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
    title: `${recipeFile.metadata.title} - Recipe App`,
    description: recipeFile.metadata.description || `View ingredients and steps for ${recipeFile.metadata.title}.`,
  };
}

export default async function RecipePage({ params, searchParams }: RecipePageProps) {
  const { id } = await params;
  const { rev } = await searchParams;

  // Run git pull on recipe open if configured
  try {
    const gitStatus = await getGitStatus();
    if (gitStatus.initialized && gitStatus.remoteUrl) {
      await pullFromRemote();
    }
  } catch (err) {
    console.error('Failed to pull from remote on recipe open:', err);
  }

  const recipeFile = getRecipeBySlug(id, rev);

  if (!recipeFile) {
    notFound();
  }

  const { metadata } = recipeFile;
  const revisions = getRecipeRevisions(id);

  return (
    <RecipeDetailClient 
      recipe={metadata} 
      slug={recipeFile.slug}
      rawContent={recipeFile.rawContent}
      revisions={revisions}
      currentRev={rev}
    />
  );
}
