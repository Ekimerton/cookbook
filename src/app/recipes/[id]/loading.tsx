export default function RecipeLoading() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.35; }
          100% { opacity: 0.6; }
        }
      `}</style>
      
      {/* Title skeleton */}
      <div style={{ height: '2.5rem', width: '65%', backgroundColor: 'var(--border-color)', borderRadius: '6px', marginBottom: '1.5rem', marginTop: '1rem' }} />

      {/* Description skeleton */}
      <div style={{ height: '1rem', width: '90%', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '0.6rem' }} />
      <div style={{ height: '1rem', width: '80%', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '1.5rem' }} />

      {/* Source link skeleton */}
      <div style={{ height: '1rem', width: '150px', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '2.5rem' }} />

      {/* Ingredients skeleton */}
      <div style={{ height: '1.8rem', width: '150px', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2.5rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '1.2rem', height: '1.2rem', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            <div style={{ height: '1.6rem', width: `${40 + Math.sin(i) * 15}%`, backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Instructions skeleton */}
      <div style={{ height: '1.8rem', width: '150px', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ height: '1.2rem', width: '25%', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            <div style={{ height: '1.6rem', width: '95%', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            <div style={{ height: '1.6rem', width: '75%', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
