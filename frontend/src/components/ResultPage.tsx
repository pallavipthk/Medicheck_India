import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  FileDown,
  Volume2,
  VolumeX,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  Camera,
  Search,
  Bot,
  Pill,
  Building2,
  Layers,
  FileText,
  Info,
  Stethoscope,
  CheckCircle2,
  AlertOctagon,
  BookOpen
} from 'lucide-react';
import { RegulatoryResult } from '../types';
import { apiSaveMedicine, getPdfDownloadUrl, apiDownloadPdfReport } from '../api/client';
import { NavTab } from './Sidebar';

interface ResultPageProps {
  result: RegulatoryResult;
  onNavigate: (tab: NavTab) => void;
  onAskAI: (medicineName: string, result: RegulatoryResult) => void;
  onScanAnother: () => void;
}

export const ResultPage: React.FC<ResultPageProps> = ({
  result,
  onNavigate,
  onAskAI,
  onScanAnother,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const prod = result.product_details;
  const status = result.verdict_status;
  const isDanger = status === 'prohibited_fdc' || status === 'banned';
  const isWarning = status === 'restricted' || status === 'unable_to_determine' || status === 'unconfirmed';

  // Action 1: Save Medicine
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      await apiSaveMedicine({
        medicine_id: prod.medicine_id || 'CUSTOM',
        medicine_name: prod.medicine_name,
        generic_name: prod.generic_name,
        manufacturer: prod.manufacturer,
        verdict_status: result.verdict_status,
        verdict_label: result.verdict_label,
      });
      setIsSaved(true);
      showToast('Medicine saved to your personal list.');
    } catch (err: any) {
      showToast('Please sign in to save medicines to your account.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Action 2: Read Result Aloud
  const handleReadAloud = () => {
    if (!('speechSynthesis' in window)) {
      showToast('Speech synthesis is not supported on this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `
      Medicine ${prod.medicine_name}.
      Regulatory verdict: ${result.verdict_label}.
      ${result.verdict_description}.
      Active formulation: ${result.ingredient_analysis.map(i => i.raw_name).join(', ')}.
    `;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Action 3: Share Result
  const handleShare = async () => {
    const shareText = `MediCheck India Verification: ${prod.medicine_name} — Status: ${result.verdict_label}. Check safety records at MediCheck India.`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MediCheck India — ${prod.medicine_name}`,
          text: shareText,
          url: window.location.href,
        });
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('Result summary copied to clipboard.');
    }
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Action 4: Download PDF Report
  const handleDownloadPdf = async () => {
    const medId = prod.medicine_id || 'CUSTOM_ENTRY';
    setIsDownloadingPdf(true);
    showToast('Generating official CDSCO verification report PDF...');
    try {
      await apiDownloadPdfReport(medId, result);
      showToast('Clinical report downloaded successfully.');
    } catch (err: any) {
      showToast('Direct download error. Opening online report...');
      window.open(getPdfDownloadUrl(medId), '_blank');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Action 5: View Official Notification Link
  const handleViewOfficialNotice = () => {
    const ev = result.evidence_records?.[0];
    const url = ev?.source_url || 'https://www.cdsco.gov.in/opencms/opencms/en/Notifications/Gazette-Notifications/';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={styles.toast} className="animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Top Breadcrumb & Actions Bar */}
      <div style={styles.actionBar}>
        <div style={styles.actionLeft}>
          <button
            className="btn btn-outline btn-sm"
            onClick={onScanAnother}
          >
            <Camera size={15} />
            <span>Scan Another</span>
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate('search')}
          >
            <Search size={15} />
            <span>Search Manually</span>
          </button>
        </div>

        <div style={styles.actionRight}>
          <button
            id="action-ask-ai"
            className="btn btn-secondary btn-sm"
            onClick={() => onAskAI(prod.medicine_name, result)}
          >
            <Bot size={15} />
            <span>Ask AI</span>
          </button>
          <button
            id="action-read-aloud"
            className="btn btn-outline btn-sm"
            onClick={handleReadAloud}
          >
            {isSpeaking ? <VolumeX size={15} color="#DC2626" /> : <Volume2 size={15} />}
            <span>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
          </button>
          <button
            id="action-save-med"
            className="btn btn-outline btn-sm"
            onClick={handleSave}
            disabled={saveLoading}
          >
            {isSaved ? <BookmarkCheck size={15} color="#168C78" /> : <Bookmark size={15} />}
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            id="action-share"
            className="btn btn-outline btn-sm"
            onClick={handleShare}
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>
          <button
            id="action-download-pdf"
            className="btn btn-primary btn-sm"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
          >
            <FileDown size={15} />
            <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Prominent Regulatory Status Banner */}
      <div
        style={{
          ...styles.verdictCard,
          ...(isDanger ? styles.verdictCardDanger : isWarning ? styles.verdictCardWarning : styles.verdictCardNeutral),
        }}
      >
        <div style={styles.verdictIconRow}>
          {isDanger ? (
            <div style={{ ...styles.verdictIcon, backgroundColor: '#FEF2F2', color: '#DC2626' }} className="float-3d shimmer-specular">
              <ShieldAlert size={34} />
            </div>
          ) : isWarning ? (
            <div style={{ ...styles.verdictIcon, backgroundColor: '#FFFBEB', color: '#D97706' }} className="float-3d shimmer-specular">
              <AlertTriangle size={34} />
            </div>
          ) : (
            <div style={{ ...styles.verdictIcon, backgroundColor: '#E5F5EF', color: '#168C78' }} className="float-3d shimmer-specular">
              <ShieldCheck size={34} />
            </div>
          )}

          <div style={styles.verdictTextCol}>
            <div style={styles.verdictLabelRow}>
              <span
                style={{
                  ...styles.statusTag,
                  ...(isDanger ? styles.statusTagDanger : isWarning ? styles.statusTagWarning : styles.statusTagNeutral),
                }}
              >
                {result.verdict_label.toUpperCase()}
              </span>
              <span style={styles.systemTag}>Verified per CDSCO Section 26A Records</span>
            </div>
            <h2 style={styles.verdictHeading}>{prod.medicine_name}</h2>
            <p style={styles.verdictDescription}>{result.verdict_description}</p>
          </div>
        </div>

        {/* Regulatory Caution Notice */}
        <div style={styles.cautionNotice}>
          <Info size={16} color="#667580" style={{ flexShrink: 0 }} />
          <span>
            <b>Regulatory Standard:</b> A finding of <i>"No ban found in our data"</i> confirms the absence of an active prohibition order in the supplied CDSCO records. It is <b>never</b> an endorsement of therapeutic safety or efficacy. Always consult a certified medical practitioner.
          </span>
        </div>
      </div>

      {/* Product Information Card - Comprehensive Specifications */}
      <div className="card" style={styles.productCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={styles.cardTitle}>Product Formulation &amp; Manufacturer Details</h3>
          <span style={styles.pillBadge}>Verified Pharmaceutical Monograph</span>
        </div>

        <div style={styles.detailsGrid}>
          {/* 1. Medicine and Brand Name */}
          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Medicine &amp; Brand Name</span>
            <span style={styles.detailValuePrimary}>{prod.brand_name || prod.medicine_name}</span>
          </div>

          {/* 2. Generic Name */}
          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Generic Salt Specification</span>
            <span style={styles.detailValue}>{prod.generic_name || 'Multi-salt formulation'}</span>
          </div>

          {/* 3. Strength & Dosage Form */}
          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Strength &amp; Dosage Form</span>
            <span style={styles.detailValue}>
              {prod.strength || 'Standard strength'} • {prod.dosage_form || 'Formulation'}
            </span>
          </div>

          {/* 4. Manufacturer */}
          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Licensed Manufacturer</span>
            <span style={styles.detailValue}>{prod.manufacturer || 'Licensed Indian Manufacturer'}</span>
          </div>

          {/* 5. Therapeutic Classification */}
          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Therapeutic Category</span>
            <span style={styles.detailValue}>{prod.therapeutic_category || 'General Therapeutics'}</span>
          </div>

          {/* 6. Pricing & Catalog Identifier */}
          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Market Pricing / Product Code</span>
            <span style={styles.detailValue}>
              {prod.price_inr ? `₹${prod.price_inr}` : 'Market Price'} • {prod.medicine_id || 'CAT-VERIFIED'}
            </span>
          </div>
        </div>

        {/* Active Ingredients List / Badges */}
        <div style={styles.ingredientsRow}>
          <span style={styles.detailLabel}>Active Ingredient(s):</span>
          <div style={styles.tagsWrap}>
            {result.ingredient_analysis.map((ing, i) => (
              <span key={i} className={`badge ${ing.has_restriction ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: '12.5px' }}>
                <Pill size={13} style={{ marginRight: '4px' }} />
                <b>{ing.raw_name}</b> {ing.strength ? `(${ing.strength})` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Authoritative Clinical Pharmacology & Indication Card */}
      {result.clinical_information && (
        <div className="card" style={styles.sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Stethoscope size={22} color="var(--accent-teal)" />
              <h3 style={styles.cardTitle}>Verified Clinical Pharmacology &amp; Approved Indications</h3>
            </div>
            {result.clinical_information.reliable_reference && (
              <div style={styles.referenceBadge}>
                <BookOpen size={14} color="var(--accent-teal)" />
                <span>Reference: {result.clinical_information.reliable_reference}</span>
              </div>
            )}
          </div>

          {/* What the medicine is used for */}
          <div style={styles.clinicalBox}>
            <div style={styles.clinicalHeading}>
              <Info size={16} color="var(--accent-teal)" />
              <span>What this medicine is used for</span>
            </div>
            <p style={styles.clinicalText}>
              {result.clinical_information.what_it_is_used_for || 'Prescribed for clinical management under medical supervision.'}
            </p>
          </div>

          {/* Common approved or established uses */}
          {result.clinical_information.approved_uses && result.clinical_information.approved_uses.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={styles.clinicalHeading}>
                <CheckCircle2 size={16} color="var(--accent-teal)" />
                <span>Common Approved or Established Uses</span>
              </div>
              <ul style={styles.clinicalList}>
                {result.clinical_information.approved_uses.map((use, idx) => (
                  <li key={idx} style={styles.clinicalListItem}>
                    <span style={styles.bulletDot}>•</span>
                    <span>{use}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Relevant Precautions & Common Side Effects (Supported by Reliable Reference) */}
          <div style={styles.precautionsGrid}>
            {result.clinical_information.precautions && result.clinical_information.precautions.length > 0 && (
              <div style={styles.precautionBox}>
                <div style={{ ...styles.clinicalHeading, color: 'var(--status-warning)' }}>
                  <AlertOctagon size={16} color="var(--status-warning)" />
                  <span>Relevant Precautions &amp; Warnings</span>
                </div>
                <ul style={styles.clinicalList}>
                  {result.clinical_information.precautions.map((prec, idx) => (
                    <li key={idx} style={styles.clinicalListItem}>
                      <span style={{ color: 'var(--status-warning)', marginRight: '6px' }}>⚠</span>
                      <span>{prec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.clinical_information.side_effects && result.clinical_information.side_effects.length > 0 && (
              <div style={styles.sideEffectBox}>
                <div style={{ ...styles.clinicalHeading, color: 'var(--text-primary)' }}>
                  <AlertTriangle size={16} color="var(--text-secondary)" />
                  <span>Common Documented Side Effects</span>
                </div>
                <ul style={styles.clinicalList}>
                  {result.clinical_information.side_effects.map((side, idx) => (
                    <li key={idx} style={styles.clinicalListItem}>
                      <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>—</span>
                      <span>{side}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Authoritative Citation Footnote */}
          <div style={styles.referenceNotice}>
            <ShieldCheck size={16} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
            <span>
              <b>Reliable Reference Citations:</b> Clinical indications, precautions, and adverse reactions are corroborated strictly from authoritative pharmaceutical references: <i>{result.clinical_information.reliable_reference}</i>.
            </span>
          </div>
        </div>
      )}

      {/* Ingredient-by-Ingredient Analysis Table */}
      <div className="card" style={styles.sectionCard}>
        <h3 style={styles.cardTitle}>Ingredient-Level Regulatory Analysis</h3>
        <p style={styles.sectionSubtitle}>
          Each active component evaluated independently against Indian prohibited drug schedules.
        </p>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={styles.th}>Active Ingredient</th>
                <th style={styles.th}>Strength</th>
                <th style={styles.th}>Individual Status</th>
                <th style={styles.th}>Relevant Regulatory Finding</th>
              </tr>
            </thead>
            <tbody>
              {result.ingredient_analysis.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#8E9EA8' }}>
                    No specific active ingredients extracted for this record.
                  </td>
                </tr>
              ) : (
                result.ingredient_analysis.map((ing, idx) => (
                  <tr key={idx} style={styles.tableBodyRow}>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Pill size={15} color="var(--accent-teal)" />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ing.raw_name}</span>
                      </div>
                    </td>
                    <td style={styles.td}>{ing.strength}</td>
                    <td style={styles.td}>
                      <span className={`badge ${ing.has_restriction ? 'badge-danger' : 'badge-neutral'}`}>
                        {ing.status_text}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {ing.matching_record ? (
                        <div style={{ fontSize: '13px' }}>
                          <span style={{ fontWeight: 700, color: '#DC2626' }}>{ing.matching_record.drug_name}</span>
                          <div style={{ color: '#667580' }}>Order: {ing.matching_record.notification_number}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#667580', fontSize: '13px' }}>No solo prohibition recorded</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixed-Dose Combination Analysis */}
      <div className="card" style={styles.sectionCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Layers size={20} color="#168C78" />
          <h3 style={styles.cardTitle}>Fixed-Dose Combination (FDC) Analysis</h3>
        </div>
        <p style={styles.sectionSubtitle}>
          Evaluates whether the combined formulation is prohibited as an irrational FDC under CDSCO notifications.
        </p>

        {result.fdc_analysis.prohibited_matches.length > 0 ? (
          <div style={styles.fdcAlertBox}>
            <div style={styles.fdcAlertHeader}>
              <AlertTriangle size={20} color="#DC2626" />
              <h4 style={{ color: '#DC2626', fontWeight: 700 }}>Prohibited Fixed-Dose Combination Match Identified</h4>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px', lineHeight: 1.5 }}>
              This specific combination of active ingredients matches an official prohibition order issued under Section 26A of the Drugs and Cosmetics Act 1940.
            </p>
            {result.fdc_analysis.prohibited_matches.map((match, idx) => (
              <div key={idx} style={styles.evidenceItem}>
                <div style={styles.evRow}>
                  <span style={styles.evLabel}>Prohibited Combination:</span>
                  <span style={styles.evVal}>{match.full_combination || match.drug_name}</span>
                </div>
                <div style={styles.evRow}>
                  <span style={styles.evLabel}>Notification Number:</span>
                  <span style={styles.evVal}>{match.notification_number || 'N/A'}</span>
                </div>
                <div style={styles.evRow}>
                  <span style={styles.evLabel}>Notification Date:</span>
                  <span style={styles.evVal}>{match.notification_date || 'N/A'}</span>
                </div>
                <div style={styles.evRow}>
                  <span style={styles.evLabel}>Reason:</span>
                  <span style={styles.evVal}>{match.reason || 'No therapeutic justification; safety risks identified.'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.fdcSafeBox}>
            <ShieldCheck size={22} color="#168C78" />
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No Prohibited FDC Match Found
              </h4>
              <p style={{ fontSize: '13.5px', color: '#667580', lineHeight: 1.5 }}>
                The active ingredients in this medicine do not match any prohibited combination in our CDSCO Gazette database (including August 2024 orders). Individual ingredients may appear in other banned formulations, but this specific combination is not prohibited in our records.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Official Regulatory Evidence Records */}
      {result.evidence_records.length > 0 && (
        <div className="card" style={styles.sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={styles.cardTitle}>Official Regulatory Gazette Records</h3>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleViewOfficialNotice}
            >
              <span>View Official CDSCO Source</span>
              <ExternalLink size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {result.evidence_records.map((ev, idx) => (
              <div key={idx} style={styles.gazetteBox}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {ev.type}: {ev.title}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#667580' }}>
                    {ev.notification_date}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  <b>Gazette Order:</b> {ev.notification_number} • <b>Authority:</b> {ev.regulatory_authority}
                </div>
                <div style={{ fontSize: '13px', color: '#667580', lineHeight: 1.45 }}>
                  <b>Official Reason:</b> {ev.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legal & Data Freshness Limitations */}
      <div style={styles.disclaimerBox}>
        <FileText size={18} color="#8E9EA8" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '12.5px', color: '#667580', lineHeight: 1.5 }}>
          <b>Regulatory Freshness &amp; Judicial Notice:</b> {result.data_freshness_disclaimer}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  toast: {
    position: 'fixed',
    bottom: '28px',
    right: '28px',
    backgroundColor: '#17352F',
    color: '#FFFFFF',
    padding: '12px 22px',
    borderRadius: '10px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
    fontSize: '14px',
    fontWeight: 600,
    zIndex: 999,
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px',
  },
  actionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  actionRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  verdictCard: {
    borderRadius: '18px',
    padding: '32px 36px',
    marginBottom: '26px',
    boxShadow: '0 4px 16px rgba(23, 53, 47, 0.05)',
  },
  verdictCardDanger: {
    backgroundColor: 'var(--status-danger-bg)',
    border: '2px solid var(--status-danger-border)',
  },
  verdictCardWarning: {
    backgroundColor: 'var(--status-warning-bg)',
    border: '2px solid var(--status-warning-border)',
  },
  verdictCardNeutral: {
    backgroundColor: 'var(--surface)',
    border: '2px solid var(--border-strong)',
  },
  verdictIconRow: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  verdictIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  verdictTextCol: {
    flex: 1,
  },
  verdictLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  statusTag: {
    fontSize: '12.5px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    padding: '4px 12px',
    borderRadius: '9999px',
  },
  statusTagDanger: {
    backgroundColor: 'var(--status-danger)',
    color: '#FFFFFF',
  },
  statusTagWarning: {
    backgroundColor: 'var(--status-warning)',
    color: '#FFFFFF',
  },
  statusTagNeutral: {
    backgroundColor: 'var(--accent-teal)',
    color: '#FFFFFF',
  },
  systemTag: {
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  verdictHeading: {
    fontSize: '26px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
    marginBottom: '8px',
  },
  verdictDescription: {
    fontSize: '15px',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
  },
  cautionNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  productCard: {
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  sectionSubtitle: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  detailBox: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '12px 16px',
  },
  detailLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '4px',
  },
  detailValue: {
    display: 'block',
    fontSize: '14.5px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  sectionCard: {
    marginBottom: '24px',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  tableHeadRow: {
    backgroundColor: 'var(--surface-alt)',
    borderBottom: '1.5px solid var(--border-subtle)',
  },
  th: {
    padding: '12px 14px',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  tableBodyRow: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  td: {
    padding: '14px',
    fontSize: '13.5px',
    color: 'var(--text-primary)',
  },
  fdcAlertBox: {
    backgroundColor: 'var(--status-danger-bg)',
    border: '1.5px solid var(--status-danger-border)',
    borderRadius: '12px',
    padding: '18px 20px',
  },
  fdcAlertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  evidenceItem: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--status-danger-border)',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '8px',
  },
  evRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
    fontSize: '13px',
  },
  evLabel: {
    fontWeight: 700,
    color: 'var(--text-primary)',
    width: '170px',
    flexShrink: 0,
  },
  evVal: {
    color: 'var(--text-secondary)',
    flex: 1,
  },
  fdcSafeBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    backgroundColor: 'var(--accent-mint)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '18px 20px',
  },
  gazetteBox: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '14px 18px',
  },
  disclaimerBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '16px 20px',
    marginTop: '12px',
  },
  pillBadge: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint)',
    border: '1px solid var(--border-subtle)',
    padding: '4px 10px',
    borderRadius: '9999px',
  },
  detailValuePrimary: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 800,
    color: 'var(--accent-teal)',
  },
  ingredientsRow: {
    marginTop: '16px',
    paddingTop: '14px',
    borderTop: '1px solid var(--border-subtle)',
  },
  tagsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },
  referenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--accent-teal)',
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    padding: '4px 10px',
    borderRadius: '8px',
  },
  clinicalBox: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '16px 18px',
    marginBottom: '18px',
  },
  clinicalHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  clinicalText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
  },
  clinicalList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingLeft: '4px',
  },
  clinicalListItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    fontSize: '13.5px',
    color: 'var(--text-primary)',
    lineHeight: 1.5,
  },
  bulletDot: {
    color: 'var(--accent-teal)',
    fontWeight: 'bold',
  },
  precautionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    marginBottom: '18px',
  },
  precautionBox: {
    backgroundColor: 'var(--status-warning-bg)',
    border: '1px solid var(--status-warning-border)',
    borderRadius: '12px',
    padding: '16px 18px',
  },
  sideEffectBox: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '16px 18px',
  },
  referenceNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
};
