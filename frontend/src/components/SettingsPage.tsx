import React from 'react';
import { Settings, User, Database, ShieldCheck, Sun, Moon, Palette, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={24} color="var(--accent-teal)" />
          <h1 style={styles.title}>Profile &amp; System Settings</h1>
        </div>
        <p style={styles.subtitle}>
          Customize interface themes, inspect regulatory dataset indexes, and manage your account session.
        </p>
      </div>

      <div style={styles.grid}>
        {/* Appearance & Theme Selector Card */}
        <div className="card" style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <div style={styles.cardTitleRow}>
            <Palette size={20} color="var(--accent-teal)" />
            <h3 style={styles.cardTitle}>Appearance &amp; Visual Theme</h3>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
            Switch between clinical daylight contrast and high-tech obsidian dark mode with 4D holographic depth.
          </p>

          <div style={styles.themeGrid}>
            {/* Light Mode Card */}
            <div
              id="theme-select-light"
              style={{
                ...styles.themeOptionCard,
                ...(theme === 'light' ? styles.themeOptionActive : {}),
              }}
              onClick={() => setTheme('light')}
            >
              <div style={styles.themePreviewLight}>
                <div style={{ width: '40px', height: '10px', borderRadius: '4px', backgroundColor: '#168C78' }} />
                <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#E0E9E5', marginTop: '6px' }} />
                <div style={{ width: '70%', height: '8px', borderRadius: '4px', backgroundColor: '#E5F5EF', marginTop: '4px' }} />
              </div>
              <div style={styles.themeCardInfo}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sun size={17} color="#D97706" />
                    <span style={styles.themeTitle}>Light Theme</span>
                  </div>
                  {theme === 'light' && <Check size={18} color="var(--accent-teal)" />}
                </div>
                <span style={styles.themeSubtitle}>Clinical white surface, medical teal, warm paper</span>
              </div>
            </div>

            {/* Dark Mode Card */}
            <div
              id="theme-select-dark"
              style={{
                ...styles.themeOptionCard,
                ...(theme === 'dark' ? styles.themeOptionActive : {}),
              }}
              onClick={() => setTheme('dark')}
            >
              <div style={styles.themePreviewDark}>
                <div style={{ width: '40px', height: '10px', borderRadius: '4px', backgroundColor: '#00D492' }} />
                <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#1E2D3D', marginTop: '6px' }} />
                <div style={{ width: '70%', height: '8px', borderRadius: '4px', backgroundColor: '#0C2B24', marginTop: '4px' }} />
              </div>
              <div style={styles.themeCardInfo}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Moon size={17} color="#60A5FA" />
                    <span style={styles.themeTitle}>Dark Theme</span>
                  </div>
                  {theme === 'dark' && <Check size={18} color="var(--accent-teal)" />}
                </div>
                <span style={styles.themeSubtitle}>Obsidian slate, bioluminescent cyan, neon 4D depth</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="card" style={styles.card}>
          <div style={styles.cardTitleRow}>
            <User size={20} color="var(--accent-teal)" />
            <h3 style={styles.cardTitle}>User Account Details</h3>
          </div>

          <div style={styles.profileRow}>
            <div style={styles.profileAvatar}>
              {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div style={styles.profileName}>{user?.full_name || 'Registered User'}</div>
              <div style={styles.profileEmail}>{user?.email}</div>
              <span className="badge badge-neutral" style={{ marginTop: '6px' }}>Role: User</span>
            </div>
          </div>

          <div style={styles.metaBox}>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Account Identifier:</span>
              <span style={styles.metaVal}>USR-{user?.id || '001'}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Session Security:</span>
              <span style={styles.metaVal}>PBKDF2 SHA-256 / Signed JWT</span>
            </div>
          </div>

          <button
            id="settings-logout-btn"
            className="btn btn-outline btn-sm"
            style={{ marginTop: '16px', color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)' }}
            onClick={() => logout()}
          >
            Sign Out of Account
          </button>
        </div>

        {/* Database & Coverage Status */}
        <div className="card" style={styles.card}>
          <div style={styles.cardTitleRow}>
            <Database size={20} color="var(--accent-teal)" />
            <h3 style={styles.cardTitle}>Data Coverage &amp; Indexes</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Commercial Medicines Catalog:</span>
              <span style={styles.statVal}>253,968 products</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>CDSCO Prohibited FDC Records:</span>
              <span style={styles.statVal}>187 gazettes (Aug 2024 orders)</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Banned Drugs &amp; Single Formulations:</span>
              <span style={styles.statVal}>681 verified notifications</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Search Engine:</span>
              <span style={styles.statVal}>SQLite FTS5 Full-Text Search</span>
            </div>
          </div>

          <div style={styles.infoBanner}>
            <ShieldCheck size={18} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
              All regulatory datasets are stored locally in the high-performance application database. Core medicine verification requires zero paid APIs.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    maxWidth: '1050px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '26px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '24px',
  },
  card: {
    padding: '24px',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '18px',
  },
  themeOptionCard: {
    borderRadius: '14px',
    border: '2px solid var(--border-subtle)',
    padding: '16px',
    backgroundColor: 'var(--surface-alt)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  themeOptionActive: {
    borderColor: 'var(--accent-teal)',
    boxShadow: 'var(--shadow-3d)',
  },
  themePreviewLight: {
    height: '60px',
    borderRadius: '8px',
    backgroundColor: '#F8FAF9',
    border: '1px solid #E0E9E5',
    padding: '10px',
    marginBottom: '12px',
  },
  themePreviewDark: {
    height: '60px',
    borderRadius: '8px',
    backgroundColor: '#0B111A',
    border: '1px solid #1E2D3D',
    padding: '10px',
    marginBottom: '12px',
  },
  themeCardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  themeTitle: {
    fontSize: '14.5px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  themeSubtitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  profileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '18px',
  },
  profileAvatar: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-teal)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 700,
  },
  profileName: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  profileEmail: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
  },
  metaBox: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12.5px',
  },
  metaLabel: {
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  metaVal: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '8px',
  },
  statLabel: {
    color: 'var(--text-secondary)',
  },
  statVal: {
    fontWeight: 700,
    color: 'var(--accent-teal)',
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--accent-mint)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '12px 14px',
    marginTop: '16px',
  },
};
