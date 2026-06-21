'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <Link 
        href="/" 
        className={`nav-link ${pathname === '/' ? 'active' : ''}`}
      >
        My Recipes
      </Link>
      <Link 
        href="/recipes/new" 
        className={`nav-link ${pathname === '/recipes/new' ? 'active' : ''}`}
      >
        Add Recipe
      </Link>
    </nav>
  );
}
