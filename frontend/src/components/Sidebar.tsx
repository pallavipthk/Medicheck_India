import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Camera,
  Search,
  MapPin,
  Bot,
  History,
  Bookmark,
  Settings,
  HelpCircle,
  LogOut,
  ShieldCheck,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export type NavTab =
  | 'dashboard'
  | 'scan'
  | 'search'
  | 'locator'
  | 'ai'
  | 'history'
  | 'saved'
  | 'settings'
  | 'help';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  onLogout,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNav = (tab: NavTab) => {
    onSelectTab(tab);
    setProfileMenuOpen(false);
    onCloseMobile();
  };

  const doLogout = () => {
    setProfileMenuOpen(false);
    onCloseMobile();
    logout();
    if (onLogout) {
      onLogout();
    }
  };

  const mainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scan', label: 'Scan Medicine', icon: Camera },
    { id: 'search', label: 'Medicine Search', icon: Search },
    { id: 'locator', label: 'Medicine Locator', icon: MapPin },
    { id: 'ai', label: 'AI Medicine Assistant', icon: Bot },
  ];

  const myMedicinesNav = [
    { id: 'history', label: 'Scan History', icon: History },
    { id: 'saved', label: 'Saved Medicines', icon: Bookmark },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div style={styles.backdrop} onClick={onCloseMobile} />
      )}

      <aside
        style={{
          ...styles.sidebar,
          ...(mobileOpen ? styles.sidebarMobileOpen : {}),
        }}
      >
        {/* Brand Header */}
        <div style={styles.brandRow}>
          <div style={styles.brandBrand}>
            <div style={styles.logoBadge}>
              <ShieldCheck size={22} color="var(--accent-teal)" strokeWidth={2.4} />
            </div>
            <div>
              <span style={styles.brandName}>MediCheck</span>
              <span style={styles.brandCountry}>INDIA</span>
            </div>
          </div>
          {mobileOpen && (
            <button style={styles.closeBtn} onClick={onCloseMobile}>
              <X size={20} color="var(--text-secondary)" />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <div style={styles.navContent}>
          {/* Main Section */}
          <div style={styles.navGroup}>
            <span style={styles.groupLabel}>MAIN INTELLIGENCE</span>
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  style={{
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  }}
                  onClick={() => handleNav(item.id as NavTab)}
                >
                  <Icon
                    size={18}
                    color={isActive ? 'var(--accent-teal)' : 'var(--text-secondary)'}
                    strokeWidth={isActive ? 2.3 : 1.8}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* My Medicines Section */}
          <div style={styles.navGroup}>
            <span style={styles.groupLabel}>MY RECORDS</span>
            {myMedicinesNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  style={{
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  }}
                  onClick={() => handleNav(item.id as NavTab)}
                >
                  <Icon
                    size={18}
                    color={isActive ? 'var(--accent-teal)' : 'var(--text-secondary)'}
                    strokeWidth={isActive ? 2.3 : 1.8}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile Card at Left Bottom Corner with Theme Toggle, Settings, Help & About, and Logout */}
        <div style={styles.profileSection} ref={profileRef}>
          {/* Floating Profile Popover Menu */}
          {profileMenuOpen && (
            <div style={styles.profilePopover} className="animate-fade-in">
              <div style={styles.popoverHeader}>
                <div style={styles.popoverAvatar}>
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={styles.popoverName}>{user?.full_name || 'User'}</div>
                  <div style={styles.popoverEmail}>{user?.email}</div>
                </div>
              </div>

              <div style={styles.popoverDivider} />

              <button
                id="popover-nav-settings"
                style={{
                  ...styles.popoverItem,
                  ...(currentTab === 'settings' ? styles.popoverItemActive : {}),
                }}
                onClick={() => handleNav('settings')}
              >
                <Settings size={16} color={currentTab === 'settings' ? 'var(--accent-teal)' : 'var(--text-secondary)'} />
                <span>Profile &amp; Settings</span>
              </button>

              <button
                id="popover-nav-help"
                style={{
                  ...styles.popoverItem,
                  ...(currentTab === 'help' ? styles.popoverItemActive : {}),
                }}
                onClick={() => handleNav('help')}
              >
                <HelpCircle size={16} color={currentTab === 'help' ? 'var(--accent-teal)' : 'var(--text-secondary)'} />
                <span>Help &amp; About</span>
              </button>

              <div style={styles.popoverDivider} />

              <button
                id="popover-nav-logout"
                style={{ ...styles.popoverItem, color: 'var(--status-danger)' }}
                onClick={doLogout}
              >
                <LogOut size={16} color="var(--status-danger)" />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* Interactive Profile Widget in Bottom Left Corner */}
          <div
            id="sidebar-profile-card"
            style={styles.profileCard}
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            <div style={styles.avatarWrap}>
              <div style={styles.userAvatar}>
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <div style={styles.statusDot} />
            </div>

            <div style={styles.userInfo}>
              <div style={styles.userName}>{user?.full_name || 'User'}</div>
              <div style={styles.userEmail}>{user?.email}</div>
            </div>

            <div style={styles.profileActions}>
              {/* Quick Theme Toggle Button */}
              <button
                id="profile-theme-toggle-btn"
                style={styles.quickIconBtn}
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTheme();
                }}
              >
                {isDark ? (
                  <Sun size={15} color="#FBBF24" />
                ) : (
                  <Moon size={15} color="var(--text-secondary)" />
                )}
              </button>

              {/* Quick Settings Button */}
              <button
                id="profile-settings-btn"
                style={styles.quickIconBtn}
                title="Profile & Settings"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNav('settings');
                }}
              >
                <Settings size={15} color={currentTab === 'settings' ? 'var(--accent-teal)' : 'var(--text-secondary)'} />
              </button>

              {/* Quick Help & About Button */}
              <button
                id="profile-help-btn"
                style={styles.quickIconBtn}
                title="Help & About"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNav('help');
                }}
              >
                <HelpCircle size={15} color={currentTab === 'help' ? 'var(--accent-teal)' : 'var(--text-secondary)'} />
              </button>

              {/* Quick Logout Button */}
              <button
                id="profile-logout-btn"
                style={{ ...styles.quickIconBtn, color: 'var(--status-danger)' }}
                title="Logout"
                aria-label="Logout"
                onClick={(e) => {
                  e.stopPropagation();
                  doLogout();
                }}
              >
                <LogOut size={15} color="var(--status-danger)" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 90,
  },
  sidebar: {
    width: '270px',
    backgroundColor: 'var(--surface)',
    borderRight: '1px solid var(--border-subtle)',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    transition: 'transform 0.25s ease, background-color 0.25s ease, border-color 0.25s ease',
  },
  sidebarMobileOpen: {
    transform: 'translateX(0)',
  },
  brandRow: {
    padding: '20px 22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-subtle)',
  },
  brandBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    backgroundColor: 'var(--accent-mint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-sm)',
  },
  brandName: {
    display: 'block',
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  brandCountry: {
    display: 'block',
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--accent-teal)',
    letterSpacing: '0.12em',
  },
  closeBtn: {
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navContent: {
    flex: 1,
    padding: '16px 14px',
    overflowY: 'auto',
  },
  navGroup: {
    marginBottom: '20px',
  },
  groupLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    padding: '0 12px 8px 12px',
  },
  navItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    transition: 'all 0.15s ease',
    textAlign: 'left',
    marginBottom: '2px',
  },
  navItemActive: {
    backgroundColor: 'var(--accent-mint)',
    color: 'var(--accent-teal)',
    fontWeight: 700,
  },
  profileSection: {
    position: 'relative',
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-page)',
    padding: '12px 14px',
    transition: 'background-color 0.25s ease',
  },
  profileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '10px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow-card)',
  },
  avatarWrap: {
    position: 'relative',
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-teal)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '14px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  statusDot: {
    position: 'absolute',
    bottom: '-1px',
    right: '-1px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#10B981',
    border: '2px solid var(--surface)',
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden',
    minWidth: 0,
  },
  userName: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  userEmail: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  profileActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  quickIconBtn: {
    padding: '6px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
  },
  profilePopover: {
    position: 'absolute',
    bottom: '72px',
    left: '14px',
    right: '14px',
    backgroundColor: 'var(--surface)',
    borderRadius: '14px',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-3d)',
    padding: '12px',
    zIndex: 110,
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 8px 10px 8px',
  },
  popoverAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-teal)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '13px',
  },
  popoverName: {
    fontSize: '13.5px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  popoverEmail: {
    fontSize: '11.5px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  popoverDivider: {
    height: '1px',
    backgroundColor: 'var(--border-subtle)',
    margin: '6px 0',
  },
  popoverItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
  popoverItemActive: {
    backgroundColor: 'var(--accent-mint)',
    color: 'var(--accent-teal)',
  },
};
