import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Search,
  Bot,
  MapPin,
  ArrowRight,
  Bookmark,
  History,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  Layers,
  Sparkles,
  Activity,
  Database,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NavTab } from './Sidebar';
import { apiGetHistory, apiGetSaved } from '../api/client';
import { ScanHistoryItem, SavedMedicineItem } from '../types';

interface DashboardProps {
  onNavigate: (tab: NavTab) => void;
  onSelectMedicine: (medicineId: string) => void;
  onQuickSearch: (query: string) => void;
}

type Point4D = [number, number, number, number];

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onSelectMedicine,
  onQuickSearch,
}) => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const [searchInput, setSearchInput] = useState('');
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [savedMeds, setSavedMeds] = useState<SavedMedicineItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [inspectorMode, setInspectorMode] = useState<'capsule' | '4d'>('capsule');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    async function loadUserData() {
      try {
        const [historyRes, savedRes] = await Promise.all([
          apiGetHistory().catch(() => []),
          apiGetSaved().catch(() => []),
        ]);
        setRecentScans(historyRes.slice(0, 5));
        setSavedMeds(savedRes.slice(0, 5));
      } finally {
        setLoadingData(false);
      }
    }
    loadUserData();
  }, []);

  // 4D Interactive Canvas Inspector
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 320);
    let height = (canvas.height = 200);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = 200;
    };
    window.addEventListener('resize', handleResize);

    // 4D Tesseract Vertices (16 points in R^4)
    const tesseractVertices: Point4D[] = [];
    for (let i = 0; i < 16; i++) {
      tesseractVertices.push([
        (i & 1 ? 1 : -1) * 44,
        (i & 2 ? 1 : -1) * 44,
        (i & 4 ? 1 : -1) * 44,
        (i & 8 ? 1 : -1) * 44,
      ]);
    }

    const tesseractEdges: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        let diff = 0;
        for (let k = 0; k < 4; k++) {
          if (tesseractVertices[i][k] !== tesseractVertices[j][k]) diff++;
        }
        if (diff === 1) tesseractEdges.push([i, j]);
      }
    }

    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      time += 0.012;

      const cx = width / 2;
      const cy = height / 2;
      const fov = 340;
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      if (inspectorMode === '4d') {
        // Real 4D Hypercube Projection
        const angleXW = time * 0.8 + mouseX * 0.5;
        const angleYW = time * 0.5 + mouseY * 0.5;
        const angleZW = time * 0.4;

        const cosXW = Math.cos(angleXW), sinXW = Math.sin(angleXW);
        const cosYW = Math.cos(angleYW), sinYW = Math.sin(angleYW);
        const cosZW = Math.cos(angleZW), sinZW = Math.sin(angleZW);
        const dist4D = 130;

        const pts3D = tesseractVertices.map(([x0, y0, z0, w0]) => {
          let x1 = x0 * cosXW - w0 * sinXW;
          let w1 = w0 * cosXW + x0 * sinXW;

          let y2 = y0 * cosYW - w1 * sinYW;
          let w2 = w1 * cosYW + y0 * sinYW;

          let z3 = z0 * cosZW - w2 * sinZW;
          let w3 = w2 * cosZW + z0 * sinZW;

          const scale4 = dist4D / (dist4D - w3);
          return { x: x1 * scale4, y: y2 * scale4, z: z3 * scale4 };
        });

        const pts2D = pts3D.map((p) => {
          const zTot = p.z + 200;
          const scale3 = fov / (fov + zTot);
          return {
            px: cx + p.x * scale3,
            py: cy + p.y * scale3,
            scale: scale3,
          };
        });

        // Draw 4D Lines
        ctx.lineWidth = isDark ? 1.6 : 1.3;
        for (const [from, to] of tesseractEdges) {
          const p1 = pts2D[from];
          const p2 = pts2D[to];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.strokeStyle = isDark ? 'rgba(0, 212, 146, 0.45)' : 'rgba(22, 140, 120, 0.28)';
            ctx.stroke();
          }
        }

        // Draw 4D Nodes
        for (const p of pts2D) {
          ctx.beginPath();
          const r = Math.max(2, 4 * p.scale);
          ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? '#00D492' : '#168C78';
          if (isDark) {
            ctx.shadowColor = 'rgba(0, 212, 146, 0.8)';
            ctx.shadowBlur = 8;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else {
        // Realistic 3D Multicolor Capsules with Specular Gloss & Shadow
        const rot = time * 0.9 + mouseX * 0.5;
        const tilt = mouseY * 0.3;

        // Capsule 1: Classic Red & Pearl White
        ctx.save();
        ctx.translate(cx - 28, cy);
        ctx.rotate(rot);

        // Ground shadow
        ctx.beginPath();
        ctx.ellipse(0, 48, 22, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(23, 53, 47, 0.12)';
        ctx.fill();

        const w1 = 22;
        const h1 = 26;

        // Top half: Crimson Red
        ctx.beginPath();
        ctx.rect(-w1 / 2, -h1, w1, h1);
        ctx.arc(0, -h1, w1 / 2, Math.PI, 0);
        ctx.closePath();
        const redGrad = ctx.createLinearGradient(-w1 / 2, 0, w1 / 2, 0);
        redGrad.addColorStop(0, '#991B1B');
        redGrad.addColorStop(0.35, '#EF4444');
        redGrad.addColorStop(0.7, '#DC2626');
        redGrad.addColorStop(1, '#7F1D1D');
        ctx.fillStyle = redGrad;
        ctx.fill();

        // Bottom half: Pure Pearl White
        ctx.beginPath();
        ctx.rect(-w1 / 2, 0, w1, h1);
        ctx.arc(0, h1, w1 / 2, 0, Math.PI);
        ctx.closePath();
        const whiteGrad = ctx.createLinearGradient(-w1 / 2, 0, w1 / 2, 0);
        whiteGrad.addColorStop(0, '#94A3B8');
        whiteGrad.addColorStop(0.3, '#FFFFFF');
        whiteGrad.addColorStop(0.8, '#F1F5F9');
        whiteGrad.addColorStop(1, '#64748B');
        ctx.fillStyle = whiteGrad;
        ctx.fill();

        // Seam ring
        ctx.beginPath();
        ctx.moveTo(-w1 / 2, 0);
        ctx.lineTo(w1 / 2, 0);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Specular highlight reflection streak
        ctx.beginPath();
        ctx.ellipse(-w1 * 0.2, 0, 2.5, h1 * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();
        ctx.restore();

        // Capsule 2: Emerald Green & Dark Sapphire / Gold
        ctx.save();
        ctx.translate(cx + 32, cy - 6);
        ctx.rotate(-rot * 0.8 + 0.6);

        // Ground shadow
        ctx.beginPath();
        ctx.ellipse(0, 44, 20, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(23, 53, 47, 0.1)';
        ctx.fill();

        const w2 = 20;
        const h2 = 24;

        // Top half: Emerald
        ctx.beginPath();
        ctx.rect(-w2 / 2, -h2, w2, h2);
        ctx.arc(0, -h2, w2 / 2, Math.PI, 0);
        ctx.closePath();
        const tealGrad = ctx.createLinearGradient(-w2 / 2, 0, w2 / 2, 0);
        tealGrad.addColorStop(0, '#065F46');
        tealGrad.addColorStop(0.3, '#10B981');
        tealGrad.addColorStop(0.7, '#059669');
        tealGrad.addColorStop(1, '#022C22');
        ctx.fillStyle = tealGrad;
        ctx.fill();

        // Bottom half: Deep Sapphire Navy
        ctx.beginPath();
        ctx.rect(-w2 / 2, 0, w2, h2);
        ctx.arc(0, h2, w2 / 2, 0, Math.PI);
        ctx.closePath();
        const navyGrad = ctx.createLinearGradient(-w2 / 2, 0, w2 / 2, 0);
        navyGrad.addColorStop(0, '#0F172A');
        navyGrad.addColorStop(0.3, '#38BDF8');
        navyGrad.addColorStop(0.7, '#0284C7');
        navyGrad.addColorStop(1, '#082F49');
        ctx.fillStyle = navyGrad;
        ctx.fill();

        // Seam ring
        ctx.beginPath();
        ctx.moveTo(-w2 / 2, 0);
        ctx.lineTo(w2 / 2, 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Specular highlight reflection streak
        ctx.beginPath();
        ctx.ellipse(-w2 * 0.2, 0, 2, h2 * 0.65, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    const handleCanvasMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
      };
    };
    canvas.addEventListener('mousemove', handleCanvasMouse);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleCanvasMouse);
    };
  }, [inspectorMode, isDark]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onQuickSearch(searchInput.trim());
      onNavigate('search');
    }
  };

  return (
    <div style={styles.dashboardContainer} className="animate-fade-in">
      {/* Personalized Welcome Header */}
      <div style={styles.welcomeBanner}>
        <div>
          <h1 style={styles.welcomeTitle}>
            Welcome back, {user?.full_name ? user.full_name.split(' ')[0] : 'Pharmacologist'}
          </h1>
          <p style={styles.welcomeSubtitle}>
            Precision medicine safety &amp; CDSCO Gazette Section 26A regulatory intelligence.
          </p>
        </div>
      </div>

      {/* 4 System Metric Intelligence Cards */}
      <div style={styles.statsGrid}>
        <div className="card gyro-card-4d" style={styles.statCard}>
          <div style={styles.statIconBox}>
            <Database size={20} color="var(--accent-teal)" />
          </div>
          <div>
            <div style={styles.statValue}>253,968</div>
            <div style={styles.statLabel}>Commercial Medicines</div>
          </div>
        </div>

        <div className="card gyro-card-4d" style={styles.statCard}>
          <div style={{ ...styles.statIconBox, color: 'var(--status-danger)' }}>
            <AlertTriangle size={20} color="var(--status-danger)" />
          </div>
          <div>
            <div style={styles.statValue}>187 FDCs</div>
            <div style={styles.statLabel}>Section 26A Prohibited</div>
          </div>
        </div>

        <div className="card gyro-card-4d" style={styles.statCard}>
          <div style={{ ...styles.statIconBox, color: 'var(--status-warning)' }}>
            <FileCheck size={20} color="var(--status-warning)" />
          </div>
          <div>
            <div style={styles.statValue}>681 Drugs</div>
            <div style={styles.statLabel}>Gazette Banned Catalog</div>
          </div>
        </div>

        <div className="card gyro-card-4d" style={styles.statCard}>
          <div style={{ ...styles.statIconBox, color: 'var(--status-info)' }}>
            <Activity size={20} color="var(--status-info)" />
          </div>
          <div>
            <div style={styles.statValue}>&lt; 8 ms</div>
            <div style={styles.statLabel}>SQLite FTS5 Query Speed</div>
          </div>
        </div>
      </div>

      {/* Prominent Scan Medicine Action Card with Integrated 4D Gyroscope Inspector */}
      <div style={styles.heroScanCard} className="shimmer-specular">
        <div style={styles.scanCardContent}>
          <div style={styles.scanBadgeRow}>
            <span style={styles.scanBadge}>PRIMARY ACTION</span>
            <span style={styles.scanSubtitle}>Optical &amp; Molecular Verification</span>
          </div>
          <h2 style={styles.scanTitle}>Scan Medicine Packaging</h2>
          <p style={styles.scanDesc}>
            Photograph medicine strips, upload packaging labels, or decode 2D barcodes to automatically resolve active generic salts and cross-reference CDSCO Gazette prohibition orders.
          </p>
          <div style={styles.scanActions}>
            <button
              id="dash-scan-now-btn"
              className="btn btn-primary"
              style={styles.scanPrimaryBtn}
              onClick={() => onNavigate('scan')}
            >
              <Camera size={19} />
              <span>Launch Camera &amp; OCR</span>
              <ArrowRight size={17} />
            </button>
            <button
              id="dash-manual-search-btn"
              className="btn btn-outline"
              style={styles.scanOutlineBtn}
              onClick={() => onNavigate('search')}
            >
              <Search size={17} />
              <span>Catalog Lookup</span>
            </button>
          </div>
        </div>

        {/* 4D Gyroscope Canvas Box */}
        <div style={styles.scanArtworkCol}>
          <div style={styles.canvasContainer}>
            <div style={styles.canvasHeader}>
              <span style={styles.canvasTitle}>
                {inspectorMode === 'capsule' ? '3D Active Medicinal Capsules' : '4D Tesseract Geometry'}
              </span>
              <button
                style={styles.toggleInspectorBtn}
                onClick={() => setInspectorMode(inspectorMode === 'capsule' ? '4d' : 'capsule')}
              >
                <Layers size={13} />
                <span>{inspectorMode === 'capsule' ? 'View 4D' : 'View 3D'}</span>
              </button>
            </div>
            <canvas ref={canvasRef} style={styles.inspectorCanvas} />
            <div style={styles.canvasFooter}>
              <span>Interactive 3D Capsule Projection</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Medicine Search Input */}
      <div style={styles.searchSection}>
        <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
          <div style={styles.searchBar}>
            <Search size={20} color="var(--accent-teal)" />
            <input
              id="dash-search-input"
              type="text"
              placeholder="Search 253,968 medicines by brand (e.g. Augmentin, Ascoril), generic, or salt..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={styles.searchInput}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Quick Access Intelligence Cards */}
      <div style={styles.quickGrid}>
        {/* AI Assistant Shortcut */}
        <div
          id="dash-ai-card"
          className="card gyro-card-4d"
          style={styles.quickCard}
          onClick={() => onNavigate('ai')}
        >
          <div style={{ ...styles.quickIconBox, backgroundColor: 'var(--accent-mint)', color: 'var(--accent-teal)' }}>
            <Bot size={22} />
          </div>
          <div style={styles.quickContent}>
            <h3 style={styles.quickTitle}>AI Regulatory Assistant</h3>
            <p style={styles.quickDesc}>
              Plain-language breakdown of CDSCO Section 26A Gazette notices, safety rationales, and therapeutic classifications.
            </p>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" style={styles.quickArrow} />
        </div>

        {/* Medicine Locator Shortcut */}
        <div
          id="dash-locator-card"
          className="card gyro-card-4d"
          style={styles.quickCard}
          onClick={() => onNavigate('locator')}
        >
          <div style={{ ...styles.quickIconBox, backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info)' }}>
            <MapPin size={22} />
          </div>
          <div style={styles.quickContent}>
            <h3 style={styles.quickTitle}>Pharmacy Locator</h3>
            <p style={styles.quickDesc}>
              Search authentic, licensed retail chemists near your Indian city or PIN code powered by spatial OpenStreetMap.
            </p>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" style={styles.quickArrow} />
        </div>
      </div>

      {/* Actual User Data Sections: Recent Scans & Saved Medicines */}
      <div style={styles.historySavedGrid}>
        {/* Recent Scans */}
        <div className="card" style={styles.columnCard}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <History size={18} color="var(--accent-teal)" />
              <h3 style={styles.cardHeading}>Recent Scans</h3>
            </div>
            {recentScans.length > 0 && (
              <button
                style={styles.viewAllBtn}
                onClick={() => onNavigate('history')}
              >
                View all ({recentScans.length})
              </button>
            )}
          </div>

          {loadingData ? (
            <div style={styles.loadingBox}>Loading your verification records...</div>
          ) : recentScans.length === 0 ? (
            <div style={styles.emptyState}>
              <Clock size={28} color="var(--border-strong)" />
              <p style={styles.emptyText}>No recent scans recorded yet.</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('scan')}
              >
                Scan your first medicine
              </button>
            </div>
          ) : (
            <div style={styles.itemsList}>
              {recentScans.map((scan) => {
                const isProhibited = scan.verdict_status === 'prohibited_fdc' || scan.verdict_status === 'banned';
                return (
                  <div
                    key={scan.id}
                    style={styles.historyRow}
                    onClick={() => onSelectMedicine(scan.medicine_id)}
                  >
                    <div style={styles.itemMain}>
                      <div style={styles.itemName}>{scan.medicine_name}</div>
                      <div style={styles.itemSub}>
                        {scan.manufacturer || scan.generic_name || 'Verified entry'}
                      </div>
                    </div>
                    <span
                      className={`badge ${isProhibited ? 'badge-danger' : 'badge-neutral'}`}
                      style={{ fontSize: '11.5px' }}
                    >
                      {scan.verdict_label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Saved Medicines */}
        <div className="card" style={styles.columnCard}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <Bookmark size={18} color="var(--accent-teal)" />
              <h3 style={styles.cardHeading}>Saved Medicines</h3>
            </div>
            {savedMeds.length > 0 && (
              <button
                style={styles.viewAllBtn}
                onClick={() => onNavigate('saved')}
              >
                View all ({savedMeds.length})
              </button>
            )}
          </div>

          {loadingData ? (
            <div style={styles.loadingBox}>Loading your saved records...</div>
          ) : savedMeds.length === 0 ? (
            <div style={styles.emptyState}>
              <Bookmark size={28} color="var(--border-strong)" />
              <p style={styles.emptyText}>You haven't saved any medicines yet.</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('search')}
              >
                Search &amp; save medicines
              </button>
            </div>
          ) : (
            <div style={styles.itemsList}>
              {savedMeds.map((med) => {
                const isProhibited = med.verdict_status === 'prohibited_fdc' || med.verdict_status === 'banned';
                return (
                  <div
                    key={med.id}
                    style={styles.historyRow}
                    onClick={() => onSelectMedicine(med.medicine_id)}
                  >
                    <div style={styles.itemMain}>
                      <div style={styles.itemName}>{med.medicine_name}</div>
                      <div style={styles.itemSub}>{med.manufacturer || med.generic_name || 'Saved record'}</div>
                    </div>
                    <span
                      className={`badge ${isProhibited ? 'badge-danger' : 'badge-neutral'}`}
                      style={{ fontSize: '11.5px' }}
                    >
                      {med.verdict_label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  dashboardContainer: {
    padding: '28px 36px',
    width: '100%',
  },
  welcomeBanner: {
    marginBottom: '24px',
  },
  welcomeTitle: {
    fontSize: '28px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  welcomeSubtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '26px',
  },
  statCard: {
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  statIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    backgroundColor: 'var(--accent-mint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '19px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    lineHeight: 1.15,
  },
  statLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  heroScanCard: {
    backgroundColor: 'var(--surface)',
    border: '1.5px solid var(--border-strong)',
    borderRadius: '20px',
    padding: '32px 36px',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '32px',
    marginBottom: '28px',
    position: 'relative',
    overflow: 'hidden',
  },
  scanCardContent: {
    flex: 1,
    maxWidth: '620px',
  },
  scanBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  scanBadge: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint)',
    padding: '4px 10px',
    borderRadius: '9999px',
  },
  scanSubtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  scanTitle: {
    fontSize: '26px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '10px',
    letterSpacing: '-0.01em',
  },
  scanDesc: {
    fontSize: '14.5px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '24px',
  },
  scanActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  scanPrimaryBtn: {
    padding: '13px 26px',
    fontSize: '15px',
  },
  scanOutlineBtn: {
    padding: '13px 22px',
    fontSize: '15px',
  },
  scanArtworkCol: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasContainer: {
    width: '280px',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-page)',
    border: '1px solid var(--border-subtle)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)',
  },
  canvasHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  canvasTitle: {
    fontSize: '11.5px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  toggleInspectorBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--accent-teal)',
    cursor: 'pointer',
  },
  inspectorCanvas: {
    width: '100%',
    height: '140px',
    cursor: 'crosshair',
  },
  canvasFooter: {
    fontSize: '10.5px',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  searchSection: {
    marginBottom: '28px',
  },
  searchForm: {
    width: '100%',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--surface)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: '14px',
    padding: '8px 14px',
    boxShadow: 'var(--shadow-card)',
    gap: '12px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  quickCard: {
    padding: '22px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    cursor: 'pointer',
  },
  quickIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickContent: {
    flex: 1,
  },
  quickTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  quickDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  quickArrow: {
    flexShrink: 0,
    transition: 'transform 0.2s ease',
  },
  historySavedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px',
  },
  columnCard: {
    minHeight: '260px',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '12px',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardHeading: {
    fontSize: '16.5px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  viewAllBtn: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--accent-teal)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  loadingBox: {
    padding: '30px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13.5px',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    gap: '10px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-alt)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  itemMain: {
    flex: 1,
    overflow: 'hidden',
    paddingRight: '12px',
  },
  itemName: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  itemSub: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
};
