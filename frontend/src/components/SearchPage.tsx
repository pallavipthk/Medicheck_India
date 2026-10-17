import React, { useState, useEffect } from 'react';
import { Search, Pill, Building2, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { apiSearchMedicines } from '../api/client';
import { MedicineBasic } from '../types';

interface SearchPageProps {
  initialQuery?: string;
  onSelectMedicine: (medicineId: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ initialQuery = '', onSelectMedicine }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MedicineBasic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (initialQuery.trim()) {
      handleSearch(initialQuery.trim());
    }
  }, [initialQuery]);

  const searchTimerRef = React.useRef<any>(null);

  const handleSearch = async (searchTerm: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    const term = searchTerm.trim();
    if (!term) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await apiSearchMedicines(term, 25);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (val.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        handleSearch(val.trim());
      }, 200);
    } else if (!val.trim()) {
      setResults([]);
      setHasSearched(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSearch(query.trim());
    }
  };

  const popularSearches = [
    'Augmentin',
    'Azithral',
    'Ascoril',
    'Nimesulide',
    'Paracetamol',
    'Amoxicillin',
    'Pan 40',
    'Dolo 650',
    'Zerodol SP',
    'Sibelium',
  ];

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <h1 style={styles.title}>Medicine Database Search</h1>
        <p style={styles.subtitle}>
          Search across 253,968 commercial pharmaceuticals by brand, active ingredient, or manufacturer.
        </p>
      </div>

      {/* Main Search Input Form */}
      <form onSubmit={handleSubmit} style={styles.searchBar}>
        <Search size={22} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
        <input
          id="search-main-input"
          type="text"
          placeholder="Type medicine name, ingredient, or brand (e.g. Augmentin 625, Dolo 650, Pan 40, Sibelium)..."
          value={query}
          onChange={handleInputChange}
          style={styles.inputField}
          autoFocus
        />
        {query && (
          <button
            type="button"
            style={styles.clearBtn}
            onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }}
          >
            Clear
          </button>
        )}
        <button
          id="search-submit-btn"
          type="submit"
          className="btn btn-primary btn-sm"
          style={{ borderRadius: '10px', padding: '8px 16px', marginLeft: '6px' }}
        >
          <span>Search</span>
        </button>
      </form>

      {/* Popular Chips (shown before searching) */}
      {!hasSearched && (
        <div style={styles.popularRow}>
          <span style={styles.popularLabel}>Popular Searches:</span>
          {popularSearches.map((term) => (
            <button
              key={term}
              type="button"
              style={styles.popularChip}
              onClick={() => { setQuery(term); handleSearch(term); }}
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {/* Results Section */}
      {isLoading ? (
        <div style={styles.loadingBox}>
          Searching Indian medicine catalog...
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div className="card" style={styles.noResultsCard}>
          <AlertCircle size={32} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
          <h3 style={{ fontSize: '17px', color: 'var(--text-primary)', marginBottom: '6px' }}>
            No matching medicine found
          </h3>
          <p style={{ fontSize: '13.5px', color: '#667580', maxWidth: '440px', lineHeight: 1.5 }}>
            We could not find an exact catalog match for "<b>{query}</b>". Check the spelling or enter ingredients directly in the Scanner tab.
          </p>
        </div>
      ) : results.length > 0 ? (
        <div style={styles.resultsContainer}>
          <div style={styles.resultsCount}>
            Found {results.length} matching formulation{results.length > 1 ? 's' : ''} in the catalog:
          </div>

          <div style={styles.resultsGrid}>
            {results.map((med) => (
              <div
                key={med.medicine_id}
                style={styles.resultCard}
                onClick={() => onSelectMedicine(med.medicine_id)}
                className="animate-fade-in"
              >
                <div style={styles.resultMain}>
                  <div style={styles.medNameRow}>
                    <h3 style={styles.medName}>{med.medicine_name}</h3>
                    <span style={styles.priceTag}>
                      {med.price_inr ? `₹${med.price_inr}` : 'Market Price'}
                    </span>
                  </div>

                  <div style={styles.infoRow}>
                    <Pill size={14} color="#168C78" />
                    <span><b>Generic:</b> {med.generic_name || 'Combination formulation'}</span>
                  </div>

                  <div style={styles.infoRow}>
                    <Building2 size={14} color="#667580" />
                    <span><b>Manufacturer:</b> {med.manufacturer || 'Licensed Indian Pharma'}</span>
                  </div>

                  <div style={styles.tagRow}>
                    <span style={styles.formTag}>{med.dosage_form || 'Tablet'}</span>
                    {med.strength && <span style={styles.formTag}>{med.strength}</span>}
                    <span style={styles.idTag}>{med.medicine_id}</span>
                  </div>
                </div>

                <div style={styles.resultArrow}>
                  <span>Verify Safety</span>
                  <ArrowRight size={15} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
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
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: 'var(--surface)',
    border: '2px solid var(--border-subtle)',
    borderRadius: '16px',
    padding: '12px 20px',
    boxShadow: 'var(--shadow-card)',
    marginBottom: '20px',
    transition: 'border-color 0.2s ease, background-color 0.25s ease',
  },
  inputField: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '16px',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
  },
  clearBtn: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  popularRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '30px',
  },
  popularLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  popularChip: {
    padding: '6px 14px',
    borderRadius: '9999px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  loadingBox: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--accent-teal)',
    fontWeight: 600,
    fontSize: '15px',
  },
  noResultsCard: {
    textAlign: 'center',
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'var(--surface)',
  },
  resultsContainer: {
    marginTop: '10px',
  },
  resultsCount: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '16px',
  },
  resultsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resultCard: {
    backgroundColor: 'var(--surface)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: '14px',
    padding: '18px 22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow-card)',
  },
  resultMain: {
    flex: 1,
    paddingRight: '20px',
  },
  medNameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  medName: {
    fontSize: '16.5px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  priceTag: {
    fontSize: '14.5px',
    fontWeight: 700,
    color: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint)',
    padding: '3px 10px',
    borderRadius: '6px',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
  },
  formTag: {
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--surface-alt)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  idTag: {
    fontSize: '11.5px',
    color: 'var(--text-muted)',
  },
  resultArrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13.5px',
    fontWeight: 700,
    color: 'var(--accent-teal)',
    flexShrink: 0,
  },
};
