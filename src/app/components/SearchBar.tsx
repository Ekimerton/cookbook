'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isPending, startTransition] = useTransition();

  const handleSearch = (value: string) => {
    setQuery(value);
    
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set('q', value);
      } else {
        params.delete('q');
      }
      
      router.push(`/?${params.toString()}`);
    });
  };

  return (
    <div className="form-group" style={{ maxWidth: '600px', margin: '0 auto 2rem auto', position: 'relative' }}>
      <input
        type="text"
        className="form-input"
        placeholder="Search recipes by title, ingredients, or source..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        style={{
          paddingLeft: '2.5rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
        </svg>
      </div>
      {isPending && (
        <div 
          style={{
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
        </div>
      )}
    </div>
  );
}
