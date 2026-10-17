import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  QrCode,
  Edit3,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Pill,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  ShieldAlert,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { apiScanImage, apiConfirmScan, apiMatchCatalog } from '../api/client';
import { RegulatoryResult, MedicineBasic } from '../types';

interface ScanPageProps {
  onScanConfirmed: (result: RegulatoryResult) => void;
  onSearchManually: () => void;
}

type ScanMode = 'upload' | 'camera' | 'barcode' | 'manual';

interface ScannedReviewState {
  rawText: string;
  brandInput: string;
  ingredients: string[];
  dosageForm: string;
  strength: string;
  batchNumber: string;
  barcode: string;
  confidenceLevel: 'high' | 'medium' | 'weak';
  isClearRead: boolean;
  clarityMessage: string;
  candidates: MedicineBasic[];
  selectedCandidate: MedicineBasic | null;
  mismatchWarning: string | null;
  photoPreviewUrl?: string;
}

export const ScanPage: React.FC<ScanPageProps> = ({ onScanConfirmed, onSearchManually }) => {
  const [mode, setMode] = useState<ScanMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMatchingCatalog, setIsMatchingCatalog] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review & Verification State after photo reading
  const [scannedReview, setScannedReview] = useState<ScannedReviewState | null>(null);

  // Show/hide raw OCR text block
  const [showRawText, setShowRawText] = useState(false);

  // Input for adding ingredient in the review card
  const [newIngredientInput, setNewIngredientInput] = useState('');

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Start Camera
  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setErrorMsg('Could not access camera. Please check camera permissions or upload an image file instead.');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Capture Photo from Camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
          const previewUrl = URL.createObjectURL(blob);
          stopCamera();
          processImageFile(file, previewUrl);
        }
      }, 'image/jpeg', 0.92);
    }
  };

  // Process File through Backend OCR & Barcode
  const processImageFile = async (file: File, previewUrl?: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    const objectUrl = previewUrl || URL.createObjectURL(file);

    try {
      const res = await apiScanImage(file);
      const ext = res.extracted_entities || {};
      const candidates: MedicineBasic[] = ext.matched_candidates || [];
      const best = ext.best_candidate;

      // Extract detected brand
      const detectedBrand = ext.detected_brand || ext.candidate_brands?.[0] || '';

      // Extract detected active ingredients (e.g. "Flunarizine")
      let detectedIngredients: string[] = ext.detected_ingredients || [];

      // If no ingredients detected in text but a high-confidence best candidate was found where both agree:
      if (detectedIngredients.length === 0 && best?.generic_name) {
        detectedIngredients = [best.generic_name];
      }

      setScannedReview({
        rawText: ext.raw_text || '',
        brandInput: detectedBrand,
        ingredients: detectedIngredients,
        dosageForm: ext.dosage_form || best?.dosage_form || 'Tablet',
        strength: ext.primary_strength || best?.strength || '',
        batchNumber: ext.batch_number || '',
        barcode: ext.barcode || '',
        confidenceLevel: ext.confidence_level || (ext.is_clear_read ? 'high' : 'weak'),
        isClearRead: ext.is_clear_read ?? true,
        clarityMessage: ext.clarity_message || '',
        candidates: candidates,
        selectedCandidate: best || null, // ONLY auto-selected if both agreed!
        mismatchWarning: null,
        photoPreviewUrl: objectUrl,
      });
    } catch (err: any) {
      setErrorMsg(
        'Image could not be processed. Please try again with a clearer, well-lit photo or type the name manually.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // User edits brand or ingredients -> re-run dual-agreement matching
  const reMatchCatalog = async (brand: string, ingredients: string[]) => {
    setIsMatchingCatalog(true);
    try {
      const res = await apiMatchCatalog({ brand, ingredients });
      setScannedReview(prev => {
        if (!prev) return null;
        return {
          ...prev,
          candidates: res.candidates || [],
          selectedCandidate: res.best_candidate || null,
          mismatchWarning: null,
        };
      });
    } catch (e) {
      console.error('Catalog re-match error:', e);
    } finally {
      setIsMatchingCatalog(false);
    }
  };

  // Candidate Selection Handler with Mismatch Rejection
  const handleSelectCandidate = (cand: MedicineBasic) => {
    if (!scannedReview) return;

    // Check if ingredient read from photo isn't in candidate composition
    if (cand.is_mismatch) {
      // BLOCK auto-fill! Show prominent mismatch warning
      setScannedReview(prev => prev ? ({
        ...prev,
        mismatchWarning: cand.mismatch_reason || `The ingredient detected from your photo (${scannedReview.ingredients.join(', ')}) is not present in ${cand.medicine_name}'s composition (${cand.generic_name}). Auto-fill blocked to prevent clinical misidentification.`
      }) : null);
      return;
    }

    // If candidate has brand match but ingredient wasn't verified
    const ings: string[] = [];
    for (const col of ['ingredient_1', 'ingredient_2', 'ingredient_3']) {
      const val = (cand as any)[col];
      if (val && String(val).trim() && String(val).toLowerCase() !== 'nan') {
        ings.push(String(val).trim());
      }
    }
    if (ings.length === 0 && cand.generic_name) {
      ings.push(cand.generic_name);
    }

    setScannedReview(prev => prev ? ({
      ...prev,
      selectedCandidate: cand,
      brandInput: cand.medicine_name,
      dosageForm: cand.dosage_form || prev.dosageForm,
      strength: cand.strength || prev.strength,
      ingredients: ings.length > 0 ? ings : prev.ingredients,
      mismatchWarning: null,
    }) : null);
  };

  // Add an ingredient tag in review screen
  const handleAddIngredient = () => {
    if (newIngredientInput.trim() && scannedReview) {
      const updated = [...scannedReview.ingredients, newIngredientInput.trim()];
      setScannedReview({
        ...scannedReview,
        ingredients: updated,
      });
      setNewIngredientInput('');
      reMatchCatalog(scannedReview.brandInput, updated);
    }
  };

  // Remove an ingredient tag in review screen
  const handleRemoveIngredient = (idx: number) => {
    if (scannedReview) {
      const updated = scannedReview.ingredients.filter((_, i) => i !== idx);
      setScannedReview({ ...scannedReview, ingredients: updated });
      reMatchCatalog(scannedReview.brandInput, updated);
    }
  };

  // Retake photo action
  const handleRetakePhoto = () => {
    setScannedReview(null);
    setErrorMsg(null);
    if (mode === 'camera') {
      startCamera();
    }
  };

  // Switch to clean manual typing
  const handleSwitchToManualType = () => {
    setScannedReview({
      rawText: '',
      brandInput: '',
      ingredients: [],
      dosageForm: 'Tablet',
      strength: '',
      batchNumber: '',
      barcode: '',
      confidenceLevel: 'high',
      isClearRead: true,
      clarityMessage: 'Enter formulation details manually to evaluate CDSCO safety status.',
      candidates: [],
      selectedCandidate: null,
      mismatchWarning: null,
    });
    setMode('manual');
    stopCamera();
  };

  // Submit Final Verification to CDSCO Engine
  const handleVerifySubmit = async () => {
    if (!scannedReview) return;
    setIsProcessing(true);
    try {
      const evalRes = await apiConfirmScan({
        medicine_id: scannedReview.selectedCandidate?.medicine_id || 'CUSTOM_ENTRY',
        medicine_name: scannedReview.brandInput || 'Custom Medicine',
        generic_name: scannedReview.ingredients.join(', ') || scannedReview.selectedCandidate?.generic_name,
        manufacturer: scannedReview.selectedCandidate?.manufacturer || 'User Verified Packaging',
        input_method: mode,
        custom_ingredients: scannedReview.ingredients,
        raw_input: scannedReview.rawText || scannedReview.barcode,
      });
      onScanConfirmed(evalRes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ==========================================
  // RENDER 1: "WE COULDN'T READ THIS CLEARLY"
  // Confidence Check Failed -> Do NOT Guess!
  // ==========================================
  if (scannedReview && (!scannedReview.isClearRead || scannedReview.confidenceLevel === 'weak')) {
    return (
      <div style={styles.container} className="animate-fade-in">
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Scan Packaging</h1>
            <p style={styles.subtitle}>
              Evidence-based pharmaceutical recognition with CDSCO Gazette verification.
            </p>
          </div>
        </div>

        <div className="card" style={styles.weakCard}>
          <div style={styles.weakIconBox}>
            <AlertTriangle size={36} color="var(--status-warning)" />
          </div>
          <h2 style={styles.weakTitle}>We couldn’t read this clearly</h2>
          <p style={styles.weakText}>
            {scannedReview.clarityMessage ||
              'The packaging photo appears blurry, faint, or cut off. To prevent clinical misidentification and ensure patient safety, MediCheck will not fill in an unverified guess.'}
          </p>

          {scannedReview.photoPreviewUrl && (
            <div style={styles.previewThumbnailWrap}>
              <img
                src={scannedReview.photoPreviewUrl}
                alt="Packaging capture thumbnail"
                style={styles.previewThumbnail}
              />
              <span style={styles.previewThumbCaption}>Scanned Packaging Photo</span>
            </div>
          )}

          <div style={styles.weakActionRow}>
            <button
              id="retake-photo-btn"
              className="btn btn-primary btn-lg"
              onClick={handleRetakePhoto}
            >
              <RefreshCw size={18} />
              <span>Retake Photo with Better Light</span>
            </button>
            <button
              id="manual-type-btn"
              className="btn btn-outline btn-lg"
              onClick={handleSwitchToManualType}
            >
              <Edit3 size={18} />
              <span>Type Medicine Name Manually</span>
            </button>
          </div>

          {scannedReview.rawText && (
            <div style={styles.rawTextPreviewBox}>
              <div style={styles.rawTextHeader}>
                <FileText size={14} color="var(--text-muted)" />
                <span>Text detected by scanner:</span>
              </div>
              <pre style={styles.rawPreSnippet}>
                {scannedReview.rawText.trim().slice(0, 180)}...
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 2: "WHAT WAS READ FROM PHOTO" REVIEW
  // Shows Brand ("Sibelium") & Ingredient ("Flunarizine")
  // Allows editing before searching
  // Enforces dual-agreement matching and mismatch rejection
  // ==========================================
  if (scannedReview) {
    return (
      <div style={styles.container} className="animate-fade-in">
        {/* Top Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Confirm What Was Read</h1>
            <p style={styles.subtitle}>
              Displaying text extracted from your photo. Review and correct details before searching the CDSCO catalog.
            </p>
          </div>
          <button
            id="rescan-btn"
            className="btn btn-outline btn-sm"
            onClick={handleRetakePhoto}
          >
            <RefreshCw size={15} />
            <span>Retake / Rescan</span>
          </button>
        </div>

        {/* Confidence & Verification Status Banner */}
        <div style={styles.confidenceBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {scannedReview.confidenceLevel === 'high' ? (
              <CheckCircle size={20} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
            ) : (
              <AlertCircle size={20} color="var(--status-warning)" style={{ flexShrink: 0 }} />
            )}
            <div>
              <div style={styles.confidenceTitle}>
                {scannedReview.confidenceLevel === 'high'
                  ? 'High Confidence Match: Both Brand & Active Ingredient Detected'
                  : 'Packaging Read Verification'}
              </div>
              <div style={styles.confidenceSub}>
                {scannedReview.clarityMessage ||
                  'Ensure active ingredients match the chemical composition printed on your blister pack or bottle.'}
              </div>
            </div>
          </div>
        </div>

        {/* Mismatch Alert Box if user selected an incompatible candidate */}
        {scannedReview.mismatchWarning && (
          <div style={styles.mismatchAlertBox} className="animate-fade-in">
            <ShieldAlert size={22} color="var(--status-danger)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={styles.mismatchTitle}>Composition Mismatch Blocked</div>
              <div style={styles.mismatchText}>{scannedReview.mismatchWarning}</div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setScannedReview({ ...scannedReview, mismatchWarning: null })}
                >
                  Dismiss Warning
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    // Revert to custom formulation matching photo ingredients
                    setScannedReview({
                      ...scannedReview,
                      selectedCandidate: null,
                      mismatchWarning: null,
                    });
                  }}
                >
                  Keep Read Ingredients Directly
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={styles.reviewGrid}>
          {/* Left Column: Editable What Was Read Card */}
          <div className="card" style={styles.editCard}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h3 style={styles.cardHeading}>Text Taken From Photo</h3>
                <p style={styles.cardSub}>
                  Edit brand or active ingredients here to refine search.
                </p>
              </div>
              {isMatchingCatalog && (
                <span style={styles.matchingBadge}>
                  <RefreshCw size={12} className="animate-spin" /> Matching...
                </span>
              )}
            </div>

            {/* Field 1: Brand Name (e.g. "Sibelium") */}
            <div className="form-group">
              <label className="form-label" htmlFor="read-brand-name">
                Brand / Product Name Taken From Photo
              </label>
              <div style={styles.inputWithTag}>
                <input
                  id="read-brand-name"
                  type="text"
                  className="form-input"
                  style={styles.highlightedInput}
                  value={scannedReview.brandInput}
                  placeholder="e.g. Sibelium, Augmentin, Crocin"
                  onChange={(e) => {
                    const val = e.target.value;
                    setScannedReview({ ...scannedReview, brandInput: val });
                    reMatchCatalog(val, scannedReview.ingredients);
                  }}
                />
              </div>
            </div>

            {/* Field 2: Active Ingredients (e.g. "Flunarizine") */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">
                  Active Ingredient(s) Read From Photo
                </label>
                <span style={styles.dualAgreementHint}>
                  Required for catalog agreement
                </span>
              </div>

              {/* Tag pills of detected ingredients */}
              <div style={styles.tagsContainer}>
                {scannedReview.ingredients.map((ing, idx) => (
                  <span key={idx} style={styles.ingTag}>
                    <Pill size={13} color="var(--accent-teal)" />
                    <span style={{ fontWeight: 600 }}>{ing}</span>
                    <button
                      type="button"
                      style={styles.tagCloseBtn}
                      onClick={() => handleRemoveIngredient(idx)}
                      title={`Remove ${ing}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                {scannedReview.ingredients.length === 0 && (
                  <span style={styles.noIngWarning}>
                    No active ingredients confirmed yet. Please add one below (e.g. Flunarizine).
                  </span>
                )}
              </div>

              {/* Add ingredient row */}
              <div style={styles.addTagRow}>
                <input
                  id="read-add-ingredient-input"
                  type="text"
                  placeholder="Add active ingredient (e.g. Flunarizine, Paracetamol)..."
                  className="form-input"
                  value={newIngredientInput}
                  onChange={(e) => setNewIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIngredient();
                    }
                  }}
                />
                <button
                  id="read-add-ingredient-btn"
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddIngredient}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Strength & Dosage Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="read-strength">Strength</label>
                <input
                  id="read-strength"
                  type="text"
                  className="form-input"
                  value={scannedReview.strength}
                  placeholder="e.g. 10mg, 500mg"
                  onChange={(e) => setScannedReview({ ...scannedReview, strength: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="read-dosage-form">Dosage Form</label>
                <input
                  id="read-dosage-form"
                  type="text"
                  className="form-input"
                  value={scannedReview.dosageForm}
                  placeholder="e.g. Tablet, Capsule"
                  onChange={(e) => setScannedReview({ ...scannedReview, dosageForm: e.target.value })}
                />
              </div>
            </div>

            {/* Collapsible: Raw Scanned Text */}
            <div style={styles.rawTextCollapsible}>
              <button
                type="button"
                id="toggle-raw-text-btn"
                style={styles.toggleRawBtn}
                onClick={() => setShowRawText(!showRawText)}
              >
                <FileText size={15} color="var(--accent-teal)" />
                <span>{showRawText ? 'Hide Raw Packaging Text' : 'View Raw Packaging Text Read From Photo'}</span>
                {showRawText ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showRawText && (
                <div style={styles.rawTextExpanded} className="animate-fade-in">
                  <pre style={styles.rawPre}>
                    {scannedReview.rawText || 'No raw text available.'}
                  </pre>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <div style={{ marginTop: '24px' }}>
              <button
                id="verify-submit-btn"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleVerifySubmit}
                disabled={isProcessing}
              >
                {isProcessing ? 'Evaluating CDSCO Safety...' : 'Verify CDSCO Regulatory Safety'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* Right Column: Catalog Agreement Candidates */}
          <div style={styles.catalogColumn}>
            <div className="card" style={styles.catalogCard}>
              <div style={styles.catalogCardHeader}>
                <h3 style={styles.cardHeading}>Catalog Agreement Matches</h3>
                <span style={styles.catalogRuleBadge}>
                  Auto-selects only when both agree
                </span>
              </div>
              <p style={styles.cardSub}>
                Cross-referenced against 253,968 commercial pharmaceuticals. Only auto-fills if brand and ingredient agree.
              </p>

              {/* Current Selection Summary */}
              {scannedReview.selectedCandidate ? (
                <div style={styles.selectedMatchBox}>
                  <div style={styles.selectedMatchHead}>
                    <CheckCircle size={17} color="var(--accent-teal)" />
                    <span style={styles.selectedMatchTitle}>
                      Selected Catalog Entry: {scannedReview.selectedCandidate.medicine_name}
                    </span>
                  </div>
                  <div style={styles.selectedMatchSub}>
                    Composition: <b>{scannedReview.selectedCandidate.generic_name}</b> • {scannedReview.selectedCandidate.manufacturer}
                  </div>
                </div>
              ) : (
                <div style={styles.unselectedNoticeBox}>
                  <HelpCircle size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span>
                    No entry auto-selected yet. Both brand and ingredient must agree to auto-populate.
                  </span>
                </div>
              )}

              {/* Candidates List */}
              <div style={styles.candidateList}>
                {scannedReview.candidates.length === 0 ? (
                  <div style={styles.noCandBox}>
                    No catalog matches found for the current query. Your formulation will be evaluated directly against Section 26A prohibition notifications.
                  </div>
                ) : (
                  scannedReview.candidates.map((cand) => {
                    const isSelected = scannedReview.selectedCandidate?.medicine_id === cand.medicine_id;
                    return (
                      <div
                        key={cand.medicine_id}
                        id={`cand-${cand.medicine_id}`}
                        style={{
                          ...styles.candItem,
                          ...(isSelected ? styles.candItemActive : {}),
                          ...(cand.is_mismatch ? styles.candItemMismatch : {}),
                        }}
                        onClick={() => handleSelectCandidate(cand)}
                      >
                        <div style={styles.candTopRow}>
                          <span style={styles.candName}>{cand.medicine_name}</span>
                          {cand.both_agree && (
                            <span style={styles.agreeBadge}>
                              <Check size={11} strokeWidth={3} />
                              Both Agree
                            </span>
                          )}
                          {cand.brand_match && !cand.ingredient_match && !cand.is_mismatch && (
                            <span style={styles.brandOnlyBadge}>
                              Brand Match Only
                            </span>
                          )}
                          {cand.ingredient_match && !cand.brand_match && (
                            <span style={styles.ingOnlyBadge}>
                              Ingredient Match
                            </span>
                          )}
                          {cand.is_mismatch && (
                            <span style={styles.mismatchBadge}>
                              Mismatch Blocked
                            </span>
                          )}
                        </div>

                        <div style={styles.candSub}>
                          <b>Composition:</b> {cand.generic_name || 'Not specified'} • {cand.manufacturer}
                        </div>

                        <div style={styles.candFoot}>
                          <span>{cand.dosage_form} {cand.strength}</span>
                          {cand.price_inr ? <span>₹{cand.price_inr}</span> : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 3: INITIAL SCANNING MODES
  // (Upload / Camera / Barcode / Manual)
  // ==========================================
  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Scan Packaging</h1>
          <p style={styles.subtitle}>
            Upload an image, capture packaging with your camera, scan a barcode, or enter manually.
          </p>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div style={styles.tabBar}>
        <button
          id="scan-mode-upload"
          style={{ ...styles.modeTab, ...(mode === 'upload' ? styles.modeTabActive : {}) }}
          onClick={() => { setMode('upload'); stopCamera(); setErrorMsg(null); }}
        >
          <Upload size={17} />
          <span>Upload Image</span>
        </button>
        <button
          id="scan-mode-camera"
          style={{ ...styles.modeTab, ...(mode === 'camera' ? styles.modeTabActive : {}) }}
          onClick={() => { setMode('camera'); startCamera(); setErrorMsg(null); }}
        >
          <Camera size={17} />
          <span>Open Camera</span>
        </button>
        <button
          id="scan-mode-barcode"
          style={{ ...styles.modeTab, ...(mode === 'barcode' ? styles.modeTabActive : {}) }}
          onClick={() => { setMode('barcode'); stopCamera(); setErrorMsg(null); }}
        >
          <QrCode size={17} />
          <span>Scan Barcode/QR</span>
        </button>
        <button
          id="scan-mode-manual"
          style={{ ...styles.modeTab, ...(mode === 'manual' ? styles.modeTabActive : {}) }}
          onClick={() => {
            setMode('manual');
            stopCamera();
            handleSwitchToManualType();
          }}
        >
          <Edit3 size={17} />
          <span>Enter Manually</span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div style={styles.errorAlert} className="animate-fade-in">
          <AlertCircle size={20} color="var(--status-danger)" style={{ flexShrink: 0 }} />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Mode 1: Upload Image */}
      {mode === 'upload' && (
        <div className="card" style={styles.uploadCard}>
          <div
            style={styles.dropZone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div style={styles.dropIconBox}>
              <Upload size={32} color="var(--accent-teal)" />
            </div>
            <h3 style={styles.dropTitle}>Upload Packaging Photo</h3>
            <p style={styles.dropSubtitle}>
              Drag and drop blister strip, box, or bottle label image here, or browse from your device
            </p>
            <input
              id="scan-file-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processImageFile(e.target.files[0]);
                }
              }}
            />
            <button
              id="scan-browse-btn"
              className="btn btn-primary"
              onClick={() => document.getElementById('scan-file-input')?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Extracting Text & Ingredients...' : 'Browse Image File'}
            </button>
            <span style={styles.formatHint}>Supported formats: JPG, PNG, WEBP, HEIC</span>
          </div>
        </div>
      )}

      {/* Mode 2: Camera Capture */}
      {mode === 'camera' && (
        <div className="card" style={styles.cameraCard}>
          <div style={styles.videoWrapper}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={styles.videoPlayer}
            />
            {/* Viewfinder Overlay */}
            <div style={styles.viewfinder}>
              <div style={styles.viewfinderCornerTL} />
              <div style={styles.viewfinderCornerTR} />
              <div style={styles.viewfinderCornerBL} />
              <div style={styles.viewfinderCornerBR} />
              <span style={styles.viewfinderText}>Align medicine text within frame</span>
            </div>
          </div>
          <div style={styles.cameraControls}>
            <button
              id="camera-capture-btn"
              className="btn btn-primary btn-lg"
              style={styles.captureBtn}
              onClick={capturePhoto}
              disabled={isProcessing || !cameraActive}
            >
              <Camera size={20} />
              <span>{isProcessing ? 'Analyzing Packaging...' : 'Capture Photo'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 3: Barcode / QR */}
      {mode === 'barcode' && (
        <div className="card" style={styles.uploadCard}>
          <div style={styles.dropZone}>
            <div style={{ ...styles.dropIconBox, backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info)' }}>
              <QrCode size={32} color="var(--status-info)" />
            </div>
            <h3 style={styles.dropTitle}>Scan 1D Barcode or 2D QR Code</h3>
            <p style={styles.dropSubtitle}>
              Upload packaging photo containing the barcode or QR code to detect GTIN / Product ID
            </p>
            <input
              id="scan-barcode-file-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processImageFile(e.target.files[0]);
                }
              }}
            />
            <button
              id="scan-barcode-browse-btn"
              className="btn btn-primary"
              onClick={() => document.getElementById('scan-barcode-file-input')?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Decoding Barcode...' : 'Upload Barcode Image'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    maxWidth: '1150px',
    margin: '0 auto',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
    backgroundColor: 'var(--surface-alt)',
    padding: '4px',
    borderRadius: '12px',
    width: 'fit-content',
    border: '1px solid var(--border-subtle)',
    flexWrap: 'wrap',
  },
  modeTab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 18px',
    borderRadius: '8px',
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
  },
  modeTabActive: {
    backgroundColor: 'var(--surface)',
    color: 'var(--accent-teal)',
    boxShadow: 'var(--shadow-sm)',
    fontWeight: 700,
  },
  uploadCard: {
    padding: '40px',
    textAlign: 'center',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    border: '2px dashed var(--border-strong)',
    borderRadius: '16px',
    backgroundColor: 'var(--surface-alt)',
    transition: 'all 0.2s ease',
  },
  dropIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-mint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  dropTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  dropSubtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    maxWidth: '460px',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  formatHint: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '14px',
  },
  cameraCard: {
    padding: '24px',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    maxHeight: '440px',
    borderRadius: '14px',
    overflow: 'hidden',
    backgroundColor: '#000000',
    display: 'flex',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    maxHeight: '440px',
    objectFit: 'cover',
  },
  viewfinder: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    border: '2px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '12px',
  },
  viewfinderCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTop: '4px solid var(--accent-teal)',
    borderLeft: '4px solid var(--accent-teal)',
    borderRadius: '4px 0 0 0',
  },
  viewfinderCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTop: '4px solid var(--accent-teal)',
    borderRight: '4px solid var(--accent-teal)',
    borderRadius: '0 4px 0 0',
  },
  viewfinderCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottom: '4px solid var(--accent-teal)',
    borderLeft: '4px solid var(--accent-teal)',
    borderRadius: '0 0 0 4px',
  },
  viewfinderCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottom: '4px solid var(--accent-teal)',
    borderRight: '4px solid var(--accent-teal)',
    borderRadius: '0 0 4px 0',
  },
  viewfinderText: {
    fontSize: '12px',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '3px 10px',
    borderRadius: '9999px',
  },
  cameraControls: {
    marginTop: '18px',
    display: 'flex',
    justifyContent: 'center',
  },
  captureBtn: {
    padding: '12px 32px',
    borderRadius: '9999px',
  },
  errorAlert: {
    backgroundColor: 'var(--status-danger-bg)',
    border: '1px solid var(--status-danger-border)',
    borderRadius: '10px',
    padding: '14px 18px',
    color: 'var(--status-danger)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  // Weak Read Card Styles
  weakCard: {
    padding: '40px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '680px',
    margin: '0 auto',
    backgroundColor: 'var(--surface)',
    border: '1.5px solid var(--status-warning-border)',
  },
  weakIconBox: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'var(--status-warning-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px',
  },
  weakTitle: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  weakText: {
    fontSize: '14.5px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '24px',
    maxWidth: '520px',
  },
  weakActionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  previewThumbnailWrap: {
    margin: '14px 0 24px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  previewThumbnail: {
    width: '140px',
    height: '90px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
  },
  previewThumbCaption: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  rawTextPreviewBox: {
    marginTop: '28px',
    width: '100%',
    textAlign: 'left',
    backgroundColor: 'var(--surface-alt)',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-subtle)',
  },
  rawTextHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  rawPreSnippet: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
  },
  // Review Mode Styles
  confidenceBanner: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '14px 18px',
    marginBottom: '20px',
    boxShadow: 'var(--shadow-sm)',
  },
  confidenceTitle: {
    fontSize: '14.5px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  confidenceSub: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  mismatchAlertBox: {
    backgroundColor: 'var(--status-danger-bg)',
    border: '1.5px solid var(--status-danger-border)',
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
  },
  mismatchTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--status-danger)',
  },
  mismatchText: {
    fontSize: '13.5px',
    color: 'var(--text-primary)',
    marginTop: '4px',
    lineHeight: 1.5,
  },
  reviewGrid: {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    gap: '24px',
    alignItems: 'start',
  },
  editCard: {
    padding: '28px',
    backgroundColor: 'var(--surface)',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  cardHeading: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  cardSub: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  matchingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint)',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontWeight: 600,
  },
  highlightedInput: {
    borderColor: 'var(--border-strong)',
    fontWeight: 600,
    fontSize: '15px',
  },
  inputWithTag: {
    position: 'relative',
  },
  dualAgreementHint: {
    fontSize: '11.5px',
    color: 'var(--accent-teal)',
    fontWeight: 600,
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '10px',
    backgroundColor: 'var(--surface-alt)',
    borderRadius: '10px',
    minHeight: '44px',
    marginBottom: '10px',
    border: '1px solid var(--border-subtle)',
    alignItems: 'center',
  },
  ingTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 10px',
    borderRadius: '6px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    boxShadow: 'var(--shadow-sm)',
  },
  tagCloseBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: '4px',
    marginLeft: '2px',
  },
  noIngWarning: {
    fontSize: '12.5px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  addTagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rawTextCollapsible: {
    marginTop: '16px',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '14px',
  },
  toggleRawBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--accent-teal)',
    cursor: 'pointer',
    padding: '4px 0',
  },
  rawTextExpanded: {
    marginTop: '10px',
    backgroundColor: 'var(--surface-alt)',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  rawPre: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
    lineHeight: 1.4,
  },
  catalogColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  catalogCard: {
    padding: '24px',
    backgroundColor: 'var(--surface)',
  },
  catalogCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
    flexWrap: 'wrap',
    gap: '6px',
  },
  catalogRuleBadge: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint)',
    padding: '3px 8px',
    borderRadius: '9999px',
  },
  selectedMatchBox: {
    backgroundColor: 'var(--accent-mint-light)',
    border: '1.5px solid var(--accent-teal)',
    borderRadius: '10px',
    padding: '12px 14px',
    margin: '14px 0',
  },
  selectedMatchHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  selectedMatchTitle: {
    fontSize: '13.5px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  selectedMatchSub: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  unselectedNoticeBox: {
    backgroundColor: 'var(--surface-alt)',
    border: '1px dashed var(--border-strong)',
    borderRadius: '10px',
    padding: '10px 14px',
    margin: '14px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
  },
  candidateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '440px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  candItem: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-alt)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  candItemActive: {
    borderColor: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint)',
    boxShadow: 'var(--shadow-sm)',
  },
  candItemMismatch: {
    borderColor: 'var(--status-danger-border)',
    opacity: 0.85,
  },
  candTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
    gap: '8px',
  },
  candName: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  candSub: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginBottom: '6px',
  },
  candFoot: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11.5px',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  agreeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#FFFFFF',
    backgroundColor: '#059669',
    padding: '2px 8px',
    borderRadius: '9999px',
  },
  brandOnlyBadge: {
    fontSize: '10.5px',
    fontWeight: 600,
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    padding: '2px 7px',
    borderRadius: '9999px',
  },
  ingOnlyBadge: {
    fontSize: '10.5px',
    fontWeight: 600,
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    padding: '2px 7px',
    borderRadius: '9999px',
  },
  mismatchBadge: {
    fontSize: '10.5px',
    fontWeight: 700,
    color: 'var(--status-danger)',
    backgroundColor: 'var(--status-danger-bg)',
    padding: '2px 7px',
    borderRadius: '9999px',
    border: '1px solid var(--status-danger-border)',
  },
  noCandBox: {
    padding: '24px 14px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
};
