"""
MediCheck India - FastAPI Main Application
Provides RESTful APIs for authentication, search, OCR scanning, regulatory matching,
PDF reporting, AI assistant, pharmacy locator, scan history, and saved medicines.
"""
import os
import sqlite3
import json
import re
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr

from app.config import DB_PATH
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_optional_current_user
)
from app.matching import evaluate_medicine, split_ingredients
from app.ocr_scanner import run_tesseract_ocr, decode_barcode_or_qr, extract_entities_from_text, match_brand_and_ingredients
from app.reports import generate_pdf_report
from app.ai_assistant import query_ai_assistant
from app.pharmacy_locator import locate_pharmacies

app = FastAPI(
    title="MediCheck India API",
    description="Pharmaceutical Intelligence & Medicine Safety Verification API",
    version="1.0.0"
)

# Enable CORS for Vite dev server and production clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# --- Pydantic Schemas ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class CustomEvaluationRequest(BaseModel):
    medicine_name: str
    ingredients: List[str]
    dosage_form: Optional[str] = "Tablet"
    strength: Optional[str] = ""
    manufacturer: Optional[str] = ""

class ConfirmScanRequest(BaseModel):
    medicine_id: Optional[str] = None
    medicine_name: str
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = None
    input_method: str = "ocr"  # 'ocr', 'camera', 'barcode', 'manual'
    custom_ingredients: Optional[List[str]] = None
    raw_input: Optional[str] = None

class MatchCatalogRequest(BaseModel):
    brand: Optional[str] = ""
    ingredients: Optional[List[str]] = []

class SaveMedicineRequest(BaseModel):
    medicine_id: str
    medicine_name: str
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = None
    verdict_status: str
    verdict_label: str
    notes: Optional[str] = None

class AssistantQueryRequest(BaseModel):
    query: str
    medicine_id: Optional[str] = None
    medicine_name: Optional[str] = None

class ShopFeedbackRequest(BaseModel):
    shop_name: str
    shop_address: Optional[str] = ""
    city: Optional[str] = ""
    pin_code: Optional[str] = ""
    rating: int  # 1 to 5
    comments: Optional[str] = ""

# --- Authentication Endpoints ---

@app.post("/api/auth/register")
def register(req: RegisterRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower().strip(),))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    hashed = hash_password(req.password)
    cursor.execute(
        "INSERT INTO users (email, hashed_password, full_name) VALUES (?, ?, ?)",
        (req.email.lower().strip(), hashed, req.full_name.strip())
    )
    db.commit()
    user_id = cursor.lastrowid

    token = create_access_token({"sub": req.email.lower().strip(), "user_id": user_id, "name": req.full_name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": req.email.lower().strip(),
            "full_name": req.full_name
        }
    }

@app.post("/api/auth/login")
def login(req: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id, email, hashed_password, full_name FROM users WHERE email = ?", (req.email.lower().strip(),))
    row = cursor.fetchone()
    if not row or not verify_password(req.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": row["email"], "user_id": row["id"], "name": row["full_name"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"]
        }
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return user

# --- Medicine Search & Verification Endpoints ---

@app.get("/api/medicines/search")
def search_medicines(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50),
    db: sqlite3.Connection = Depends(get_db)
):
    query = q.strip()
    if not query:
        return {"query": query, "count": 0, "results": []}

    cursor = db.cursor()
    tokens = [re.sub(r'[^a-zA-Z0-9]', '', t) for t in query.split()]
    tokens = [t for t in tokens if t]
    if not tokens:
        return {"query": query, "count": 0, "results": []}

    results = {}

    # 1. Exact or Prefix match on medicine_name (highest priority)
    cursor.execute("""
        SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
        FROM medicines
        WHERE medicine_name LIKE ?
        LIMIT 15
    """, (f"{query}%",))
    for r in cursor.fetchall():
        row = dict(r)
        row['_priority'] = 1
        results[row['medicine_id']] = row

    # 2. Multi-token AND search on medicine_name (e.g. 'Pan' and '40', 'Zerodol' and 'SP', 'Dolo' and '650')
    if len(tokens) > 1:
        like_parts = " AND ".join(["medicine_name LIKE ?" for _ in tokens])
        params = [f"%{t}%" for t in tokens]
        cursor.execute(f"""
            SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
            FROM medicines
            WHERE {like_parts}
            LIMIT 20
        """, params)
        for r in cursor.fetchall():
            row = dict(r)
            if row['medicine_id'] not in results:
                row['_priority'] = 2
                results[row['medicine_id']] = row

    # 3. Substring match on medicine_name for first token
    cursor.execute("""
        SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
        FROM medicines
        WHERE medicine_name LIKE ?
        LIMIT 20
    """, (f"%{tokens[0]}%",))
    for r in cursor.fetchall():
        row = dict(r)
        if row['medicine_id'] not in results:
            row['_priority'] = 3
            results[row['medicine_id']] = row

    # 4. FTS search on medicines_fts
    try:
        clean_fts = " ".join([f"{t}*" for t in tokens[:3]])
        cursor.execute("""
            SELECT m.medicine_id, m.medicine_name, m.generic_name, m.manufacturer, m.strength, m.dosage_form, m.price_inr
            FROM medicines_fts f
            JOIN medicines m ON f.medicine_id = m.medicine_id
            WHERE medicines_fts MATCH ?
            LIMIT 20
        """, (clean_fts,))
        for r in cursor.fetchall():
            row = dict(r)
            if row['medicine_id'] not in results:
                row['_priority'] = 4
                results[row['medicine_id']] = row
    except Exception as e:
        pass

    # 5. Generic name search
    cursor.execute("""
        SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
        FROM medicines
        WHERE generic_name LIKE ?
        LIMIT 15
    """, (f"%{tokens[0]}%",))
    for r in cursor.fetchall():
        row = dict(r)
        if row['medicine_id'] not in results:
            row['_priority'] = 5
            results[row['medicine_id']] = row

    # Sort results by priority, then by length of medicine_name
    sorted_res = sorted(results.values(), key=lambda x: (x['_priority'], len(x['medicine_name'])))
    # Strip internal _priority key before returning
    final_results = []
    for item in sorted_res[:limit]:
        item.pop('_priority', None)
        final_results.append(item)

    return {"query": query, "count": len(final_results), "results": final_results}

@app.get("/api/medicines/{medicine_id}")
def get_medicine_details(medicine_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM medicines WHERE medicine_id = ?", (medicine_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Medicine record not found in master catalog.")

    med_dict = dict(row)
    evaluation = evaluate_medicine(med_dict)
    return evaluation

@app.post("/api/medicines/evaluate-custom")
def evaluate_custom(req: CustomEvaluationRequest):
    med_data = {
        "medicine_id": "CUSTOM_ENTRY",
        "medicine_name": req.medicine_name,
        "generic_name": ", ".join(req.ingredients),
        "dosage_form": req.dosage_form,
        "strength": req.strength,
        "manufacturer": req.manufacturer or "User Provided / Non-catalog"
    }
    evaluation = evaluate_medicine(med_data, custom_ingredients=req.ingredients)
    return evaluation

# --- OCR & Scanning Endpoints ---

@app.post("/api/scan/image")
async def scan_medicine_image(file: UploadFile = File(...)):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file received.")

    barcode_res = decode_barcode_or_qr(contents)
    ocr_text = run_tesseract_ocr(contents)
    entity_res = extract_entities_from_text(ocr_text)

    if barcode_res.get("detected") and barcode_res.get("data"):
        barcode_data = barcode_res["data"]
        entity_res["barcode"] = barcode_data
        entity_res["barcode_type"] = barcode_res.get("type")

    return {
        "success": True,
        "barcode_detected": barcode_res.get("detected", False),
        "barcode_info": barcode_res,
        "extracted_entities": entity_res
    }

@app.post("/api/scan/match-catalog")
def match_catalog_endpoint(req: MatchCatalogRequest):
    return match_brand_and_ingredients(brand=req.brand or "", ingredients=req.ingredients or [])

@app.post("/api/scan/confirm")
def confirm_scan(
    req: ConfirmScanRequest,
    user: Optional[dict] = Depends(get_optional_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    if req.medicine_id and req.medicine_id != "CUSTOM_ENTRY":
        cursor = db.cursor()
        cursor.execute("SELECT * FROM medicines WHERE medicine_id = ?", (req.medicine_id,))
        row = cursor.fetchone()
        if row:
            med_dict = dict(row)
            evaluation = evaluate_medicine(med_dict, custom_ingredients=req.custom_ingredients)
        else:
            med_dict = {
                "medicine_id": req.medicine_id,
                "medicine_name": req.medicine_name,
                "generic_name": req.generic_name
            }
            evaluation = evaluate_medicine(med_dict, custom_ingredients=req.custom_ingredients)
    else:
        med_dict = {
            "medicine_id": "CUSTOM_ENTRY",
            "medicine_name": req.medicine_name,
            "generic_name": req.generic_name,
            "manufacturer": req.manufacturer
        }
        evaluation = evaluate_medicine(med_dict, custom_ingredients=req.custom_ingredients)

    if user:
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO scan_history (
                user_id, medicine_id, medicine_name, generic_name, manufacturer,
                input_method, verdict_status, verdict_label, raw_input
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user["id"],
            evaluation["product_details"].get("medicine_id", "CUSTOM"),
            evaluation["product_details"].get("medicine_name", req.medicine_name),
            evaluation["product_details"].get("generic_name", req.generic_name),
            evaluation["product_details"].get("manufacturer", req.manufacturer),
            req.input_method,
            evaluation["verdict_status"],
            evaluation["verdict_label"],
            req.raw_input
        ))
        db.commit()

    return evaluation

# --- Reports Endpoint ---

@app.get("/api/reports/pdf/{medicine_id}")
def download_pdf_report(
    medicine_id: str,
    name: Optional[str] = None,
    generic: Optional[str] = None,
    ingredients: Optional[str] = None,
    db: sqlite3.Connection = Depends(get_db)
):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM medicines WHERE medicine_id = ?", (medicine_id,))
    row = cursor.fetchone()
    if row:
        evaluation = evaluate_medicine(dict(row))
    else:
        med_dict = {
            "medicine_id": medicine_id,
            "medicine_name": name or medicine_id.replace("_", " "),
            "generic_name": generic or "",
            "manufacturer": "Packaging Verification"
        }
        custom_ings = [i.strip() for i in ingredients.split(",") if i.strip()] if ingredients else []
        evaluation = evaluate_medicine(med_dict, custom_ingredients=custom_ings)

    pdf_bytes = generate_pdf_report(evaluation)
    med_name = evaluation.get("product_details", {}).get("medicine_name", medicine_id)
    clean_name = "".join([c for c in med_name if c.isalnum() or c in (" ", "_")]).strip().replace(" ", "_")
    filename = f"MediCheck_{clean_name}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.post("/api/reports/pdf/generate")
def generate_pdf_report_post(payload: dict):
    if "verdict_status" in payload and "product_details" in payload:
        evaluation = payload
    else:
        med_dict = {
            "medicine_id": payload.get("medicine_id", "CUSTOM_ENTRY"),
            "medicine_name": payload.get("medicine_name", "Clinical Verification"),
            "generic_name": payload.get("generic_name", ""),
            "manufacturer": payload.get("manufacturer", "Packaging Verification")
        }
        custom_ings = payload.get("custom_ingredients") or payload.get("ingredients") or []
        evaluation = evaluate_medicine(med_dict, custom_ingredients=custom_ings)

    pdf_bytes = generate_pdf_report(evaluation)
    med_name = evaluation.get("product_details", {}).get("medicine_name", "Report")
    clean_name = "".join([c for c in med_name if c.isalnum() or c in (" ", "_")]).strip().replace(" ", "_")
    filename = f"MediCheck_{clean_name}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

# --- Scan History & Saved Medicines Endpoints ---

@app.get("/api/history")
def get_user_scan_history(user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        SELECT * FROM scan_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    """, (user["id"],))
    rows = [dict(r) for r in cursor.fetchall()]
    return rows

@app.delete("/api/history/{history_id}")
def delete_history_item(history_id: int, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM scan_history WHERE id = ? AND user_id = ?", (history_id, user["id"]))
    db.commit()
    return {"success": True, "message": "History entry deleted."}

@app.get("/api/saved")
def get_user_saved_medicines(user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        SELECT * FROM saved_medicines
        WHERE user_id = ?
        ORDER BY saved_at DESC
    """, (user["id"],))
    rows = [dict(r) for r in cursor.fetchall()]
    return rows

@app.post("/api/saved")
def save_user_medicine(req: SaveMedicineRequest, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO saved_medicines (
            user_id, medicine_id, medicine_name, generic_name, manufacturer,
            verdict_status, verdict_label, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, medicine_id) DO UPDATE SET
            saved_at = CURRENT_TIMESTAMP,
            notes = excluded.notes
    """, (
        user["id"], req.medicine_id, req.medicine_name, req.generic_name,
        req.manufacturer, req.verdict_status, req.verdict_label, req.notes
    ))
    db.commit()
    return {"success": True, "message": "Medicine saved successfully."}

@app.delete("/api/saved/{medicine_id}")
def remove_saved_medicine(medicine_id: str, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM saved_medicines WHERE user_id = ? AND medicine_id = ?", (user["id"], medicine_id))
    db.commit()
    return {"success": True, "message": "Medicine removed from saved list."}

# --- AI Assistant Endpoint ---

@app.post("/api/assistant/ask")
def ask_ai(req: AssistantQueryRequest, db: sqlite3.Connection = Depends(get_db)):
    evaluation = None
    if req.medicine_id and req.medicine_id != "CUSTOM_ENTRY":
        cursor = db.cursor()
        cursor.execute("SELECT * FROM medicines WHERE medicine_id = ?", (req.medicine_id,))
        row = cursor.fetchone()
        if row:
            evaluation = evaluate_medicine(dict(row))

    result = query_ai_assistant(query=req.query, medicine_name=req.medicine_name, evaluation=evaluation)
    return result

# --- Pharmacy Locator & Feedback Endpoints ---

@app.get("/api/locator/pharmacies")
def get_nearby_pharmacies(
    q: Optional[str] = Query(None, description="City, area, or PIN code in India"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None)
):
    return locate_pharmacies(query=q, lat=lat, lon=lon)

@app.get("/api/locator/feedback")
def get_shop_feedback(shop_name: Optional[str] = None, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    if shop_name:
        cursor.execute("SELECT * FROM shop_feedback WHERE shop_name LIKE ? ORDER BY created_at DESC LIMIT 20", (f"%{shop_name}%",))
    else:
        cursor.execute("SELECT * FROM shop_feedback ORDER BY created_at DESC LIMIT 30")
    rows = [dict(r) for r in cursor.fetchall()]
    return rows

@app.post("/api/locator/feedback")
def submit_shop_feedback(
    req: ShopFeedbackRequest,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO shop_feedback (user_id, user_email, shop_name, shop_address, city, pin_code, rating, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user["id"], user["email"], req.shop_name.strip(), req.shop_address, req.city, req.pin_code, req.rating, req.comments))
    db.commit()
    return {"success": True, "message": "Shop review submitted successfully."}

# --- Healthcheck & Statistics Endpoint ---

@app.get("/api/health")
def healthcheck(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT COUNT(*) FROM medicines")
    med_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM prohibited_fdc")
    fdc_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM banned_drugs")
    banned_count = cursor.fetchone()[0]

    return {
        "status": "healthy",
        "app": "MediCheck India",
        "database": {
            "total_medicines": med_count,
            "prohibited_fdc_records": fdc_count,
            "banned_drug_records": banned_count,
            "sqlite_db_size_mb": round(os.path.getsize(DB_PATH) / (1024 * 1024), 2)
        }
    }

# --- Static Files Mount (Production Frontend) ---
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
