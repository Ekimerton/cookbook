import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="32" 
          height="32" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="var(--primary)" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.5 1z"></path>
        </svg>
        <h1 style={{ fontSize: '2.25rem', margin: 0 }}>Settings</h1>
      </div>

      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.25rem' }}>App Configuration</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Configure features and display preferences for your Recipe App.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Theme</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Toggle system, light, or dark themes.
              </p>
            </div>
            <span className="badge">System Default</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Storage Location</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Recipes are saved as Markdown in your workspace.
              </p>
            </div>
            <code style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>data/recipes/</code>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Version</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Current build version.
              </p>
            </div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>v1.1.0</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link href="/" className="btn btn-outline" style={{ display: 'inline-flex', padding: '0.5rem 1.25rem' }}>
          Back to Recipes
        </Link>
      </div>
    </div>
  );
}
