import React, { useState, useEffect } from 'react';
import { History, Trash2, ArrowRight, Camera, Search, QrCode, Clock } from 'lucide-react';
import { apiGetHistory, apiDeleteHistory } from '../api/client';
import { ScanHistoryItem } from '../types';

interface HistoryPageProps {
  onSelectMedicine: (medicineId: string) => void;
  onNavigateScan: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onSelectMedicine, onNavigateScan }) => {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      const data = await apiGetHistory();
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await apiDeleteHistory(id);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch {
      alert('Could not delete history record.');
    }
  };

  const getMethodIcon = (method: string) => {
    if (method === 'camera') return <Camera size={15} color="#168C78" />;
    if (method === 'barcode') return <QrCode size={15} color="#2563EB" />;
    return <Search size={15} color="#667580" />;
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={24} color="#168C78" />
          <h1 style={styles.title}>Scan &amp; Verification History</h1>
        </div>
        <p style={styles.subtitle}>
          Chronological record of medicines verified from your account with regulatory findings.
        </p>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading your verification records...</div>
      ) : history.length === 0 ? (
        <div className="card" style={styles.emptyCard}>
          <Clock size={36} color="var(--border-strong)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>No Scans Yet</h3>
          <p style={{ fontSize: '14px', color: '#667580', maxWidth: '400px', marginBottom: '20px', lineHeight: 1.5 }}>
            You haven't scanned or verified any medicines yet. Use the camera or upload packaging images to begin.
          </p>
          <button className="btn btn-primary" onClick={onNavigateScan}>
            <Camera size={16} />
            <span>Scan a Medicine</span>
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {history.map((item) => {
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
                  <div style={styles.methodBadge}>
                    {getMethodIcon(item.input_method)}
                    <span style={{ textTransform: 'capitalize' }}>{item.input_method}</span>
                  </div>
                  <div>
                    <h3 style={styles.itemName}>{item.medicine_name}</h3>
                    <div style={styles.itemMeta}>
                      <span>{item.manufacturer || item.generic_name || 'Verified Formulation'}</span>
                      <span>•</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
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
                    onClick={(e) => handleDelete(e, item.id)}
                    title="Remove from history"
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
  methodBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--surface-alt)',
    padding: '5px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
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
