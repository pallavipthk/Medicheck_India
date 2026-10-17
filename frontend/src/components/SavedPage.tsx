import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck, Trash2, ArrowRight, Search, FileText } from 'lucide-react';
import { apiGetSaved, apiRemoveSaved } from '../api/client';
import { SavedMedicineItem } from '../types';

interface SavedPageProps {
  onSelectMedicine: (medicineId: string) => void;
  onNavigateSearch: () => void;
}

export const SavedPage: React.FC<SavedPageProps> = ({ onSelectMedicine, onNavigateSearch }) => {
  const [savedList, setSavedList] = useState<SavedMedicineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = async () => {
    try {
      const data = await apiGetSaved();
      setSavedList(data);
    } catch {
      setSavedList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleRemove = async (e: React.MouseEvent, medId: string) => {
    e.stopPropagation();
    try {
      await apiRemoveSaved(medId);
      setSavedList(prev => prev.filter(item => item.medicine_id !== medId));
    } catch {
      alert('Could not remove medicine.');
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bookmark size={24} color="#168C78" />
          <h1 style={styles.title}>Saved Medicines</h1>
        </div>
        <p style={styles.subtitle}>
          Personal bookmark list of verified pharmaceuticals for rapid status access.
        </p>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading saved medicines...</div>
      ) : savedList.length === 0 ? (
        <div className="card" style={styles.emptyCard}>
          <Bookmark size={36} color="var(--border-strong)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>No Saved Medicines</h3>
          <p style={{ fontSize: '14px', color: '#667580', maxWidth: '400px', marginBottom: '20px', lineHeight: 1.5 }}>
            Bookmark important medicines from scan results or search queries to review their regulatory standing at any time.
          </p>
          <button className="btn btn-primary" onClick={onNavigateSearch}>
            <Search size={16} />
            <span>Search Medicines</span>
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {savedList.map((item) => {
            const isDanger = item.verdict_status === 'prohibited_fdc' || item.verdict_status === 'banned';
            const isWarning = item.verdict_status === 'restricted' || item.verdict_status === 'unable_to_determine';

            return (
              <div
                key={item.id}
                className="card"
                style={styles.cardItem}
                onClick={() => onSelectMedicine(item.medicine_id)}
              >
                <div style={styles.itemLeft}>
                  <div style={styles.bookmarkIcon}>
                    <BookmarkCheck size={20} color="#168C78" />
                  </div>
                  <div>
                    <h3 style={styles.itemName}>{item.medicine_name}</h3>
                    <div style={styles.itemMeta}>
                      <span>{item.manufacturer || item.generic_name || 'Saved formulation'}</span>
                      <span>•</span>
                      <span>Saved on {new Date(item.saved_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div style={styles.itemRight}>
                  <span
                    className={`badge ${isDanger ? 'badge-danger' : isWarning ? 'badge-warning' : 'badge-neutral'}`}
                  >
                    {item.verdict_label}
                  </span>
                  <button
                    type="button"
                    style={styles.deleteBtn}
                    onClick={(e) => handleRemove(e, item.medicine_id)}
                    title="Remove from saved"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ArrowRight size={16} color="#8E9EA8" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    maxWidth: '1000px',
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
  loadingBox: {
    padding: '50px',
    textAlign: 'center',
    color: 'var(--accent-teal)',
    fontWeight: 600,
  },
  emptyCard: {
    padding: '50px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardItem: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  bookmarkIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    backgroundColor: 'var(--accent-mint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemName: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '3px',
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
  },
  itemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  deleteBtn: {
    padding: '6px',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};
