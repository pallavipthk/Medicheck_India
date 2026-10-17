"""
MediCheck India - PDF Report Generator
Generates structured PDF verification reports using ReportLab.
"""
import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def generate_pdf_report(evaluation: dict) -> bytes:
    """Generate a medical safety verification report in PDF format."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    story = []

    # Custom styles
    teal_color = colors.HexColor("#168C78")
    navy_color = colors.HexColor("#17352F")
    slate_color = colors.HexColor("#667580")
    mint_color = colors.HexColor("#E5F5EF")
    danger_red = colors.HexColor("#DC2626")
    warning_amber = colors.HexColor("#D97706")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=teal_color
    )

    subtitle_style = ParagraphStyle(
        "DocSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=slate_color
    )

    h2_style = ParagraphStyle(
        "Heading2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=navy_color,
        spaceBefore=10,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=navy_color
    )

    # 1. Header
    report_time = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    header_data = [
        [
            Paragraph("<b>MEDICHECK INDIA</b><br/><font size='8' color='#667580'>Pharmaceutical Safety & Regulatory Verification</font>", title_style),
            Paragraph(f"<b>Report Generated:</b> {report_time}<br/><b>Verification System:</b> CDSCO Gazettes & Section 26A Database", subtitle_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[300, 230])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=teal_color, spaceAfter=15))

    # 2. Verdict Banner
    status = evaluation.get("verdict_status", "no_ban_found")
    label = evaluation.get("verdict_label", "No Ban Found")
    desc = evaluation.get("verdict_description", "")

    if status in ["prohibited_fdc", "banned"]:
        bg_col = colors.HexColor("#FEE2E2")
        border_col = danger_red
        txt_col = danger_red
    elif status in ["restricted", "unable_to_determine"]:
        bg_col = colors.HexColor("#FEF3C7")
        border_col = warning_amber
        txt_col = warning_amber
    else:
        bg_col = mint_color
        border_col = teal_color
        txt_col = teal_color

    verdict_text = f"<b>REGULATORY VERDICT: {label.upper()}</b><br/>{desc}"
    verdict_style = ParagraphStyle(
        "Verdict",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=navy_color
    )
    verdict_table = Table([[Paragraph(verdict_text, verdict_style)]], colWidths=[530])
    verdict_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_col),
        ('BOX', (0, 0), (-1, -1), 1.5, border_col),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(verdict_table)
    story.append(Spacer(1, 15))

    # 3. Product Details
    story.append(Paragraph("Product Identification", h2_style))
    prod = evaluation.get("product_details", {})
    prod_data = [
        [
            Paragraph("<b>Medicine Name:</b>", body_style),
            Paragraph(prod.get("medicine_name") or "N/A", body_style),
            Paragraph("<b>Generic Name:</b>", body_style),
            Paragraph(prod.get("generic_name") or "N/A", body_style),
        ],
        [
            Paragraph("<b>Manufacturer:</b>", body_style),
            Paragraph(prod.get("manufacturer") or "N/A", body_style),
            Paragraph("<b>Dosage Form:</b>", body_style),
            Paragraph(prod.get("dosage_form") or "N/A", body_style),
        ],
        [
            Paragraph("<b>Product ID:</b>", body_style),
            Paragraph(prod.get("medicine_id") or "N/A", body_style),
            Paragraph("<b>Strength:</b>", body_style),
            Paragraph(prod.get("strength") or "N/A", body_style),
        ]
    ]
    prod_table = Table(prod_data, colWidths=[100, 165, 100, 165])
    prod_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAF9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E9E5")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(prod_table)
    story.append(Spacer(1, 15))

    # 4. Ingredient-by-Ingredient Analysis
    story.append(Paragraph("Ingredient Analysis & Restrictions", h2_style))
    ings = evaluation.get("ingredient_analysis", [])
    if ings:
        ing_data = [["Active Ingredient", "Strength", "Individual Restriction Status"]]
        for ing in ings:
            ing_data.append([
                ing.get("raw_name", "N/A"),
                ing.get("strength", "Not specified"),
                ing.get("status_text", "No individual prohibition found")
            ])
        ing_table = Table(ing_data, colWidths=[200, 130, 200])
        ing_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), teal_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E9E5")),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(ing_table)
    else:
        story.append(Paragraph("No active ingredients parsed or available for this record.", body_style))
    story.append(Spacer(1, 15))

    # 5. Regulatory Evidence
    evidence = evaluation.get("evidence_records", [])
    if evidence:
        story.append(Paragraph("Regulatory Evidence & Gazette Records", h2_style))
        for ev in evidence:
            ev_text = (
                f"<b>{ev.get('type')}: {ev.get('title')}</b><br/>"
                f"<b>Notification Number:</b> {ev.get('notification_number', 'N/A')} | "
                f"<b>Date:</b> {ev.get('notification_date', 'N/A')}<br/>"
                f"<b>Authority:</b> {ev.get('regulatory_authority', 'N/A')}<br/>"
                f"<b>Reason:</b> {ev.get('reason', 'N/A')}<br/>"
                f"<b>Official Source:</b> {ev.get('source_url', 'N/A')}"
            )
            ev_table = Table([[Paragraph(ev_text, body_style)]], colWidths=[530])
            ev_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#FDBA74")),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(ev_table)
            story.append(Spacer(1, 6))
        story.append(Spacer(1, 10))

    # 6. Legal & Clinical Disclaimer
    story.append(HRFlowable(width="100%", thickness=0.5, color=slate_color, spaceAfter=8))
    disc_text = (
        "<b>DATA COVERAGE & CLINICAL DISCLAIMER:</b> "
        "MediCheck India cross-references datasets from the Central Drugs Standard Control Organisation (CDSCO), "
        "Ministry of Health & Family Welfare Gazette orders under Section 26A of the Drugs & Cosmetics Act 1940, and official medicine catalogs. "
        "A finding of 'No Ban Found in Our Data' indicates absence of recorded prohibitions in the evaluated datasets and must NEVER be construed "
        "as clinical approval, efficacy endorsement, or an absolute guarantee of safety. Always consult a qualified medical doctor or registered pharmacist."
    )
    story.append(Paragraph(disc_text, subtitle_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
