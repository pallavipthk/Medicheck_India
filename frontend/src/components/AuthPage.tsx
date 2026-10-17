import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Lock, Mail, User as UserIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  onBackToLanding: () => void;
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onBackToLanding, onSuccess }) => {
  const { login, register } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (isSignUp && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      if (isSignUp) {
        await register(email, password, fullName.trim());
      } else {
        await login(email, password);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Return to Landing action */}
      <button
        id="auth-back-btn"
        style={styles.backBtn}
        onClick={onBackToLanding}
      >
        <ArrowLeft size={18} />
        <span>Back to Home</span>
      </button>

      {/* Main Centered Card */}
      <div style={styles.card} className="animate-fade-in">
        {/* Brand Header */}
        <div style={styles.brandHeader}>
          <div style={styles.logoIcon}>
            <ShieldCheck size={28} color="#168C78" strokeWidth={2.2} />
          </div>
          <h2 style={styles.title}>MediCheck India</h2>
          <p style={styles.subtitle}>
            {isSignUp
              ? 'Create a secure user account to access medicine verification.'
              : 'Sign in to access your dashboard, scan history, and saved medicines.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={styles.tabWrap}>
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              ...(isSignUp ? {} : styles.tabBtnActive),
            }}
            onClick={() => { setIsSignUp(false); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              ...(isSignUp ? styles.tabBtnActive : {}),
            }}
            onClick={() => { setIsSignUp(true); setError(null); }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={styles.errorAlert}>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Full Name</label>
              <div style={styles.inputWrap}>
                <UserIcon size={18} style={styles.inputIcon} />
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Dr. Rajesh Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                  style={styles.inputField}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Email Address</label>
            <div style={styles.inputWrap}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                id="auth-email"
                type="email"
                placeholder="name@healthcare.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={styles.inputField}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <div style={styles.inputWrap}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={styles.inputField}
                required
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} color="#667580" /> : <Eye size={18} color="#667580" />}
              </button>
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Footer switch option */}
        <div style={styles.cardFooter}>
          {isSignUp ? (
            <p style={styles.footerText}>
              Already have an account?{' '}
              <button
                type="button"
                style={styles.footerLink}
                onClick={() => { setIsSignUp(false); setError(null); }}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p style={styles.footerText}>
              Don't have an account?{' '}
              <button
                type="button"
                style={styles.footerLink}
                onClick={() => { setIsSignUp(true); setError(null); }}
              >
                Create one now
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-page)',
    padding: '24px',
    position: 'relative',
    transition: 'background-color 0.25s ease',
  },
  backBtn: {
    position: 'absolute',
    top: '28px',
    left: '28px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontSize: '13.5px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
  card: {
    width: '100%',
    maxWidth: '430px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-3d)',
    padding: '36px 32px',
  },
  brandHeader: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logoIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    backgroundColor: 'var(--accent-mint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 14px auto',
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  tabWrap: {
    display: 'flex',
    backgroundColor: 'var(--surface-alt)',
    padding: '4px',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  tabBtn: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13.5px',
    fontWeight: 600,
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: 'var(--surface)',
    color: 'var(--accent-teal)',
    boxShadow: 'var(--shadow-card)',
  },
  errorAlert: {
    backgroundColor: 'var(--status-danger-bg)',
    border: '1px solid var(--status-danger-border)',
    color: 'var(--status-danger)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    marginBottom: '16px',
    lineHeight: 1.4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
  },
  inputField: {
    paddingLeft: '38px',
    paddingRight: '38px',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    marginTop: '10px',
    fontSize: '15px',
  },
  cardFooter: {
    marginTop: '22px',
    textAlign: 'center',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '16px',
  },
  footerText: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
  },
  footerLink: {
    color: 'var(--accent-teal)',
    fontWeight: 600,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
};
