"""
MediCheck India - Regulatory Matching Engine
Evaluates medicine ingredients against CDSCO Prohibited FDCs and Banned Drug lists.
"""
import re
import json
import sqlite3
from typing import List, Dict, Any, Optional
from app.config import DB_PATH
from app.clinical_knowledge import synthesize_medicine_clinical_info

SYNONYMS = {
    "amoxycillin": "amoxicillin",
    "acetaminophen": "paracetamol",
    "levalbuterol": "levosalbutamol",
    "albuterol": "salbutamol",
    "cpm": "chlorpheniramine",
    "chlorpheniramine maleate": "chlorpheniramine",
    "guaifenesin": "guaiphenesin",
    "folate": "folic acid",
    "rifampin": "rifampicin",
    "furosemide": "frusemide",
    "epinephrine": "adrenaline",
    "lidocaine": "lignocaine",
    "sulfamethoxazole": "sulphamethoxazole",
    "vitamin b1": "thiamine",
    "vitamin b2": "riboflavin",
    "vitamin b3": "niacinamide",
    "vitamin b6": "pyridoxine",
    "vitamin b9": "folic acid",
    "vitamin b12": "cyanocobalamin",
    "vitamin c": "ascorbic acid",
    "vitamin d3": "cholecalciferol",
}

def clean_regulatory_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r"\b(and\s+its\s+formulations?|and\s+their\s+formulations?|and\s+its\s+salts?|for\s+human\s+use|for\s+veterinary\s+use|for\s+animal\s+use|formulations?\s+for\s+systemic\s+human\s+use|formulation\s+for\s+systemic\s+human\s+use|liquid\s+oral\s+preparations?|skin/eye\s+ointment)\b", " ", text)
    return text

def normalize_token(t: str) -> str:
    if not t:
        return ""
    t = str(t).lower()
    t = re.sub(r"\(.*?\)", " ", t)
    t = re.sub(r"\b\d+(\.\d+)?\s*(mg|mcg|gm|g|ml|iu|%|w/w|w/v)\b", " ", t)
    t = re.sub(r"\b(ip|bp|usp|hcl|hydrochloride|maleate|potassium|sodium|tartrate|dispersible|tablets?|capsules?|syrup|suspension|injection|gel|cream|ointment)\b", " ", t)
    t = re.sub(r"[^a-z\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return SYNONYMS.get(t, t)

def split_ingredients(text: str) -> List[str]:
    if not text:
        return []
    text = clean_regulatory_text(text)
    parts = re.split(r"\+|,|;|/|\band\b", str(text), flags=re.I)
    tokens = set()
    for p in parts:
        norm = normalize_token(p)
        if norm and len(norm) > 1 and norm not in ["its", "human", "use", "animal", "liquid", "oral", "formulation", "formulations"]:
            tokens.add(norm)
    return sorted(tokens)

def token_matches(tok_a: str, tok_b: str) -> bool:
    """Check if token a matches token b either exactly or as a whole word."""
    if not tok_a or not tok_b:
        return False
    a = SYNONYMS.get(tok_a, tok_a)
    b = SYNONYMS.get(tok_b, tok_b)
    if a == b:
        return True
    if len(a) >= 4 and len(b) >= 4:
        if a in b or b in a:
            return True
    return False

def get_regulatory_data():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM prohibited_fdc")
    fdc_rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM banned_drugs")
    banned_rows = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return fdc_rows, banned_rows

def evaluate_medicine(
    medicine_data: Dict[str, Any],
    custom_ingredients: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Rigorously checks a medicine against CDSCO Prohibited FDCs and Banned Drug lists.
    Distinguishes:
    1. Product-level status
    2. Ingredient-level findings
    3. Fixed-dose combination (FDC) findings
    """
    fdc_rows, banned_rows = get_regulatory_data()

    # Determine ingredients list
    if custom_ingredients:
        raw_ingredients = custom_ingredients
        normalized_tokens = sorted({normalize_token(i) for i in custom_ingredients if normalize_token(i)})
    else:
        raw_ingredients = []
        for col in ["ingredient_1", "ingredient_2", "ingredient_3"]:
            val = medicine_data.get(col)
            if val and str(val).strip() and str(val).lower() not in ["nan", "none", "null"]:
                raw_ingredients.append(str(val).strip())
        if not raw_ingredients and medicine_data.get("generic_name"):
            raw_ingredients.append(medicine_data["generic_name"])

        # Try parsing normalized_tokens from DB record
        norm_json = medicine_data.get("normalized_tokens")
        if norm_json:
            try:
                normalized_tokens = json.loads(norm_json)
            except Exception:
                normalized_tokens = [normalize_token(x) for x in raw_ingredients]
        else:
            normalized_tokens = []
            for r in raw_ingredients:
                for tok in split_ingredients(r):
                    normalized_tokens.append(tok)
            normalized_tokens = sorted(set(normalized_tokens))

    # Parse individual ingredient details with strengths
    ingredient_analysis = []
    for raw_ing in raw_ingredients:
        strength_match = re.search(r"\b(\d+(\.\d+)?\s*(mg|mcg|gm|g|ml|iu|%|w/w|w/v))\b", raw_ing, flags=re.I)
        strength_val = strength_match.group(0) if strength_match else medicine_data.get("strength") or "Not specified"
        norm_name = normalize_token(raw_ing)

        # Check if this individual ingredient alone is subject to a ban or restriction
        ing_ban_match = None
        for b in banned_rows:
            b_tokens = json.loads(b["normalized_tokens"]) if b.get("normalized_tokens") else []
            if len(b_tokens) == 1 and token_matches(norm_name, b_tokens[0]):
                ing_ban_match = {
                    "ban_id": b["ban_id"],
                    "ban_category": b["ban_category"],
                    "drug_name": b["drug_or_combination"],
                    "reason": b["ban_reason"],
                    "notification_number": b["notification_number"],
                    "notification_date": b["notification_date"],
                    "regulatory_authority": b["regulatory_authority"],
                    "source_url": b["source_url"]
                }
                break

        ingredient_analysis.append({
            "raw_name": raw_ing,
            "normalized_name": norm_name,
            "strength": strength_val,
            "has_restriction": ing_ban_match is not None,
            "matching_record": ing_ban_match,
            "status_text": "Banned/Restricted Component" if ing_ban_match else "No individual prohibition found"
        })

    # Fixed-Dose Combination (FDC) Analysis
    # Must only trigger if the medicine has >= 2 ingredients and ALL ingredients of the prohibited FDC match
    fdc_matches = []
    for f in fdc_rows:
        f_tokens = json.loads(f["normalized_tokens"]) if f.get("normalized_tokens") else []
        if len(f_tokens) >= 2:
            all_present = all(
                any(token_matches(ft, mt) for mt in normalized_tokens)
                for ft in f_tokens
            )
            if all_present:
                fdc_matches.append({
                    "combination_id": f["combination_id"],
                    "full_combination": f["full_combination"],
                    "ingredient_count": f["ingredient_count"],
                    "regulatory_category": f["regulatory_category"],
                    "restriction_status": f["restriction_status"],
                    "restriction_type": f["restriction_type"],
                    "reason": f["reason"],
                    "notification_number": f["notification_number"],
                    "notification_date": f["notification_date"],
                    "regulatory_authority": f["regulatory_authority"],
                    "source_url": f["source_url"],
                    "matched_tokens": f_tokens
                })

    # Multi-ingredient entries in banned_rows
    banned_comb_matches = []
    for b in banned_rows:
        b_tokens = json.loads(b["normalized_tokens"]) if b.get("normalized_tokens") else []
        if len(b_tokens) >= 2:
            all_present = all(
                any(token_matches(bt, mt) for mt in normalized_tokens)
                for bt in b_tokens
            )
            if all_present:
                banned_comb_matches.append({
                    "ban_id": b["ban_id"],
                    "ban_category": b["ban_category"],
                    "drug_name": b["drug_or_combination"],
                    "reason": b["ban_reason"],
                    "notification_number": b["notification_number"],
                    "notification_date": b["notification_date"],
                    "regulatory_authority": b["regulatory_authority"],
                    "source_url": b["source_url"],
                    "is_current": b["is_current"],
                    "matched_tokens": b_tokens
                })

    # Determine Product-Level Status Verdict
    has_cdsco_fdc = len(fdc_matches) > 0
    current_banned_comb = [b for b in banned_comb_matches if b["ban_category"] == "CURRENT_FDC_PROHIBITED"]
    historical_banned_comb = [b for b in banned_comb_matches if b["ban_category"] == "HISTORICAL_FDC_PROHIBITED"]
    banned_single_ingredients = [ing for ing in ingredient_analysis if ing["has_restriction"]]

    evidence_records = []

    if has_cdsco_fdc or current_banned_comb:
        verdict_status = "prohibited_fdc"
        verdict_label = "Prohibited FDC Match"
        verdict_severity = "danger"  # Red
        verdict_description = "This medicine matches an official Fixed Dose Combination (FDC) prohibited under Section 26A of the Drugs and Cosmetics Act by the Central Government."
        for m in fdc_matches:
            evidence_records.append({
                "type": "CDSCO Prohibited FDC",
                "title": m["full_combination"],
                "reason": m["reason"],
                "notification_number": m["notification_number"],
                "notification_date": m["notification_date"],
                "regulatory_authority": m["regulatory_authority"],
                "source_url": m["source_url"]
            })
        for b in current_banned_comb:
            evidence_records.append({
                "type": "Prohibited Combination",
                "title": b["drug_name"],
                "reason": b["reason"],
                "notification_number": b["notification_number"],
                "notification_date": b["notification_date"],
                "regulatory_authority": b["regulatory_authority"],
                "source_url": b["source_url"]
            })

    elif banned_single_ingredients:
        verdict_status = "banned"
        verdict_label = "Banned in Matching Records"
        verdict_severity = "danger"  # Red
        verdict_description = "Contains an active ingredient prohibited or banned under Indian pharmaceutical regulatory orders."
        for ing in banned_single_ingredients:
            rec = ing["matching_record"]
            evidence_records.append({
                "type": "Banned Drug Component",
                "title": rec["drug_name"],
                "reason": rec["reason"],
                "notification_number": rec["notification_number"],
                "notification_date": rec["notification_date"],
                "regulatory_authority": rec["regulatory_authority"],
                "source_url": rec["source_url"]
            })

    elif historical_banned_comb:
        verdict_status = "restricted"
        verdict_label = "Restricted"
        verdict_severity = "warning"  # Amber
        verdict_description = "This combination appears in regulatory historical prohibition or restricted schedules. Clinical verification required."
        for b in historical_banned_comb:
            evidence_records.append({
                "type": "Historical / Restricted FDC",
                "title": b["drug_name"],
                "reason": b["reason"],
                "notification_number": b["notification_number"],
                "notification_date": b["notification_date"],
                "regulatory_authority": b["regulatory_authority"],
                "source_url": b["source_url"]
            })

    elif not normalized_tokens:
        verdict_status = "unable_to_determine"
        verdict_label = "Unable to Determine"
        verdict_severity = "warning"  # Amber
        verdict_description = "Active ingredient composition was not available or could not be determined. Safety evaluation cannot be performed."

    else:
        verdict_status = "no_ban_found"
        verdict_label = "No Ban Found in Our Data"
        verdict_severity = "neutral"  # Neutral Teal / Gray - NEVER "Safe"
        verdict_description = (
            "No matching prohibition or banned record was found for these active ingredients in our verified CDSCO dataset. "
            "Important: This is NOT a medical clearance or guarantee of safety. Always consult a certified healthcare professional."
        )

    clinical_info = synthesize_medicine_clinical_info(
        medicine_name=medicine_data.get("medicine_name", "Unknown Medicine"),
        normalized_ingredients=normalized_tokens,
        therapeutic_category=medicine_data.get("therapeutic_category", "")
    )

    return {
        "verdict_status": verdict_status,
        "verdict_label": verdict_label,
        "verdict_severity": verdict_severity,
        "verdict_description": verdict_description,
        "product_details": {
            "medicine_id": medicine_data.get("medicine_id", ""),
            "medicine_name": medicine_data.get("medicine_name", "Unknown Medicine"),
            "brand_name": medicine_data.get("medicine_name", "Unknown Medicine"),
            "generic_name": medicine_data.get("generic_name", ""),
            "active_ingredients": [ing["raw_name"] for ing in ingredient_analysis],
            "manufacturer": medicine_data.get("manufacturer", ""),
            "strength": medicine_data.get("strength", ""),
            "dosage_form": medicine_data.get("dosage_form", ""),
            "therapeutic_category": medicine_data.get("therapeutic_category", ""),
            "price_inr": medicine_data.get("price_inr", 0.0),
            "pack_size": medicine_data.get("pack_size", ""),
            "is_discontinued": bool(medicine_data.get("is_discontinued", False)),
        },
        "clinical_information": {
            "what_it_is_used_for": clinical_info["what_it_is_used_for"],
            "approved_uses": clinical_info["approved_uses"],
            "precautions": clinical_info["precautions"],
            "side_effects": clinical_info["side_effects"],
            "reliable_reference": clinical_info["reliable_reference"],
            "has_verified_clinical_info": clinical_info["has_verified_clinical_info"]
        },
        "ingredient_analysis": ingredient_analysis,
        "fdc_analysis": {
            "is_combination": len(normalized_tokens) >= 2,
            "ingredient_count": len(normalized_tokens),
            "prohibited_matches": fdc_matches + current_banned_comb,
            "historical_matches": historical_banned_comb
        },
        "evidence_records": evidence_records,
        "data_freshness_disclaimer": (
            "MediCheck India cross-references data from the Central Drugs Standard Control Organisation (CDSCO), "
            "Ministry of Health and Family Welfare Gazette notifications (including August 2024 Section 26A orders), "
            "and official public drug registers. Regulatory statuses may be subject to ongoing judicial reviews and amendments."
        )
    }
