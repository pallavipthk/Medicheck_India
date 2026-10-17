# MediCheck India — Pharmaceutical Intelligence & Medicine Safety Platform

**MediCheck India** is a modern, evidence-based pharmaceutical technology application built to cross-reference commercial Indian medicines against official **Central Drugs Standard Control Organisation (CDSCO)** Gazette notifications and **Section 26A** prohibited Fixed-Dose Combinations (FDCs).

---

## 1. System Architecture

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS design system.
  - **Light Theme Only**: Warm white (`#F8FAF9`), pure white surfaces (`#FFFFFF`), medical teal (`#168C78`), pale mint (`#E5F5EF`), and deep navy text (`#17352F`).
  - **Realistic 4D & 3D Interactive Graphics**: HTML5 Canvas multi-axis rotational physics, 3D dual-color capsules with specular highlights and ambient occlusion shadows, rotating molecular chemical lattices, and mouse parallax tilt.
  - **PWA Support**: Installable web application with manifest and service worker.
- **Backend**: Python 3, FastAPI, Uvicorn, SQLite with **FTS5 full-text indexing**.
- **Regulatory Matching Engine**: Evaluates individual active ingredients, calculates exact FDC matches against CDSCO August 2024 Gazette orders (S.O. 3285(E) through 3471(E)), and extracts Section 26A notifications.
- **Optical Recognition (OCR & Barcode)**: Tesseract OCR multi-filter image preprocessing, OpenCV QR code, and 1D barcode detection.
- **Reporting**: ReportLab PDF generator for clinical verification reports.
- **Pharmacy Locator**: OpenStreetMap Overpass spatial API for authentic Indian pharmacy listings without fake or synthetic data.

---

## 2. Dataset Integration

The platform indexes the five original datasets into `backend/medicheck.db` without altering the source files:

1. `India_Medicine_Master_253973_FULL.csv` — **253,968 commercial pharmaceuticals** indexed with millisecond FTS5 search.
2. `India_Prohibited_FDC_Combinations_CDSCO.csv` — **187 official prohibited FDCs** gazetted under Section 26A.
3. `India_Banned_Drugs_Final.csv` — **681 banned drug components and combinations**.
4. `Ban.ipynb` — Preprocessing and inspection workflows.
5. `medicine_safety_data.pkl` — Reference dataset bundle.

---

## 3. Application Flow

1. **Landing Page**:
   - Realistic 4D floating dual-tone capsules, rotating molecular benzene bonds, and micro-particles.
   - **Only one visible interactive control**: The **Get Started** button.
   - No navbars, sidebar, or dashboard before authentication.
2. **Authentication Page**:
   - Clean centered authentication card with Email, Password, Password Visibility toggle, Sign In, and Create Account options.
   - Return to landing page button.
3. **Dashboard with Left Vertical Sidebar**:
   - Persistent vertical sidebar with brand, Main routes, My Medicines, and an **interactive profile widget in the bottom-left corner** housing the user's name, avatar, **Settings**, **Help & About**, and **Logout**.
   - Personalized welcome, prominent Scan Medicine hero card, live catalog search, recent scan history, and saved medicines.
4. **Scan Medicine**:
   - Image upload, live camera capture, barcode/QR scan, and manual entry.
   - Structured confirmation screen to review and edit extracted ingredients before verification.
5. **Detailed Result Page**:
   - Prominent verdict banner:
     - 🔴 **Prohibited FDC Match** (Section 26A prohibition)
     - 🔴 **Banned in Matching Records**
     - 🟡 **Restricted** / **Unable to Determine**
     - 🟢 **No Ban Found in Our Data** *(Explicitly states that absence of a ban is not a guarantee of safety)*
   - Ingredient-by-ingredient analysis table with strengths and individual findings.
   - Fixed-Dose Combination analysis against CDSCO records.
   - Official Gazette evidence (S.O. number, date, authority, reason, source URL).
   - 8 functional actions: Ask AI, Read Aloud, Save Medicine, Download PDF Report, Share Result, View Official Notification, Scan Another, Search Manually.

---

## 4. Quick Start & Launch Instructions

### Prerequisites
- Python 3.10+
- Node.js v18+ and npm
- Tesseract OCR (Optional for local image OCR; default path `C:\Program Files\Tesseract-OCR\tesseract.exe`)

### 1. Database Initialization
```bash
python backend/indexer.py
```
*Creates `backend/medicheck.db` with SQLite FTS5 indexes for all 253,968 medicines and regulatory records in ~30 seconds.*

### 2. Run Automated Core Tests
```bash
python backend/tests/test_core.py
```

### 3. Start Backend Server
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 4. Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
Open **`http://localhost:5173`** in your browser.

*(Alternatively, the production build in `frontend/dist` is also served directly by FastAPI at **`http://127.0.0.1:8000`**).*
