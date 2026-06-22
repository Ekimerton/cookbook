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
    <RecipeDetailClient 
      recipe={metadata} 
      slug={recipeFile.slug}
      rawContent={recipeFile.rawContent}
      revisions={revisions}
      currentRev={rev}
    />
  );
}
