"""
MediCheck India - AI Medicine Assistant
Provides plain-language regulatory explanations, pharmacological evidence summaries,
and optional LLM integrations (Google Gemini / OpenAI) with honest configuration fallback.
"""
import os
import requests
from typing import Dict, Any, Optional
from app.config import GEMINI_API_KEY, OPENAI_API_KEY

SYSTEM_PROMPT = """You are MediCheck India's Medical Intelligence Assistant.
Your mission is to explain medicine regulatory status, CDSCO Gazette notifications, and pharmaceutical evidence in clear, calm, accessible terms.
CRITICAL MEDICAL SAFETY RULES:
1. Never invent or hallucinate regulatory records or clinical facts.
2. Never tell the user to start or stop prescription medications; always direct them to consult their prescribing physician or licensed pharmacist.
3. If an FDC is prohibited under Section 26A, clearly explain the regulatory reason (e.g. lack of therapeutic justification, safety risks) cited by the Ministry of Health and Family Welfare.
4. If no ban is found, clarify that absence of a ban is not a clinical guarantee of safety or suitability.
"""

def generate_local_explanation(medicine_name: str, evaluation: Dict[str, Any], query: str = "") -> str:
    """
    High-quality, local, evidence-based explanation synthesized directly from verified database records.
    Runs completely offline with zero external API dependencies.
    """
    verdict = evaluation.get("verdict_label", "Unknown")
    status = evaluation.get("verdict_status", "")
    prod = evaluation.get("product_details", {})
    ings = evaluation.get("ingredient_analysis", [])
    evidence = evaluation.get("evidence_records", [])

    ing_names = [i.get("raw_name") for i in ings if i.get("raw_name")]
    ing_str = ", ".join(ing_names) if ing_names else (prod.get("generic_name") or "Unspecified active ingredients")

    paragraphs = []

    # 1. Overview
    paragraphs.append(
        f"**Medicine Summary for {prod.get('medicine_name', medicine_name)}**\n"
        f"• **Active Formulation:** {ing_str}\n"
        f"• **Manufacturer:** {prod.get('manufacturer', 'Not listed')}\n"
        f"• **Dosage Form:** {prod.get('dosage_form', 'N/A')} (Strength: {prod.get('strength', 'N/A')})\n"
        f"• **Official Regulatory Status:** **{verdict}**"
    )

    # 2. Detailed Regulatory Finding
    if status == "prohibited_fdc":
        paragraphs.append(
            "⚠️ **Prohibited Fixed-Dose Combination (Section 26A CDSCO Order):**\n"
            "The combination of active ingredients in this formulation has been prohibited by the Central Government "
            "(Ministry of Health & Family Welfare / CDSCO) under Section 26A of the Drugs and Cosmetics Act 1940. "
            "Such orders are issued following expert committee reviews (e.g. Kokate Committee) when a combination is found to have "
            "no therapeutic justification or presents safety risks compared to single-agent treatments."
        )
        if evidence:
            ev_list = []
            for ev in evidence:
                ev_list.append(
                    f"  - **Notification:** {ev.get('notification_number', 'N/A')} ({ev.get('notification_date', 'N/A')})\n"
                    f"    **Authority:** {ev.get('regulatory_authority', 'CDSCO')}\n"
                    f"    **Reason:** {ev.get('reason', 'Therapeutic irrationality or human risk.')}"
                )
            paragraphs.append("• **Official Gazette References:**\n" + "\n".join(ev_list))

    elif status == "banned":
        paragraphs.append(
            "⛔ **Banned Component Detected:**\n"
            "One or more ingredients in this medicine is listed under banned drug notifications in India. "
            "Manufacture, distribution, or sale of these components has been restricted or prohibited."
        )
        if evidence:
            ev_list = []
            for ev in evidence:
                ev_list.append(
                    f"  - **Component:** {ev.get('title')}\n"
                    f"    **Order:** {ev.get('notification_number', 'N/A')} | **Reason:** {ev.get('reason', 'N/A')}"
                )
            paragraphs.append("\n".join(ev_list))

    elif status == "restricted":
        paragraphs.append(
            "⚠️ **Restricted / Historical Schedule Notice:**\n"
            "This formulation appears in historical regulatory gazettes or special restriction lists. "
            "Specific guidelines, packaging warnings, or limited clinical indications may apply."
        )

    elif status == "unable_to_determine":
        paragraphs.append(
            "❓ **Inconclusive Formulation Data:**\n"
            "The specific active ingredients or quantities for this product could not be verified against the catalog. "
            "Please inspect the physical packaging or blister pack and enter the ingredient names manually."
        )

    else:
        paragraphs.append(
            "📋 **Verified Database Match (No Ban Found):**\n"
            "We cross-referenced the active ingredients against the latest CDSCO Gazette notifications, including the August 2024 "
            "Section 26A prohibited combination lists. No matching prohibition was identified for this formulation in our data.\n\n"
            "**Important Advisory:** The absence of a prohibition order confirms that the drug is not banned in our database, "
            "but it does NOT constitute clinical approval or a personal safety recommendation. All pharmaceutical drugs must be used "
            "strictly under the guidance of a registered medical practitioner."
        )

    # 3. Patient Advisory
    paragraphs.append(
        "⚕️ **Next Steps & Safe Practices:**\n"
        "• If this medicine was prescribed by your doctor, discuss any questions directly with them or a qualified pharmacist.\n"
        "• Always check the expiry date, hologram, and packaging integrity before consumption.\n"
        "• Report adverse reactions to the Pharmacovigilance Programme of India (PvPI)."
    )

    return "\n\n".join(paragraphs)

def query_gemini_api(prompt: str, context: str) -> Optional[str]:
    """Query Google Gemini API if GEMINI_API_KEY is configured."""
    if not GEMINI_API_KEY:
        return None
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{SYSTEM_PROMPT}\n\nEvidence Context:\n{context}\n\nUser Question:\n{prompt}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 800
            }
        }
        resp = requests.post(url, json=payload, timeout=12)
        if resp.status_code == 200:
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print("Gemini API call failed:", e)
    return None

def query_ai_assistant(query: str, medicine_name: Optional[str] = None, evaluation: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Main assistant handler. Uses external LLM if configured; otherwise provides honest
    local evidence-based synthesis.
    """
    has_external_llm = bool(GEMINI_API_KEY or OPENAI_API_KEY)
    llm_provider = "Gemini" if GEMINI_API_KEY else ("OpenAI" if OPENAI_API_KEY else "None")

    if evaluation:
        context_str = f"Medicine: {medicine_name}\nVerdict: {evaluation.get('verdict_label')}\nDetails: {evaluation.get('verdict_description')}\nIngredients: {evaluation.get('ingredient_analysis')}\nEvidence: {evaluation.get('evidence_records')}"
    else:
        context_str = f"Medicine: {medicine_name or 'General Medicine Query'}"

    # Try external LLM first if configured
    if has_external_llm and GEMINI_API_KEY:
        llm_response = query_gemini_api(query, context_str)
        if llm_response:
            return {
                "response": llm_response,
                "source": "external_llm",
                "provider": llm_provider,
                "is_configured": True
            }

    # Fallback to local evidence-based generation
    if evaluation:
        local_text = generate_local_explanation(medicine_name or "Selected Medicine", evaluation, query)
    else:
        local_text = (
            f"**MediCheck India Information Assistant**\n\n"
            f"Regarding your query on '{query}':\n"
            f"MediCheck India monitors regulatory notifications from the Central Drugs Standard Control Organisation (CDSCO), "
            f"including Section 26A Gazette notifications on Fixed-Dose Combinations and banned pharmaceuticals.\n\n"
            f"To get a detailed evidence report, please search for the specific medicine brand (e.g. Augmentin, Ascoril) "
            f"or active ingredient in the Medicine Search or Scanner tab."
        )

    return {
        "response": local_text,
        "source": "local_evidence_engine",
        "provider": "Local Regulatory Matcher",
        "is_configured": has_external_llm,
        "configuration_notice": None if has_external_llm else (
            "External AI LLM is not configured. The assistant is operating using the local CDSCO verified regulatory engine. "
            "To enable conversational generative AI, add GEMINI_API_KEY or OPENAI_API_KEY in Settings or your .env file."
        )
    }
