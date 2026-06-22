import { getAllRecipes } from '@/lib/recipeStorage';
import RecipeListClient from './components/RecipeListClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const allRecipes = getAllRecipes();
  
  // Map and sort alphabetically by recipe title
  const sortedRecipes = allRecipes
    .map((recipe) => ({
      slug: recipe.slug,
      title: recipe.title,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <main>
      <RecipeListClient initialRecipes={sortedRecipes} />
    </main>
  );
}
