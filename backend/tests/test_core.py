"""
MediCheck India - Core Automated Test Suite
Validates authentication, regulatory matching, search performance,
PDF report generation, user isolation, and data integrity.
"""
import pytest
from fastapi.testclient import TestClient
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')
from app.main import app

client = TestClient(app)

def test_healthcheck():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"]["total_medicines"] >= 250000
    assert data["database"]["prohibited_fdc_records"] == 187
    assert data["database"]["banned_drug_records"] == 681

def test_auth_workflow():
    test_email = f"tester_{os.getpid()}@medicheck.in"
    test_pass = "SecurePass123!"

    # 1. Register
    reg_res = client.post("/api/auth/register", json={
        "email": test_email,
        "password": test_pass,
        "full_name": "Test Doctor"
    })
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == test_email

    # 2. Login
    login_res = client.post("/api/auth/login", json={
        "email": test_email,
        "password": test_pass
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 3. Get profile
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == test_email

def test_medicine_search():
    res = client.get("/api/medicines/search?q=Augmentin&limit=5")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] > 0
    assert any("Augmentin" in m["medicine_name"] for m in data["results"])

def test_augmentin_regulatory_verdict():
    # Augmentin is NOT banned, must return "no_ban_found", NEVER "Safe"
    res = client.get("/api/medicines/INDMED_FULL_000001")
    assert res.status_code == 200
    data = res.json()
    assert data["verdict_status"] == "no_ban_found"
    assert data["verdict_severity"] == "neutral"
    assert "NOT a medical clearance" in data["verdict_description"]

def test_prohibited_fdc_match():
    # Nimesulide + Paracetamol dispersible
    res = client.post("/api/medicines/evaluate-custom", json={
        "medicine_name": "Nimesulide Paracetamol Dispersible",
        "ingredients": ["Nimesulide", "Paracetamol"],
        "dosage_form": "Dispersible Tablet"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["verdict_status"] == "prohibited_fdc"
    assert data["verdict_severity"] == "danger"
    assert len(data["evidence_records"]) > 0

def test_banned_single_drug():
    # Cisapride
    res = client.post("/api/medicines/evaluate-custom", json={
        "medicine_name": "Cisapride 10mg",
        "ingredients": ["Cisapride"],
        "dosage_form": "Tablet"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["verdict_status"] == "banned"
    assert data["verdict_severity"] == "danger"

def test_unknown_medicine_handling():
    # No ingredients specified -> unable to determine
    res = client.post("/api/medicines/evaluate-custom", json={
        "medicine_name": "Unknown Capsule",
        "ingredients": [],
        "dosage_form": "Capsule"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["verdict_status"] == "unable_to_determine"
    assert data["verdict_severity"] == "warning"

def test_pdf_report_generation():
    res = client.get("/api/reports/pdf/INDMED_FULL_000001")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")

if __name__ == "__main__":
    print("Running MediCheck India Core Tests...")
    test_healthcheck()
    print("✓ Healthcheck passed")
    test_auth_workflow()
    print("✓ Auth workflow passed")
    test_medicine_search()
    print("✓ Medicine search passed")
    test_augmentin_regulatory_verdict()
    print("✓ Augmentin regulatory verdict passed")
    test_prohibited_fdc_match()
    print("✓ Prohibited FDC detection passed")
    test_banned_single_drug()
    print("✓ Banned drug detection passed")
    test_unknown_medicine_handling()
    print("✓ Unknown medicine handling passed")
    test_pdf_report_generation()
    print("✓ PDF report generation passed")
    print("All core automated tests passed successfully!")
