# =============================================================================
# services/pricing_export_service.py
#
# Responsabilidade única: geração do PDF de exportação de uma precificação.
# Orquestra o PricingRepository e o PricingCalculator para montar o documento.
# Sem chamadas diretas a db.table(). Levanta HTTPException quando necessário.
# =============================================================================

from collections import defaultdict
from datetime import date
from decimal import Decimal
from io import BytesIO
from math import ceil

from fastapi import HTTPException

from app.core.pricing_calculator import PricingCalculator, PricingInputs, PricingOutputs
from app.repositories.pricing_repository import PricingRepository

_BLOCO_LABELS: dict[str, str] = {
    "engenharia_dados": "Engenharia de Dados",
    "visualizacao": "Visualizacao",
    "ciencia_dados": "Ciencia de Dados",
    "automacao": "Automacao",
    "integracao": "Integracao",
    "consumo": "Consumo / Interface",
    "negocio": "Negocio",
    "parceria": "Parceria",
    "governanca": "Governanca",
    "infra": "Infraestrutura",
}

_TIPO_LABELS: dict[str, str] = {
    "bi": "Business Intelligence",
    "ml": "Machine Learning",
    "data_engineering": "Engenharia de Dados",
    "automation": "Automacao",
    "integration": "Integracao",
    "science": "Ciencia de Dados",
}


class PricingExportService:
    def __init__(self, repo: PricingRepository) -> None:
        self._repo = repo

    def generate_pdf(self, pricing_id: str) -> tuple[bytes, str]:
        """Generate a PDF for the pricing and return (pdf_bytes, filename)."""
        try:
            from fpdf import FPDF  # noqa: F401
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="fpdf2 nao instalado no servidor. Execute: pip install fpdf2",
            )

        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")

        project = self._repo.get_project_details(str(pricing["project_id"]))
        features = self._repo.get_pricing_features(pricing_id)

        inputs = _build_inputs(pricing)
        outputs = PricingCalculator.calculate(features, inputs)

        pdf_bytes = _render_pdf(project or {}, pricing, features, outputs)

        safe_name = (project or {}).get("name", "precificacao").replace(" ", "_").replace("/", "-")
        filename = f"CITi_{safe_name}_{date.today().isoformat()}.pdf"

        return pdf_bytes, filename


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_inputs(pricing: dict) -> PricingInputs:
    raw_start = pricing.get("start_date")
    if isinstance(raw_start, date):
        start_date = raw_start
    else:
        start_date = date.fromisoformat(str(raw_start))

    return PricingInputs(
        start_date=start_date,
        num_analysts=int(pricing.get("num_analysts") or 1),
        hours_per_day=Decimal(str(pricing.get("hours_per_day") or 0)),
        ticket_price=Decimal(str(pricing.get("ticket_price") or 0)),
        extra_calendar_days=int(pricing.get("extra_calendar_days") or 0),
    )


def _render_pdf(
    project: dict,
    pricing: dict,
    features: list[dict],
    outputs: PricingOutputs,
) -> bytes:
    from fpdf import FPDF

    by_bloco: dict[str, list[dict]] = defaultdict(list)
    for f in features:
        by_bloco[f["bloco"]].append(f)

    # ── cores ────────────────────────────────────────────────────
    C_DARK = (28, 30, 38)
    C_BLUE = (37, 99, 235)
    C_BLUE_LIGHT = (239, 246, 255)
    C_WHITE = (255, 255, 255)
    C_GRAY = (248, 249, 251)
    C_TEXT = (30, 30, 40)
    C_MUTED = (107, 114, 128)

    MARGIN = 20
    W_PAGE = 210  # A4
    CONTENT_W = W_PAGE - 2 * MARGIN

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=25)
    pdf.set_margins(MARGIN, MARGIN, MARGIN)
    pdf.add_page()

    # ── header ───────────────────────────────────────────────────
    pdf.set_fill_color(*C_DARK)
    pdf.rect(0, 0, W_PAGE, 30, "F")

    pdf.set_xy(MARGIN, 8)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*C_WHITE)
    pdf.cell(CONTENT_W * 0.5, 8, "CITi", ln=0)

    pdf.set_x(MARGIN + CONTENT_W * 0.5)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(180, 190, 210)
    pdf.cell(CONTENT_W * 0.5, 8, f"Gerado em {date.today().strftime('%d/%m/%Y')}", align="R")

    pdf.set_xy(MARGIN, 19)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(140, 160, 200)
    pdf.cell(CONTENT_W, 6, "PROPOSTA TECNICA - PRECIFICACAO DE PROJETO")

    # ── titulo do projeto ────────────────────────────────────────
    pdf.set_y(38)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(*C_DARK)
    pdf.cell(0, 10, project.get("name", "Sem nome"), ln=True)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*C_MUTED)
    cliente = project.get("client", "—")
    tipo = _TIPO_LABELS.get(project.get("project_type", ""), project.get("project_type", "—"))
    pdf.cell(CONTENT_W * 0.5, 6, f"Cliente: {cliente}", ln=0)
    pdf.cell(CONTENT_W * 0.5, 6, f"Tipo: {tipo}", ln=True)

    desc = project.get("description", "")
    if desc:
        pdf.ln(2)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(CONTENT_W, 5, desc)

    pdf.ln(8)

    # ── helpers ──────────────────────────────────────────────────
    def section_title(title: str) -> None:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*C_BLUE)
        pdf.cell(CONTENT_W, 5, title, ln=True)
        pdf.set_draw_color(*C_BLUE)
        pdf.set_line_width(0.4)
        pdf.line(MARGIN, pdf.get_y(), MARGIN + CONTENT_W, pdf.get_y())
        pdf.ln(4)
        pdf.set_text_color(*C_TEXT)

    def param_cards(items: list[tuple[str, str]], cols: int = 2) -> None:
        col_w = (CONTENT_W - (cols - 1) * 3) / cols
        for i in range(0, len(items), cols):
            y = pdf.get_y()
            for j, (label, val) in enumerate(items[i : i + cols]):
                x = MARGIN + j * (col_w + 3)
                pdf.set_fill_color(*C_GRAY)
                pdf.rect(x, y, col_w, 12, "F")
                pdf.set_xy(x + 3, y + 1)
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*C_MUTED)
                pdf.cell(col_w - 6, 4, label)
                pdf.set_xy(x + 3, y + 5)
                pdf.set_font("Helvetica", "B", 10)
                pdf.set_text_color(*C_DARK)
                pdf.cell(col_w - 6, 6, val)
            pdf.set_y(y + 14)

    # ── parametros ───────────────────────────────────────────────
    section_title("PARAMETROS")
    param_cards([
        ("Analistas", str(pricing.get("num_analysts", "—"))),
        ("Horas/dia por analista", f"{pricing.get('hours_per_day', '—')}h"),
        ("Ticket mensal", f"R$ {pricing.get('ticket_price', '—')}"),
        ("Data de inicio", str(pricing.get("start_date") or "—")),
        ("Dias extras no calendario", str(pricing.get("extra_calendar_days", 0))),
        ("Status", "Aprovada" if pricing.get("status") == "approved" else "Rascunho"),
    ])

    pdf.ln(10)

    # ── tabela de funcionalidades ────────────────────────────────
    section_title("ESCOPO DE FUNCIONALIDADES")

    COL_H = 30
    COL_F = CONTENT_W - COL_H

    pdf.set_fill_color(*C_DARK)
    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(COL_F, 7, "  Funcionalidade", fill=True, ln=0)
    pdf.cell(COL_H, 7, "Horas", align="R", fill=True, ln=True)

    row_alt = False
    for bloco, items in by_bloco.items():
        bloco_label = _BLOCO_LABELS.get(bloco, bloco.replace("_", " ").title())
        bloco_horas = sum(float(f.get("horas", 0)) for f in items)

        pdf.set_fill_color(*C_BLUE_LIGHT)
        pdf.set_text_color(*C_BLUE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(COL_F, 6, f"  {bloco_label}", fill=True, ln=0)
        pdf.cell(COL_H, 6, f"{bloco_horas:.0f}h", align="R", fill=True, ln=True)

        for f in items:
            bg = C_GRAY if row_alt else C_WHITE
            nome = f.get("funcionalidade", "—")
            horas_val = float(f.get("horas", 0))

            y = pdf.get_y()
            lines = pdf.multi_cell(COL_F, 5, f"  {nome}", split_only=True)
            row_h = max(6, len(lines) * 5 + 2)

            pdf.set_fill_color(*bg)
            pdf.rect(MARGIN, y, COL_F, row_h, "F")
            pdf.rect(MARGIN + COL_F, y, COL_H, row_h, "F")

            pdf.set_text_color(*C_TEXT)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_xy(MARGIN, y)
            pdf.multi_cell(COL_F, 5, f"  {nome}")

            pdf.set_xy(MARGIN + COL_F, y)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*C_DARK)
            pdf.cell(COL_H, row_h, f"{horas_val:.0f}h", align="R")

            pdf.set_xy(MARGIN, y + row_h)
            row_alt = not row_alt

        row_alt = False

    pdf.set_fill_color(*C_DARK)
    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(COL_F, 8, "  TOTAL", fill=True, ln=0)
    pdf.cell(COL_H, 8, f"{float(outputs.total_horas):.0f}h", align="R", fill=True, ln=True)

    pdf.ln(10)

    # ── cronograma ───────────────────────────────────────────────
    section_title("CRONOGRAMA ESTIMADO")
    param_cards([
        ("Total de horas", f"{float(outputs.total_horas):.0f}h"),
        ("Dias uteis", f"{float(outputs.dias_uteis):.1f}"),
        ("Dias corridos", f"{float(outputs.dias_corridos):.1f}"),
        ("Semanas", f"{float(outputs.duracao_semanas):.1f}"),
        ("Sprints (5 dias uteis)", f"{float(outputs.num_sprints):.1f}"),
        ("Data de entrega", outputs.data_final.strftime("%d/%m/%Y") if outputs.data_final else "—"),
    ], cols=3)

    pdf.ln(8)

    # ── destaque do preco ────────────────────────────────────────
    y = pdf.get_y()
    pdf.set_fill_color(*C_BLUE)
    pdf.rect(MARGIN, y, CONTENT_W, 22, "F")

    pdf.set_xy(MARGIN + 6, y + 3)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(180, 210, 255)
    pdf.cell(CONTENT_W * 0.6, 5, "PRECO TOTAL ESTIMADO", ln=0)

    pdf.set_x(MARGIN + CONTENT_W * 0.6)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(180, 210, 255)
    ticket = pricing.get("ticket_price", "—")
    pdf.cell(CONTENT_W * 0.35, 5, f"Ticket: R$ {ticket}/mes", align="R")

    pdf.set_xy(MARGIN + 6, y + 10)
    pdf.set_font("Helvetica", "B", 17)
    pdf.set_text_color(*C_WHITE)
    pdf.cell(CONTENT_W * 0.6, 9, f"R$ {float(outputs.preco_total):,.2f}", ln=0)

    pdf.set_x(MARGIN + CONTENT_W * 0.6)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(200, 220, 255)
    pdf.cell(CONTENT_W * 0.35, 9, f"Duracao: {float(outputs.duracao_meses):.1f} meses", align="R")

    # ── footer ───────────────────────────────────────────────────
    pdf.set_y(-18)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(*C_MUTED)
    pdf.cell(CONTENT_W * 0.7, 5, "CITi - Centro de Informatica e Tecnologia - UFPE", ln=0)
    pdf.cell(CONTENT_W * 0.3, 5, "Documento gerado automaticamente", align="R")

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()
