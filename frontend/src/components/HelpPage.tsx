import React from 'react';
import { HelpCircle, ShieldCheck, AlertTriangle, FileText, Scale, ExternalLink } from 'lucide-react';

export const HelpPage: React.FC = () => {
  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HelpCircle size={24} color="#168C78" />
          <h1 style={styles.title}>Help &amp; Regulatory Framework</h1>
        </div>
        <p style={styles.subtitle}>
          Understand Indian drug regulations, Section 26A prohibitions, and how MediCheck India verifies formulations.
        </p>
      </div>

      <div style={styles.contentGrid}>
        {/* Section 26A Explanation */}
        <div className="card" style={styles.card}>
          <div style={styles.cardTitleRow}>
            <Scale size={20} color="#168C78" />
            <h3 style={styles.cardTitle}>What is Section 26A of the Drugs and Cosmetics Act?</h3>
          </div>
          <p style={styles.para}>
            Section 26A empowers the Central Government of India (Ministry of Health and Family Welfare) to prohibit the manufacture, sale, or distribution of any drug or cosmetic if it is satisfied that the drug involves any risk to human beings or animals, or lacks therapeutic justification.
          </p>
          <p style={styles.para}>
            Prohibitions are officially published as <b>S.O. Gazette Notifications</b>. Over 187 Fixed-Dose Combinations (FDCs) were recently gazetted in August 2024 following recommendations by the Prof. Kokate Expert Committee and the Drugs Technical Advisory Board (DTAB).
          </p>
        </div>

        {/* Regulatory Verdict Guide */}
        <div className="card" style={styles.card}>
          <div style={styles.cardTitleRow}>
            <ShieldCheck size={20} color="#168C78" />
            <h3 style={styles.cardTitle}>Understanding Verdict Statuses</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={styles.statusItem}>
              <span className="badge badge-danger">PROHIBITED FDC MATCH</span>
              <p style={styles.statusDesc}>
                The formulation matches a specific irrational or unsafe fixed-dose combination prohibited under Section 26A Gazette orders.
              </p>
            </div>

            <div style={styles.statusItem}>
              <span className="badge badge-danger">BANNED IN MATCHING RECORDS</span>
              <p style={styles.statusDesc}>
                An individual active ingredient or single-drug formulation is prohibited by the Central Government.
              </p>
            </div>

            <div style={styles.statusItem}>
              <span className="badge badge-warning">RESTRICTED</span>
              <p style={styles.statusDesc}>
                The formulation appears in historical regulatory orders, veterinary restrictions, or special boxed warning schedules.
              </p>
            </div>

            <div style={styles.statusItem}>
              <span className="badge badge-neutral">NO BAN FOUND IN OUR DATA</span>
              <p style={styles.statusDesc}>
                No matching prohibition order was found in the indexed CDSCO datasets. <b>This is NOT a certification of clinical safety or medical approval.</b>
              </p>
            </div>

            <div style={styles.statusItem}>
              <span className="badge badge-warning">UNABLE TO DETERMINE</span>
              <p style={styles.statusDesc}>
                Active ingredients could not be parsed from packaging or catalog. Cross-reference manually.
              </p>
            </div>
          </div>
        </div>

        {/* Official CDSCO Resources */}
        <div className="card" style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <div style={styles.cardTitleRow}>
            <ExternalLink size={20} color="#168C78" />
            <h3 style={styles.cardTitle}>Official Government Drug Regulatory Portals</h3>
          </div>
          <div style={styles.linksGrid}>
            <a
              href="https://cdsco.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.portalLink}
            >
              <b>CDSCO Official Portal</b>
              <span>Central Drugs Standard Control Organisation, Directorate General of Health Services</span>
            </a>
            <a
              href="https://www.cdsco.gov.in/opencms/opencms/en/Drugs/FDC/"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.portalLink}
            >
              <b>CDSCO Fixed Dose Combinations Division</b>
              <span>List of Permitted and Prohibited FDCs in India</span>
            </a>
            <a
              href="https://ipc.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.portalLink}
            >
              <b>Indian Pharmacopoeia Commission (IPC)</b>
              <span>Pharmacovigilance Programme of India (PvPI) for reporting adverse drug events</span>
            </a>
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
  contentGrid: {
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
    marginBottom: '14px',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  para: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    marginBottom: '12px',
  },
  statusItem: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '12px 14px',
  },
  statusDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '6px',
    lineHeight: 1.45,
  },
  linksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '14px',
  },
  portalLink: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '14px 16px',
    backgroundColor: 'var(--surface-alt)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    transition: 'all 0.15s ease',
  },
};
