'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { syncGitAction } from '@/app/actions';

interface SimpleRecipe {
  slug: string;
  title: string;
}

interface RecipeListClientProps {
  initialRecipes: SimpleRecipe[];
}

export default function RecipeListClient({ initialRecipes }: RecipeListClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Pull-to-refresh states
  const [pullDistance, setPullDistance] = useState(0);
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'ready' | 'refreshing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const startYRef = useRef(0);
  const isPullableRef = useRef(false);
  const pullStateRef = useRef(pullState);

  useEffect(() => {
    pullStateRef.current = pullState;
  }, [pullState]);

  const triggerPull = async () => {
    setPullState('refreshing');
    setPullDistance(60);

    try {
      const res = await syncGitAction('pull');
      if (res.success) {
        setPullState('success');
        router.refresh();
        setTimeout(() => {
          setPullState('idle');
          setPullDistance(0);
        }, 1000);
      } else {
        setPullState('error');
        setErrorMessage(res.error || 'Failed to pull from Git remote.');
        setTimeout(() => {
          setPullState('idle');
          setPullDistance(0);
        }, 3000);
      }
    } catch (err: any) {
      setPullState('error');
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setTimeout(() => {
        setPullState('idle');
        setPullDistance(0);
      }, 3000);
    }
  };

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger pull-to-refresh if window is scrolled to the absolute top
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY;
        isPullableRef.current = true;
      } else {
        isPullableRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullableRef.current) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;

      // If pulling down
      if (deltaY > 0 && window.scrollY === 0) {
        // Dampen pulling effect
        const dist = Math.min(100, deltaY * 0.4);
        setPullDistance(dist);

        if (dist >= 70) {
          setPullState('ready');
        } else {
          setPullState('pulling');
        }

        // Prevent mobile browser default refresh/pull-down bounce
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isPullableRef.current) return;
      isPullableRef.current = false;

      if (pullStateRef.current === 'ready') {
        triggerPull();
      } else {
        setPullState('idle');
        setPullDistance(0);
      }
    };

    // Use passive: false to allow e.preventDefault()
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const filteredRecipes = initialRecipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      {/* Pull-to-refresh floating pill */}
      {(pullDistance > 0 || pullState === 'refreshing' || pullState === 'success' || pullState === 'error') && (
        <div 
          style={{
            position: 'fixed',
            top: '4.5rem',
            left: '50%',
            transform: `translateX(-50%) translateY(${pullState === 'refreshing' || pullState === 'success' || pullState === 'error' ? 15 : pullDistance - 50}px)`,
            opacity: pullState === 'refreshing' || pullState === 'success' || pullState === 'error' ? 1 : Math.min(1, pullDistance / 70),
            transition: pullState === 'idle' ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease' : 'none',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.6rem 1.2rem',
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '30px',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-color)',
            fontSize: '0.85rem',
            fontWeight: '600',
            pointerEvents: 'none',
          }}
        >
          {pullState === 'pulling' && (
            <>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--text-secondary)" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  transform: `rotate(${Math.min(180, (pullDistance / 70) * 180)}deg)`,
                  transition: 'transform 0.1s ease'
                }}
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
              <span>Pull down to sync...</span>
            </>
          )}
          {pullState === 'ready' && (
            <>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--primary)" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  transform: 'rotate(180deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
              <span style={{ color: 'var(--primary)' }}>Release to sync...</span>
            </>
          )}
          {pullState === 'refreshing' && (
            <>
              <div 
                className="spinner" 
                style={{ 
                  width: '14px', 
                  height: '14px', 
                  borderWidth: '2px', 
                  borderTopColor: 'var(--primary)',
                  margin: 0
                }} 
              />
              <span>Syncing recipes...</span>
            </>
          )}
          {pullState === 'success' && (
            <>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#2e7d32" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span style={{ color: '#2e7d32' }}>Synced successfully!</span>
            </>
          )}
          {pullState === 'error' && (
            <>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--primary)" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span style={{ color: 'var(--primary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {errorMessage}
              </span>
            </>
          )}
        </div>
      )}

      {/* Search Input */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          className="form-input"
          style={{ width: '100%', margin: 0 }}
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
