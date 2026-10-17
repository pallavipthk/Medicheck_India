"""
MediCheck India - Database Indexer
Builds SQLite database with FTS5 search index and regulatory datasets.
"""
import os
import re
import sys
import json
import sqlite3
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(WORKSPACE_DIR, "backend", "medicheck.db")

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

def normalize_drug_token(t: str) -> str:
    if not t or pd.isna(t):
        return ""
    t = str(t).lower()
    t = re.sub(r"\(.*?\)", " ", t)  # strip strengths inside brackets like (500mg)
    t = re.sub(r"\b\d+(\.\d+)?\s*(mg|mcg|gm|g|ml|iu|%|w/w|w/v)\b", " ", t)
    t = re.sub(r"\b(ip|bp|usp|hcl|hydrochloride|maleate|potassium|sodium|tartrate|dispersible|tablets?|capsules?|syrup|suspension|injection|gel|cream|ointment)\b", " ", t)
    t = re.sub(r"[^a-z\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return SYNONYMS.get(t, t)

def split_and_normalize_ingredients(text: str) -> list[str]:
    if not text or pd.isna(text):
        return []
    text = clean_regulatory_text(text)
    parts = re.split(r"\+|,|;|/|\band\b", str(text), flags=re.I)
    tokens = set()
    for p in parts:
        norm = normalize_drug_token(p)
        if norm and len(norm) > 1 and norm not in ["its", "human", "use", "animal", "liquid", "oral", "formulation", "formulations"]:
            tokens.add(norm)
    return sorted(tokens)

def extract_medicine_ingredients(row) -> list[str]:
    ingredients = []
    for col in ["Ingredient_1", "Ingredient_2", "Ingredient_3"]:
        val = row.get(col)
        if pd.notna(val) and str(val).strip() and str(val).lower() not in ["nan", "null", "none"]:
            ingredients.append(str(val).strip())
    
    if not ingredients:
        gen = row.get("Generic_Name")
        if pd.notna(gen) and str(gen).strip() and str(gen).lower() not in ["nan", "null", "none"]:
            ingredients.append(str(gen).strip())
            
    normalized_set = set()
    for ing in ingredients:
        for t in split_and_normalize_ingredients(ing):
            normalized_set.add(t)
    return sorted(normalized_set)

def populate_regulatory_tables():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Clear previous regulatory data
    cursor.execute("DELETE FROM prohibited_fdc;")
    cursor.execute("DELETE FROM banned_drugs;")

    # 1. Prohibited FDCs
    fdc_csv_path = os.path.join(WORKSPACE_DIR, "India_Prohibited_FDC_Combinations_CDSCO.csv")
    fdc_df = pd.read_csv(fdc_csv_path)
    print(f"Loading Prohibited FDCs: {len(fdc_df)} records...")
    
    fdc_records = []
    for _, row in fdc_df.iterrows():
        raw_comb = str(row.get("Full_Combination") or row.get("Combination_Key") or "")
        tokens = split_and_normalize_ingredients(raw_comb)
        for ing_col in ["Ingredient_1", "Ingredient_2", "Ingredient_3", "Ingredient_4"]:
            val = row.get(ing_col)
            if pd.notna(val) and str(val).strip():
                for t in split_and_normalize_ingredients(str(val)):
                    if t not in tokens:
                        tokens.append(t)
        tokens = sorted(set(tokens))

        fdc_records.append((
            str(row.get("Combination_ID") or ""),
            str(row.get("Full_Combination") or ""),
            int(row.get("Ingredient_Count") or len(tokens)),
            str(row.get("Ingredient_1") or ""),
            str(row.get("Ingredient_2") or ""),
            str(row.get("Ingredient_3") or ""),
            str(row.get("Ingredient_4") or ""),
            str(row.get("Regulatory_Category") or "PROHIBITED_FDC"),
            str(row.get("Restriction_Status") or "PROHIBITED"),
            str(row.get("Restriction_Type") or "PROHIBITION_UNDER_SECTION_26A"),
            str(row.get("Reason") or "No therapeutic justification; the FDC may involve risk to human beings."),
            str(row.get("Notification_Number") or ""),
            str(row.get("Notification_Date") or ""),
            str(row.get("Regulatory_Authority") or "Ministry of Health and Family Welfare / CDSCO"),
            str(row.get("Source_URL") or "https://www.cdsco.gov.in/opencms/opencms/en/Drugs/FDC/"),
            json.dumps(tokens)
        ))

    cursor.executemany("""
    INSERT INTO prohibited_fdc (
        combination_id, full_combination, ingredient_count, ingredient_1, ingredient_2,
        ingredient_3, ingredient_4, regulatory_category, restriction_status, restriction_type,
        reason, notification_number, notification_date, regulatory_authority, source_url, normalized_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, fdc_records)
    print(f"Inserted {len(fdc_records)} prohibited FDC records.")

    # 2. Banned Drugs
    banned_csv_path = os.path.join(WORKSPACE_DIR, "India_Banned_Drugs_Final.csv")
    banned_df = pd.read_csv(banned_csv_path)
    print(f"Loading Banned Drugs: {len(banned_df)} records...")
    
    banned_records = []
    for _, row in banned_df.iterrows():
        raw_norm = str(row.get("Ingredients_Normalized") or "").strip()
        raw_drug = str(row.get("Drug_or_Combination") or "").strip()
        tokens_a = split_and_normalize_ingredients(raw_norm) if raw_norm.lower() not in ["", "nan", "null", "none"] else []
        tokens_b = split_and_normalize_ingredients(raw_drug) if raw_drug.lower() not in ["", "nan", "null", "none"] else []
        tokens = tokens_a if len(tokens_a) >= len(tokens_b) and tokens_a else tokens_b

        banned_records.append((
            str(row.get("Ban_ID") or ""),
            str(row.get("Ban_Category") or ""),
            str(row.get("Drug_or_Combination") or ""),
            str(row.get("Ingredients_Normalized") or ""),
            str(row.get("Applies_To") or "HUMAN"),
            str(row.get("Is_Current_Per_Dataset") or "Yes"),
            str(row.get("Ban_Reason") or ""),
            str(row.get("Notification_Number") or ""),
            str(row.get("Notification_Date") or ""),
            str(row.get("Regulatory_Authority") or "Ministry of Health and Family Welfare / CDSCO"),
            str(row.get("Source_URL") or ""),
            str(row.get("Source_Check_Status") or ""),
            json.dumps(tokens)
        ))

    cursor.executemany("""
    INSERT INTO banned_drugs (
        ban_id, ban_category, drug_or_combination, ingredients_normalized, applies_to,
        is_current, ban_reason, notification_number, notification_date, regulatory_authority,
        source_url, source_check_status, normalized_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, banned_records)
    print(f"Inserted {len(banned_records)} banned drug records.")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    populate_regulatory_tables()
    print("Regulatory refresh complete!")
