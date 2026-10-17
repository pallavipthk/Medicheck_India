import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { Sidebar, NavTab } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ScanPage } from './components/ScanPage';
import { SearchPage } from './components/SearchPage';
import { ResultPage } from './components/ResultPage';
import { LocatorPage } from './components/LocatorPage';
import { AIAssistantPage } from './components/AIAssistantPage';
import { HistoryPage } from './components/HistoryPage';
import { SavedPage } from './components/SavedPage';
import { SettingsPage } from './components/SettingsPage';
import { HelpPage } from './components/HelpPage';
import { RegulatoryResult } from './types';
import { apiGetMedicineDetails } from './api/client';
import { Menu } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Root view: 'landing' | 'auth' | 'app'
  const [currentView, setCurrentView] = useState<'landing' | 'auth' | 'app'>('landing');

  // Authenticated tab within 'app'
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Detail result state
  const [selectedResult, setSelectedResult] = useState<RegulatoryResult | null>(null);

  // Search query carry-over
  const [searchQuery, setSearchQuery] = useState<string>('');

  // AI assistant context carry-over
  const [aiContext, setAiContext] = useState<{ medicineName: string; result: RegulatoryResult } | null>(null);

  // Mobile sidebar open state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Clicking Get Started opens login page directly
  const handleGetStarted = () => {
    setCurrentView('auth');
  };

  const handleAuthSuccess = () => {
    setCurrentView('app');
    setActiveTab('dashboard');
  };

  // When user logs out, redirect directly to landing page immediately
  React.useEffect(() => {
    if (!isAuthenticated && !isLoading && currentView === 'app') {
      setCurrentView('landing');
      setSelectedResult(null);
      setActiveTab('dashboard');
    }
  }, [isAuthenticated, isLoading, currentView]);

  const handleLogout = () => {
    setCurrentView('landing');
    setSelectedResult(null);
    setActiveTab('dashboard');
  };

  // Select a medicine by ID and load its detailed verification result
  const handleSelectMedicine = async (medicineId: string) => {
    try {
      const res = await apiGetMedicineDetails(medicineId);
      setSelectedResult(res);
      // We render ResultPage while keeping sidebar visible
    } catch (err) {
      alert('Could not retrieve medicine details. Please try another search.');
    }
  };

  // From Scanner: confirmed identification opens Detailed Result Page
  const handleScanConfirmed = (result: RegulatoryResult) => {
    setSelectedResult(result);
  };

  // From ResultPage: Ask AI About This Medicine
  const handleAskAIFromResult = (medicineName: string, result: RegulatoryResult) => {
    setAiContext({ medicineName, result });
    setSelectedResult(null);
    setActiveTab('ai');
  };

  if (isLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner} />
        <span style={{ fontSize: '15px', color: '#168C78', fontWeight: 600 }}>
          Initializing MediCheck India...
        </span>
      </div>
    );
  }

  // 1. Landing Page View (Strictly single Get Started button, no sidebar, no dashboard)
  if (currentView === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // 2. Authentication View (Card with Email, Password, Toggle, Login/Register)
  if (currentView === 'auth') {
    return (
      <AuthPage
        onBackToLanding={() => setCurrentView('landing')}
        onSuccess={handleAuthSuccess}
      />
    );
  }

  // 3. Authenticated App View with Persistent Left Sidebar
  return (
    <div style={styles.appContainer}>
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedResult(null); // Clear result view when navigating to other tabs
        }}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div style={styles.mainArea}>
        {/* Mobile Header Bar */}
        <div style={styles.mobileHeader}>
          <button
            style={styles.menuBtn}
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={22} color="var(--text-primary)" />
          </button>
          <span style={styles.mobileBrandTitle}>MediCheck India</span>
          <div style={{ width: 22 }} />
        </div>

        <main style={styles.contentWrap}>
          {/* Detailed Medicine Result View */}
          {selectedResult ? (
            <ResultPage
              result={selectedResult}
              onNavigate={(tab) => {
                setSelectedResult(null);
                setActiveTab(tab);
              }}
              onAskAI={handleAskAIFromResult}
              onScanAnother={() => {
                setSelectedResult(null);
                setActiveTab('scan');
              }}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  onNavigate={(tab) => setActiveTab(tab)}
                  onSelectMedicine={handleSelectMedicine}
                  onQuickSearch={(q) => {
                    setSearchQuery(q);
                    setActiveTab('search');
                  }}
                />
              )}

              {activeTab === 'scan' && (
                <ScanPage
                  onScanConfirmed={handleScanConfirmed}
                  onSearchManually={() => setActiveTab('search')}
                />
              )}

              {activeTab === 'search' && (
                <SearchPage
                  initialQuery={searchQuery}
                  onSelectMedicine={handleSelectMedicine}
                />
              )}

              {activeTab === 'locator' && <LocatorPage />}

              {activeTab === 'ai' && (
                <AIAssistantPage
                  initialMedicineName={aiContext?.medicineName}
                  initialResult={aiContext?.result}
                />
              )}

              {activeTab === 'history' && (
                <HistoryPage
                  onSelectMedicine={handleSelectMedicine}
                  onNavigateScan={() => setActiveTab('scan')}
                />
              )}

              {activeTab === 'saved' && (
                <SavedPage
                  onSelectMedicine={handleSelectMedicine}
                  onNavigateSearch={() => setActiveTab('search')}
                />
              )}

              {activeTab === 'settings' && <SettingsPage />}

              {activeTab === 'help' && <HelpPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  loadingScreen: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-page)',
    gap: '16px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid var(--accent-mint)',
    borderTopColor: 'var(--accent-teal)',
    animation: 'spin 0.8s linear infinite',
  },
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-page)',
    transition: 'background-color 0.25s ease',
  },
  mainArea: {
    flex: 1,
    marginLeft: '270px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  mobileHeader: {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    backgroundColor: 'var(--surface)',
    borderBottom: '1px solid var(--border-subtle)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  menuBtn: {
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  mobileBrandTitle: {
    fontSize: '17px',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  contentWrap: {
    flex: 1,
    paddingBottom: '40px',
  },
};
