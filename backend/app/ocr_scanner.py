"""
MediCheck India - OCR & Barcode Recognition Engine
Performs image preprocessing, Tesseract OCR text extraction, OpenCV QR/Barcode detection,
dual-agreement matching (brand + active ingredient), mismatch rejection, and confidence checks.
"""
import os
import re
import io
import difflib
import sqlite3
from typing import List, Dict, Any, Optional
import numpy as np
from PIL import Image, ImageOps, ImageEnhance
import cv2
import pytesseract

from app.config import TESSERACT_CMD, DB_PATH
from app.matching import normalize_token, split_ingredients

# Ensure Tesseract path is set
if os.path.exists(TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

STOP_WORDS = {
    "TABLET", "TABLETS", "CAPSULE", "CAPSULES", "EACH", "COATED", "ENTERIC", "STORE", "KEEP",
    "COLOURS", "EXCIPIENTS", "PROTECTED", "TEMPERATURE", "EXCEEDING", "PHYSICIAN",
    "SWALLOWED", "CONTAINS", "MEDICINE", "CHILDREN", "TITANIUM", "DIOXIDE", "OXIDE",
    "YELLOW", "BATCH", "PRICE", "LIMITED", "PHARMA", "MANUFACTURED", "DOSAGE", "DIRECTED",
    "SCHEDULE", "PRESCRIPTION", "DRUG", "CAUTION", "WARNING", "INDIA", "PVT", "LTD",
    "MFG", "LIC", "EXPIRY", "DATE", "M.R.P", "INCL", "TAXES", "FOR", "USE", "ONLY",
    "FILM", "UNCOATED", "SUGAR", "CONTAIN", "PRESCRIBED", "DIRECTED", "REGISTERED",
    "TRADEMARK", "KEEP", "OUT", "REACH", "COOL", "DRY", "PLACE", "AWAY", "LIGHT"
}

DOSAGE_FORMS = [
    "Tablet", "Capsule", "Syrup", "Suspension", "Injection", "Ointment", "Cream", "Gel",
    "Drops", "Inhaler", "Lotion", "Powder", "Emulsion", "Solution"
]

# Cache of known generic active ingredient names from catalog
_KNOWN_GENERICS_CACHE: Optional[Dict[str, str]] = None

def get_known_generics() -> Dict[str, str]:
    """Load normalized distinct generic names from SQLite for rapid ingredient recognition."""
    global _KNOWN_GENERICS_CACHE
    if _KNOWN_GENERICS_CACHE is not None:
        return _KNOWN_GENERICS_CACHE

    generics_dict = {}
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("SELECT DISTINCT generic_name FROM medicines WHERE generic_name IS NOT NULL")
            for row in c.fetchall():
                if row[0]:
                    raw = row[0].strip()
                    norm = normalize_token(raw)
                    if norm and len(norm) >= 3:
                        generics_dict[norm] = raw
            conn.close()
        except Exception as e:
            print("Error loading known generic names:", e)

    _KNOWN_GENERICS_CACHE = generics_dict
    return _KNOWN_GENERICS_CACHE

def decode_barcode_or_qr(image_bytes: bytes) -> dict:
    """Detect and decode QR code or 1D Barcode from image using OpenCV."""
    try:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"detected": False, "type": None, "data": None}

        # 1. Try QR Code Detector
        qr_detector = cv2.QRCodeDetector()
        data, bbox, _ = qr_detector.detectAndDecode(img)
        if data:
            return {"detected": True, "type": "QR_CODE", "data": data.strip()}

        # 2. Try Barcode Detector
        if hasattr(cv2, "barcode") and hasattr(cv2.barcode, "BarcodeDetector"):
            bc_detector = cv2.barcode.BarcodeDetector()
            ret_bc, decoded_info, decoded_type, _ = bc_detector.detectAndDecode(img)
            if ret_bc and decoded_info:
                info = decoded_info[0] if isinstance(decoded_info, (list, tuple)) else decoded_info
                b_type = decoded_type[0] if isinstance(decoded_type, (list, tuple)) else decoded_type
                if info and str(info).strip():
                    return {"detected": True, "type": str(b_type) or "BARCODE", "data": str(info).strip()}
    except Exception as e:
        print("Barcode decoding error:", e)

    return {"detected": False, "type": None, "data": None}

def preprocess_image_for_ocr(pil_img: Image.Image) -> list[Image.Image]:
    """Generate multiple preprocessed variants to maximize OCR accuracy on varied packaging."""
    variants = []

    # Convert to RGB
    img = pil_img.convert("RGB")
    variants.append(img)

    # Grayscale + Autocontrast
    gray = ImageOps.grayscale(img)
    variants.append(gray)

    # Enhanced Contrast
    enhancer = ImageEnhance.Contrast(gray)
    contrast_img = enhancer.enhance(1.8)
    variants.append(contrast_img)

    # Adaptive Threshold via OpenCV
    cv_img = np.array(gray)
    thresh = cv2.adaptiveThreshold(
        cv_img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 6
    )
    thresh_pil = Image.fromarray(thresh)
    variants.append(thresh_pil)

    return variants

def run_tesseract_ocr(image_bytes: bytes) -> str:
    """Run OCR with fallback configurations across image variants."""
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        return f"Error opening image: {e}"

    variants = preprocess_image_for_ocr(pil_img)
    combined_texts = []

    for idx, var in enumerate(variants[:3]):
        try:
            text = pytesseract.image_to_string(var, config="--psm 6")
            if text.strip():
                combined_texts.append(text.strip())
        except Exception:
            pass

    if not combined_texts:
        try:
            text = pytesseract.image_to_string(pil_img, config="--psm 3")
            if text.strip():
                combined_texts.append(text.strip())
        except Exception:
            pass

    return "\n".join(combined_texts)

def extract_entities_from_text(raw_text: str) -> dict:
    """
    Extract candidate brand name, active ingredients, dosage form, strengths, and batch from OCR text.
    Implements:
    - Active ingredient recognition via catalog generic knowledge
    - Distinction between brand candidates and chemical ingredients
    - Dual agreement check (brand + ingredient)
    - Rejection of mismatches
    - Confidence scoring (blocks auto-fill on weak reads)
    """
    known_generics = get_known_generics()
    clean_text = raw_text.replace("\r", "\n")

    # 1. Identify active ingredients in text
    detected_ingredients = []
    # Pattern A: Direct match against catalog generic dictionary
    words_in_text = re.findall(r"\b[A-Za-z]{3,}\b", clean_text)
    for w in words_in_text:
        nw = normalize_token(w)
        if nw in known_generics:
            real_name = known_generics[nw]
            if real_name not in detected_ingredients:
                detected_ingredients.append(real_name)

    # Pattern B: Look for lines containing "contains", "eq. to", "composition" or trailing "IP/BP/USP"
    for line in clean_text.splitlines():
        line_clean = line.strip()
        m_contains = re.search(r"(?:contains|eq\.?\s*to|composition)[:\s]+([A-Za-z\s]+?)(?:\d|\bIP\b|\bBP\b|\bUSP\b|$)", line_clean, flags=re.I)
        if m_contains:
            cand_ing = m_contains.group(1).strip()
            norm_cand = normalize_token(cand_ing)
            if norm_cand and len(norm_cand) >= 3 and norm_cand in known_generics:
                real_ing = known_generics[norm_cand]
                if real_ing not in detected_ingredients:
                    detected_ingredients.append(real_ing)

        # Pattern C: Word preceding IP / BP / USP (e.g. "Flunarizine IP", "Paracetamol IP")
        m_pharmacopeia = re.findall(r"\b([A-Za-z]{3,})\s+(?:IP|BP|USP)\b", line_clean, flags=re.I)
        for cand_ing in m_pharmacopeia:
            norm_cand = normalize_token(cand_ing)
            if norm_cand in known_generics:
                real_ing = known_generics[norm_cand]
                if real_ing not in detected_ingredients:
                    detected_ingredients.append(real_ing)

    # 2. Extract Candidate Brands (uppercase/title-cased words >= 3 chars not in STOP_WORDS and not ingredients)
    detected_ingredient_norms = {normalize_token(i) for i in detected_ingredients}
    candidate_brands = []
    for w in words_in_text:
        upper_w = w.upper()
        norm_w = normalize_token(w)
        if (
            upper_w not in STOP_WORDS
            and norm_w not in detected_ingredient_norms
            and len(w) >= 3
            and not w.isdigit()
        ):
            if w not in candidate_brands:
                candidate_brands.append(w)

    detected_brand = candidate_brands[0] if candidate_brands else ""

    # 3. Strengths
    strengths = re.findall(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|gm|g|ml|iu|%)\b", clean_text, flags=re.I)
    primary_strength = strengths[0] if strengths else ""

    # 4. Dosage Form
    detected_form = ""
    for df in DOSAGE_FORMS:
        if re.search(rf"\b{re.escape(df)}\b", clean_text, flags=re.I):
            detected_form = df
            break

    # 5. Batch No
    batch_match = re.search(r"\b(?:batch|b\.?no|lot)\s*[:.-]?\s*([A-Za-z0-9\-]+)", clean_text, flags=re.I)
    batch_no = batch_match.group(1) if batch_match else ""

    # 6. Evaluate match agreement against database
    catalog_match_result = match_brand_and_ingredients(
        brand=detected_brand,
        ingredients=detected_ingredients,
        candidate_brand_words=candidate_brands[:4],
        full_text=clean_text
    )

    # 7. Confidence Check
    # Check if catalog found any credible match:
    has_valid_candidate = any(c.get("brand_match") or c.get("ingredient_match") for c in catalog_match_result["candidates"])
    text_length_legible = len([c for c in clean_text if c.isalnum()])
    has_substantive_read = (text_length_legible >= 6) and has_valid_candidate

    if not has_substantive_read:
        is_clear_read = False
        confidence_level = "weak"
        clarity_message = "We couldn't read this clearly. Please retake the photo with better lighting or type the medicine name."
        best_candidate = None
    elif catalog_match_result["best_candidate"] and catalog_match_result["best_candidate"].get("both_agree"):
        is_clear_read = True
        confidence_level = "high"
        clarity_message = f"Verified Match: Both brand '{detected_brand}' and active ingredient '{', '.join(detected_ingredients)}' agree with the official catalog."
        best_candidate = catalog_match_result["best_candidate"]
    elif has_valid_candidate:
        is_clear_read = True
        confidence_level = "medium"
        if detected_brand and not detected_ingredients:
            clarity_message = f"Detected brand '{detected_brand}', but could not confirm active ingredient from photo. Please verify ingredients below."
        elif detected_ingredients and not detected_brand:
            clarity_message = f"Detected active ingredient '{', '.join(detected_ingredients)}', but brand was unconfirmed. Please verify medicine name."
        else:
            clarity_message = "Detected packaging text requires confirmation. Please verify details before searching."
        # Do not auto-select if both do not agree!
        best_candidate = None
    else:
        is_clear_read = False
        confidence_level = "weak"
        clarity_message = "We couldn't read this clearly. Please retake the photo or type the name."
        best_candidate = None

    return {
        "raw_text": raw_text,
        "detected_brand": detected_brand,
        "detected_ingredients": detected_ingredients,
        "candidate_brands": candidate_brands[:6],
        "primary_strength": primary_strength,
        "dosage_form": detected_form,
        "batch_number": batch_no,
        "confidence_level": confidence_level,
        "is_clear_read": is_clear_read,
        "clarity_message": clarity_message,
        "matched_candidates": catalog_match_result["candidates"][:6],
        "best_candidate": best_candidate
    }

def match_brand_and_ingredients(
    brand: str,
    ingredients: List[str],
    candidate_brand_words: Optional[List[str]] = None,
    full_text: str = ""
) -> Dict[str, Any]:
    """
    Queries candidates and evaluates dual agreement:
    - Only auto-selects if BOTH brand AND ingredient agree.
    - Explicitly detects and rejects mismatches (if an ingredient read from the photo isn't in candidate formulation).
    """
    if not os.path.exists(DB_PATH):
        return {"candidates": [], "best_candidate": None}

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    words_to_search = list(candidate_brand_words or [])
    if brand and brand not in words_to_search:
        words_to_search.insert(0, brand)

    results = {}

    # Search by brand tokens via FTS5
    for word in words_to_search[:4]:
        if len(word) < 3:
            continue
        try:
            query = f"{word}*"
            cursor.execute("""
                SELECT m.* FROM medicines_fts f
                JOIN medicines m ON f.medicine_id = m.medicine_id
                WHERE medicines_fts MATCH ?
                LIMIT 6
            """, (query,))
            for r in cursor.fetchall():
                row_dict = dict(r)
                results[row_dict["medicine_id"]] = row_dict
        except Exception:
            pass

    # Search by detected ingredients if results are sparse
    for ing in ingredients[:2]:
        norm_ing = normalize_token(ing)
        if len(norm_ing) >= 3:
            try:
                query = f"{norm_ing}*"
                cursor.execute("""
                    SELECT m.* FROM medicines_fts f
                    JOIN medicines m ON f.medicine_id = m.medicine_id
                    WHERE medicines_fts MATCH ?
                    LIMIT 4
                """, (query,))
                for r in cursor.fetchall():
                    row_dict = dict(r)
                    if row_dict["medicine_id"] not in results:
                        results[row_dict["medicine_id"]] = row_dict
            except Exception:
                pass

    # Fallback to LIKE if FTS produced nothing
    if not results and brand:
        cursor.execute("SELECT * FROM medicines WHERE medicine_name LIKE ? LIMIT 5", (f"%{brand}%",))
        for r in cursor.fetchall():
            row_dict = dict(r)
            results[row_dict["medicine_id"]] = row_dict

    conn.close()

    # Normalize photo ingredients
    norm_photo_ingredients = [normalize_token(i) for i in ingredients if normalize_token(i)]
    brand_lower = brand.lower().strip() if brand else ""

    scored_candidates = []

    for m in results.values():
        name_lower = m["medicine_name"].lower()
        cand_generic = m.get("generic_name") or ""
        cand_ing_list = []
        for col in ["ingredient_1", "ingredient_2", "ingredient_3"]:
            val = m.get(col)
            if val and str(val).strip() and str(val).lower() not in ["nan", "none", "null"]:
                cand_ing_list.append(str(val).strip())
        if not cand_ing_list and cand_generic:
            cand_ing_list.append(cand_generic)

        cand_norm_ings = set()
        for ci in cand_ing_list:
            for tok in split_ingredients(ci):
                cand_norm_ings.add(tok)

        # 1. Brand Match Evaluation
        brand_ratio = difflib.SequenceMatcher(None, brand_lower, name_lower[:len(brand_lower) + 10]).ratio() if brand_lower else 0.0
        brand_match = (brand_lower in name_lower) or (brand_ratio >= 0.70)

        # 2. Ingredient Match Evaluation
        ingredient_match = False
        if norm_photo_ingredients:
            # Check if any photo ingredient matches candidate composition
            matches = [pi for pi in norm_photo_ingredients if any(ci == pi or ci in pi or pi in ci for ci in cand_norm_ings)]
            ingredient_match = len(matches) > 0

        # 3. Mismatch Rejection Check:
        # If photo read an ingredient, but that ingredient is completely absent from candidate composition:
        is_mismatch = False
        mismatch_reason = ""
        if norm_photo_ingredients and not ingredient_match:
            is_mismatch = True
            mismatch_reason = f"Ingredient read from photo ('{', '.join(ingredients)}') is not present in {m['medicine_name']}'s composition ('{cand_generic}')."

        # 4. Both Agree Check
        both_agree = brand_match and ingredient_match and not is_mismatch

        # Calculate composite ranking score
        score = 0.0
        if both_agree:
            score += 2.0 + brand_ratio
        elif brand_match and not norm_photo_ingredients:
            # Brand matches and no ingredient was detected in photo
            score += 1.0 + brand_ratio
        elif is_mismatch:
            # Mismatch penalized
            score -= 1.0

        item = dict(m)
        item["brand_match"] = brand_match
        item["ingredient_match"] = ingredient_match
        item["both_agree"] = both_agree
        item["is_mismatch"] = is_mismatch
        item["mismatch_reason"] = mismatch_reason
        item["auto_selected"] = both_agree  # ONLY auto-select if both agree!

        scored_candidates.append((score, item))

    # Sort candidates by score descending
    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    sorted_items = [x[1] for x in scored_candidates]

    # Best candidate is strictly one where both agree!
    best_candidate = None
    if sorted_items and sorted_items[0].get("both_agree"):
        best_candidate = sorted_items[0]

    return {
        "candidates": sorted_items,
        "best_candidate": best_candidate
    }
