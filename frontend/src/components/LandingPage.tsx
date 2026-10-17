import React, { useEffect, useRef } from 'react';
import { ShieldCheck, ArrowRight, Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LandingPageProps {
  onGetStarted: () => void;
}

interface RealisticCapsule {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  speedX: number;
  speedY: number;
  radius: number;
  length: number;
  // Light mode colors [Highlight, Mid, Shadow]
  lightTop: [string, string, string];
  lightBottom: [string, string, string];
  // Dark mode cyber neon colors [Highlight, Mid, Shadow]
  darkTop: [string, string, string];
  darkBottom: [string, string, string];
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const { toggleTheme, isDark } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Mouse tracking for parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      mouseRef.current.targetX = (e.clientX / w) * 2 - 1;
      mouseRef.current.targetY = (e.clientY / h) * 2 - 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 3D Multicolor Capsules Canvas Render (Distinct Light vs Dark Mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // 3 Distinct Multicolor Capsules with custom light & dark palettes
    const capsules: RealisticCapsule[] = [
      // 1. Center Hero Capsule
      {
        x: 10,
        y: -15,
        z: 35,
        rx: 0.45,
        ry: 0.55,
        rz: -0.25,
        speedX: 0.006,
        speedY: 0.008,
        radius: 38,
        length: 105,
        // Light Mode: Classic Clinical Ruby Red & Glossy White
        lightTop: ['#FCA5A5', '#EF4444', '#7F1D1D'],
        lightBottom: ['#FFFFFF', '#F8FAFC', '#94A3B8'],
        // Dark Mode: Cyber Neon Mint & Deep Metallic Obsidian
        darkTop: ['#A7F3D0', '#00FFA3', '#065F46'],
        darkBottom: ['#1E293B', '#0F172A', '#020617'],
      },
      // 2. Upper Right Capsule
      {
        x: 140,
        y: -110,
        z: -30,
        rx: -0.6,
        ry: -0.7,
        rz: 0.4,
        speedX: 0.005,
        speedY: 0.007,
        radius: 28,
        length: 80,
        // Light Mode: Royal Navy Blue & Warm Amber Gold
        lightTop: ['#93C5FD', '#2563EB', '#1E3A8A'],
        lightBottom: ['#FDE68A', '#F59E0B', '#B45309'],
        // Dark Mode: Electric Violet & Laser Cyan
        darkTop: ['#E9D5FF', '#A855F7', '#581C87'],
        darkBottom: ['#67E8F9', '#06B6D4', '#083344'],
      },
      // 3. Lower Left Capsule
      {
        x: -125,
        y: 105,
        z: -20,
        rx: 0.6,
        ry: 0.4,
        rz: 0.5,
        speedX: 0.006,
        speedY: 0.005,
        radius: 30,
        length: 85,
        // Light Mode: Medical Emerald & Soft Sky Blue
        lightTop: ['#6EE7B7', '#10B981', '#064E3B'],
        lightBottom: ['#BAE6FD', '#0EA5E9', '#0369A1'],
        // Dark Mode: Radioactive Orange & Cyber Pink
        darkTop: ['#FED7AA', '#FB923C', '#7C2D12'],
        darkBottom: ['#FBCFE8', '#F43F5E', '#881337'],
      },
    ];

    // Background Molecular Benzene Nodes
    const ringRadius = 90;
    const benzeneNodes: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const theta = (i * Math.PI) / 3;
      benzeneNodes.push({
        x: Math.cos(theta) * ringRadius,
        y: Math.sin(theta) * ringRadius,
        z: Math.sin(theta * 2) * 20,
      });
    }

    // 3D Point Rotation Helper
    const rotatePoint = (x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
      const cosX = Math.cos(rx), sinX = Math.sin(rx);
      const y1 = y * cosX - z * sinX;
      const z1 = z * cosX + y * sinX;

      const cosY = Math.cos(ry), sinY = Math.sin(ry);
      const x2 = x * cosY + z1 * sinY;
      const z2 = z1 * cosY - x * sinY;

      const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = y1 * cosZ + x2 * sinZ;

      return { x: x3, y: y3, z: z2 };
    };

    // Render Loop (60 FPS)
    const render = () => {
      const cw = canvas.width / window.devicePixelRatio;
      const ch = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, cw, ch);
      time += 0.015;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const tiltX = mouseRef.current.y * 0.35;
      const tiltY = mouseRef.current.x * 0.45;

      const cx = cw / 2;
      const cy = ch / 2;
      const fov = 440;

      // In Dark Mode: Draw Holographic Orbit Rings around the Center Capsule
      if (isDark) {
        ctx.save();
        ctx.translate(cx + 10, cy - 15);
        ctx.rotate(time * 0.6 + tiltY);
        ctx.beginPath();
        ctx.ellipse(0, 0, 80, 24, Math.PI / 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 163, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 0, 92, 28, -Math.PI / 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Background Molecular Benzene Lattice
      ctx.save();
      ctx.translate(cx, cy);
      const rotatedNodes = benzeneNodes.map((n) => {
        const p = rotatePoint(n.x, n.y, n.z, tiltX * 0.5, tiltY * 0.5, 0);
        const scale = fov / (fov + p.z + 100);
        return { x: p.x * scale, y: p.y * scale };
      });

      // Bonds
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6;
        ctx.moveTo(rotatedNodes[i].x, rotatedNodes[i].y);
        ctx.lineTo(rotatedNodes[next].x, rotatedNodes[next].y);
      }
      ctx.strokeStyle = isDark ? 'rgba(0, 255, 163, 0.35)' : 'rgba(22, 140, 120, 0.22)';
      ctx.lineWidth = isDark ? 2 : 1.5;
      ctx.stroke();

      // Nodes
      rotatedNodes.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, isDark ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#00FFA3' : '#168C78';
        if (isDark) {
          ctx.shadowColor = '#00FFA3';
          ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.restore();

      // Render Each Realistic Multicolor 3D Capsule
      capsules.forEach((cap) => {
        cap.rx += cap.speedX;
        cap.ry += cap.speedY;

        ctx.save();
        ctx.translate(cx + cap.x, cy + cap.y);

        const totalRx = cap.rx + tiltX;
        const totalRy = cap.ry + tiltY;
        const totalRz = cap.rz;

        const halfLen = cap.length / 2;
        const topEnd = rotatePoint(0, -halfLen, 0, totalRx, totalRy, totalRz);
        const botEnd = rotatePoint(0, halfLen, 0, totalRx, totalRy, totalRz);
        const center = rotatePoint(0, 0, 0, totalRx, totalRy, totalRz);

        const scale = fov / (fov + center.z + 100);
        const topX = topEnd.x * scale;
        const topY = topEnd.y * scale;
        const botX = botEnd.x * scale;
        const botY = botEnd.y * scale;
        const rad = cap.radius * scale;

        const angle = Math.atan2(botY - topY, botX - topX);
        const length2D = Math.sqrt((botX - topX) ** 2 + (botY - topY) ** 2);

        ctx.translate(topX, topY);
        ctx.rotate(angle);

        // 1. Soft Ambient Ground Shadow
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(length2D / 2, rad * 1.5, length2D * 0.65, rad * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(23, 53, 47, 0.12)';
        ctx.filter = 'blur(6px)';
        ctx.fill();
        ctx.restore();

        const half2D = Math.max(length2D / 2, rad);
        const colorsTop = isDark ? cap.darkTop : cap.lightTop;
        const colorsBot = isDark ? cap.darkBottom : cap.lightBottom;

        // 2. Top Half (Hemisphere Dome + Upper Cylinder)
        const gradTop = ctx.createLinearGradient(0, -rad, 0, rad);
        gradTop.addColorStop(0, colorsTop[0]);
        gradTop.addColorStop(0.35, colorsTop[1]);
        gradTop.addColorStop(0.85, colorsTop[2]);
        gradTop.addColorStop(1, isDark ? '#020617' : '#050B14');

        ctx.beginPath();
        ctx.arc(0, 0, rad, Math.PI / 2, (Math.PI * 3) / 2);
        ctx.lineTo(half2D, -rad);
        ctx.lineTo(half2D, rad);
        ctx.closePath();
        ctx.fillStyle = gradTop;
        ctx.fill();

        // 3. Bottom Half (Lower Cylinder + Hemisphere Dome)
        const gradBot = ctx.createLinearGradient(0, -rad, 0, rad);
        gradBot.addColorStop(0, colorsBot[0]);
        gradBot.addColorStop(0.35, colorsBot[1]);
        gradBot.addColorStop(0.85, colorsBot[2]);
        gradBot.addColorStop(1, isDark ? '#020617' : '#050B14');

        ctx.beginPath();
        ctx.moveTo(half2D, -rad);
        ctx.lineTo(length2D, -rad);
        ctx.arc(length2D, 0, rad, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(half2D, rad);
        ctx.closePath();
        ctx.fillStyle = gradBot;
        ctx.fill();

        // 4. Center Locking Groove Seam
        ctx.beginPath();
        ctx.moveTo(half2D, -rad);
        ctx.lineTo(half2D, rad);
        ctx.strokeStyle = isDark ? 'rgba(0, 255, 163, 0.7)' : 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = isDark ? 2.2 : 1.8;
        ctx.stroke();

        // 5. Specular Glossy Highlight Sheen
        const sheen = ctx.createLinearGradient(0, -rad * 0.7, 0, -rad * 0.2);
        sheen.addColorStop(0, isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.65)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.ellipse(length2D / 2, -rad * 0.48, length2D * 0.38, rad * 0.16, 0, 0, Math.PI * 2);
        ctx.fillStyle = sheen;
        ctx.fill();

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, [isDark]);

  return (
    <div
      style={{
        ...styles.screenContainer,
        backgroundColor: isDark ? '#070C14' : '#F8FAF9',
        color: isDark ? '#F8FAFC' : '#17352F',
      }}
    >
      {/* Dynamic Ambient Mesh Glows (Tailored Light vs Dark) */}
      <div
        style={{
          ...styles.ambientTopGlow,
          background: isDark
            ? 'radial-gradient(circle, rgba(0, 255, 163, 0.16) 0%, transparent 68%)'
            : 'radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, transparent 68%)',
        }}
      />
      <div
        style={{
          ...styles.ambientBottomGlow,
          background: isDark
            ? 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(22, 140, 120, 0.10) 0%, transparent 70%)',
        }}
      />

      {/* Top Header */}
      <header style={styles.topHeader}>
        <div style={styles.brandRow}>
          <div
            style={{
              ...styles.brandIconBox,
              backgroundColor: isDark ? '#00FFA3' : '#168C78',
              boxShadow: isDark
                ? '0 0 20px rgba(0, 255, 163, 0.4)'
                : '0 4px 16px rgba(22, 140, 120, 0.35)',
            }}
          >
            <ShieldCheck size={22} color={isDark ? '#070C14' : '#FFFFFF'} strokeWidth={2.6} />
          </div>
          <div>
            <span
              style={{
                ...styles.brandTitle,
                color: isDark ? '#F8FAFC' : '#17352F',
              }}
            >
              MediCheck India
            </span>
            <span
              style={{
                ...styles.brandSubtitle,
                color: isDark ? '#00FFA3' : '#168C78',
              }}
            >
              {isDark ? 'CYBER BIO-TECH INTELLIGENCE' : 'CDSCO SECTION 26A REGULATORY SAFETY'}
            </span>
          </div>
        </div>

        {/* Interactive Mode Badge & Toggle Button */}
        <div style={styles.topRightControls}>
          <button
            id="landing-theme-toggle-btn"
            style={{
              ...styles.themeToggleBtn,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(0, 255, 163, 0.35)' : '#E0E9E5',
              boxShadow: isDark ? '0 0 15px rgba(0, 255, 163, 0.2)' : 'var(--shadow-sm)',
            }}
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FBBF24' }}>
                <Sun size={17} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC' }}>Dark Cyber</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#168C78' }}>
                <Moon size={17} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#17352F' }}>Clinical Light</span>
              </div>
            )}
          </button>
        </div>
      </header>

      {/* Main Single-Viewport Layout (No Scrollbar, 100vh) */}
      <main style={styles.mainGrid}>
        {/* Left Column: Clean Copy & Get Started CTA */}
        <section style={styles.leftCol}>
          <div
            style={{
              ...styles.badgePill,
              backgroundColor: isDark ? 'rgba(0, 255, 163, 0.1)' : 'var(--accent-mint)',
              borderColor: isDark ? 'rgba(0, 255, 163, 0.35)' : 'var(--border-subtle)',
              color: isDark ? '#00FFA3' : 'var(--accent-teal)',
            }}
          >
            <span
              style={{
                ...styles.pulsingDot,
                backgroundColor: isDark ? '#00FFA3' : '#10B981',
                boxShadow: isDark ? '0 0 8px #00FFA3' : '0 0 6px #10B981',
              }}
            />
            <span>{isDark ? 'CDSCO Section 26A Neural Verification' : 'Official CDSCO Gazette Verification'}</span>
          </div>

          <h1 style={styles.mainTitle}>
            Verify Any Medicine in India.{' '}
            <span
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #00FFA3 0%, #38BDF8 50%, #A855F7 100%)'
                  : 'linear-gradient(135deg, #168C78 0%, #06B6D4 50%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline',
              }}
            >
              Stop Banned &amp; Counterfeit Drugs.
            </span>
          </h1>

          <p
            style={{
              ...styles.description,
              color: isDark ? '#94A3B8' : 'var(--text-secondary)',
            }}
          >
            Instant cross-examination against 1,420+ Section 26A prohibited fixed-dose combinations, AI strip scanner, and certified Jan Aushadhi generic alternatives saving up to 88%.
          </p>

          {/* Primary Action Button: "Get Started" */}
          <div style={styles.ctaWrap}>
            <button
              id="landing-get-started-btn"
              style={{
                ...styles.getStartedBtn,
                backgroundColor: isDark ? '#00FFA3' : 'var(--accent-teal)',
                color: isDark ? '#030712' : '#FFFFFF',
                boxShadow: isDark
                  ? '0 0 30px rgba(0, 255, 163, 0.45), 0 4px 12px rgba(0,0,0,0.5)'
                  : '0 10px 28px rgba(22, 140, 120, 0.38)',
              }}
              onClick={onGetStarted}
              className="shimmer-specular"
            >
              <span>Get Started</span>
              <ArrowRight size={20} strokeWidth={2.6} />
            </button>
            <span
              style={{
                ...styles.ctaNotice,
                color: isDark ? '#64748B' : 'var(--text-muted)',
              }}
            >
              Free Public Access &bull; CDSCO Gazette Synced
            </span>
          </div>

          {/* Clean Trust Stats Card */}
          <div
            style={{
              ...styles.statsBar,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(56, 189, 248, 0.22)' : 'var(--border-subtle)',
              boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.6)' : 'var(--shadow-card)',
            }}
          >
            <div style={styles.statItem}>
              <span
                style={{
                  ...styles.statNumber,
                  color: isDark ? '#F8FAFC' : 'var(--text-primary)',
                }}
              >
                253,968+
              </span>
              <span style={styles.statLabel}>Commercial Meds</span>
            </div>
            <div style={{ ...styles.statDivider, backgroundColor: isDark ? '#1E293B' : '#E0E9E5' }} />
            <div style={styles.statItem}>
              <span style={{ ...styles.statNumber, color: isDark ? '#F87171' : 'var(--status-danger)' }}>1,420+</span>
              <span style={styles.statLabel}>Banned FDCs</span>
            </div>
            <div style={{ ...styles.statDivider, backgroundColor: isDark ? '#1E293B' : '#E0E9E5' }} />
            <div style={styles.statItem}>
              <span style={{ ...styles.statNumber, color: isDark ? '#00FFA3' : 'var(--accent-teal)' }}>12,500+</span>
              <span style={styles.statLabel}>Jan Aushadhi Stores</span>
            </div>
          </div>
        </section>

        {/* Right Column: Realistic 3D Multicolor Capsules (Clean, Realistic) */}
        <section style={styles.rightCol}>
          <canvas ref={canvasRef} style={styles.capsuleCanvas} />
        </section>
      </main>

      {/* Bottom Footer Notice */}
      <footer
        style={{
          ...styles.footerBar,
          borderColor: isDark ? '#1E293B' : 'var(--border-subtle)',
          color: isDark ? '#64748B' : 'var(--text-muted)',
        }}
      >
        <span>&copy; {new Date().getFullYear()} MediCheck India &bull; Drugs and Cosmetics Act 1940 &amp; CDSCO Gazette.</span>
        <span>
          National Emergency Poison Helpline:{' '}
          <span style={{ color: isDark ? '#00FFA3' : 'var(--accent-teal)', fontWeight: 700 }}>
            AIIMS New Delhi 1800 116 117
          </span>
        </span>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  screenContainer: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '20px 48px 16px 48px',
    boxSizing: 'border-box',
    userSelect: 'none',
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
  ambientTopGlow: {
    position: 'absolute',
    top: '-20%',
    right: '10%',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 0,
    transition: 'background 0.3s ease',
  },
  ambientBottomGlow: {
    position: 'absolute',
    bottom: '-20%',
    right: '28%',
    width: '650px',
    height: '650px',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 0,
    transition: 'background 0.3s ease',
  },
  topHeader: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  brandIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
  },
  brandTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '21px',
    fontWeight: 800,
    lineHeight: 1.1,
    display: 'block',
  },
  brandSubtitle: {
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  topRightControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  themeToggleBtn: {
    padding: '8px 16px',
    borderRadius: '9999px',
    border: '1.5px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
  mainGrid: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'minmax(480px, 1.1fr) minmax(420px, 1fr)',
    gap: '36px',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto',
    minHeight: 0,
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
    paddingRight: '16px',
  },
  badgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid',
    padding: '6px 14px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 700,
    transition: 'all 0.3s ease',
  },
  pulsingDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  mainTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: ' clamp(34px, 4.2vw, 52px)',
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.025em',
    margin: 0,
  },
  description: {
    fontSize: '16.5px',
    lineHeight: 1.65,
    margin: 0,
    maxWidth: '560px',
    transition: 'color 0.3s ease',
  },
  ctaWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '6px',
  },
  getStartedBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '14px',
    padding: '17px 44px',
    fontSize: '17.5px',
    fontWeight: 700,
    borderRadius: '14px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  ctaNotice: {
    fontSize: '12.5px',
    fontWeight: 500,
    marginLeft: '6px',
    transition: 'color 0.3s ease',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '22px',
    padding: '14px 24px',
    borderRadius: '16px',
    border: '1.5px solid',
    marginTop: '10px',
    transition: 'all 0.3s ease',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  statNumber: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '19px',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '11.5px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    marginTop: '3px',
  },
  statDivider: {
    width: '1px',
    height: '26px',
    transition: 'background-color 0.3s ease',
  },
  rightCol: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: '400px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleCanvas: {
    width: '100%',
    height: '100%',
    minHeight: '420px',
    pointerEvents: 'none',
  },
  footerBar: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '10px',
    borderTop: '1px solid',
    fontSize: '12px',
    flexWrap: 'wrap',
    gap: '12px',
    transition: 'all 0.3s ease',
  },
};
