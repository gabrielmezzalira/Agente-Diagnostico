#!/usr/bin/env python3
"""
mcp_precificador.py

Servidor MCP para Claude Desktop — expõe dados do Precificador CITi.
Lê e escreve direto no Supabase. Não depende do backend FastAPI estar rodando.

──────────────────────────────────────────────────────────────────────
SETUP (uma vez só)
──────────────────────────────────────────────────────────────────────
1. Instale as dependências:
       pip install mcp supabase

2. Adicione ao claude_desktop_config.json
   (~/Library/Application Support/Claude/claude_desktop_config.json):

   {
     "mcpServers": {
       "precificador-citi": {
         "command": "python",
         "args": ["/caminho/absoluto/para/mcp_precificador.py"],
         "env": {
           "SUPABASE_URL": "https://fzvwtkipzxdnubprvfct.supabase.co",
           "SUPABASE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dnd0a2lwenhkbnVicHJ2ZmN0Iiwicm9sZ
  SI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY1Nzk4NiwiZXhwIjoyMDk1MjMzOTg2fQ.y8mijx9rqm93xXs8bqNkEFFtFUhn1CuRCFGu
  wuaVAzA"
         }
       }
     }
   }

3. Reinicie o Claude Desktop.

──────────────────────────────────────────────────────────────────────
TOOLS DISPONÍVEIS
──────────────────────────────────────────────────────────────────────
Leitura:
- listar_projetos()                                       → todos os projetos
- listar_precificacoes(project_id)                        → precificações de um projeto
- obter_contexto_precificacao(pricing_id)                 → contexto completo com IDs

Escrita:
- adicionar_funcionalidade(pricing_id, bloco, funcionalidade, horas)
- remover_funcionalidade(pricing_id, feature_id)
- editar_funcionalidade(pricing_id, feature_id, bloco?, funcionalidade?, horas?)
- reordenar_funcionalidades(pricing_id, feature_ids_in_order)
- atualizar_parametros(pricing_id, num_analysts?, hours_per_day?, ticket_price?, extra_calendar_days?)
- exportar_precificacao(pricing_id, pasta?)   → gera PDF em ~/Downloads (requer: pip install fpdf2)
"""

import os
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from math import ceil

from mcp.server.fastmcp import FastMCP
from supabase import Client, create_client

# ---------------------------------------------------------------------------
# Supabase client — lazy, instanciado na primeira chamada
# ---------------------------------------------------------------------------

_db: Client | None = None


def _get_db() -> Client:
    global _db
    if _db is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_KEY", "")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL e SUPABASE_KEY devem estar definidos nas variáveis de ambiente. "
                "Veja as instruções no topo deste arquivo."
            )
        _db = create_client(url, key)
    return _db


# ---------------------------------------------------------------------------
# Calculadora de resultados (independente do backend)
# ---------------------------------------------------------------------------


def _calculate_outputs(features: list[dict], pricing: dict) -> dict:
    num_analysts = int(pricing.get("num_analysts") or 1)
    hours_per_day = Decimal(str(pricing.get("hours_per_day") or 0))
    ticket_price = Decimal(str(pricing.get("ticket_price") or 0))
    extra_calendar_days = int(pricing.get("extra_calendar_days") or 0)
    start_date_str = pricing.get("start_date")

    daily_capacity = Decimal(str(num_analysts)) * hours_per_day
    total_horas = sum(Decimal(str(f.get("horas", 0))) for f in features)

    dias_uteis = total_horas / daily_capacity if daily_capacity else Decimal(0)
    dias_corridos = dias_uteis * Decimal("1.4") + Decimal(str(extra_calendar_days))
    preco_total = ticket_price * (dias_corridos / Decimal("30")) if dias_corridos else Decimal(0)

    data_final = None
    if start_date_str:
        start = date.fromisoformat(str(start_date_str))
        data_final = (start + timedelta(days=ceil(float(dias_corridos)))).isoformat()

    return {
        "total_horas": float(total_horas),
        "dias_uteis": round(float(dias_uteis), 1),
        "dias_corridos": round(float(dias_corridos), 1),
        "preco_total": round(float(preco_total), 2),
        "duracao_meses": round(float(dias_corridos / Decimal("30")), 2),
        "duracao_semanas": round(float(dias_corridos / Decimal("7")), 1),
        "num_sprints": round(float(dias_uteis / Decimal("5")) if dias_uteis else 0, 1),
        "data_final": data_final,
    }


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------

mcp = FastMCP("Precificador CITi")


@mcp.tool()
def listar_projetos() -> str:
    """Lista todos os projetos cadastrados com nome, cliente, tipo e ID."""
    db = _get_db()
    rows = (
        db.table("projects")
        .select("id, name, client, project_type, created_at")
        .order("created_at", desc=True)
        .execute()
        .data or []
    )
    if not rows:
        return "Nenhum projeto encontrado."

    lines = ["# Projetos CITi\n"]
    for p in rows:
        tipo = p.get("project_type") or "—"
        lines.append(f"- **{p['name']}** | Cliente: {p.get('client', '?')} | Tipo: {tipo} | `{p['id']}`")
    return "\n".join(lines)


@mcp.tool()
def listar_precificacoes(project_id: str) -> str:
    """Lista as precificações de um projeto. Use o ID retornado por listar_projetos."""
    db = _get_db()
    rows = (
        db.table("pricings")
        .select("id, status, start_date, ticket_price, created_at")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .execute()
        .data or []
    )
    if not rows:
        return "Nenhuma precificação encontrada para este projeto."

    lines = [f"# Precificações\n"]
    for p in rows:
        status = "✅ Aprovada" if p["status"] == "approved" else "📝 Rascunho"
        criada = str(p.get("created_at", ""))[:10]
        ticket = p.get("ticket_price", "?")
        lines.append(f"- {status} | Ticket R${ticket}/mês | Criada: {criada} | `{p['id']}`")
    return "\n".join(lines)


@mcp.tool()
def obter_contexto_precificacao(pricing_id: str) -> str:
    """
    Retorna o contexto completo de uma precificação: parâmetros, lista de
    funcionalidades com horas, resultados calculados (preço total, data de
    entrega, sprints) e relatórios de diagnóstico da sessão.

    Use este tool para analisar a precificação, comparar com histórico,
    sugerir ajustes ou preparar uma proposta comercial.
    """
    db = _get_db()

    pricing_rows = db.table("pricings").select("*").eq("id", pricing_id).execute().data
    if not pricing_rows:
        return f"Precificação `{pricing_id}` não encontrada."
    pricing = pricing_rows[0]

    project_rows = (
        db.table("projects")
        .select("name, client, project_type, description, data_maturity_score, pre_meeting_context")
        .eq("id", pricing["project_id"])
        .execute()
        .data
    )
    project = project_rows[0] if project_rows else {}

    features = (
        db.table("pricing_features")
        .select("id, bloco, funcionalidade, horas, citi_responsible, ordem")
        .eq("pricing_id", pricing_id)
        .order("ordem")
        .execute()
        .data or []
    )

    outputs = _calculate_outputs(features, pricing)

    # Relatórios de diagnóstico (últimos 2)
    reports_section = ""
    sessions = (
        db.table("sessions")
        .select("id")
        .eq("project_id", pricing["project_id"])
        .execute()
        .data or []
    )
    if sessions:
        session_ids = [s["id"] for s in sessions]
        reports = (
            db.table("reports")
            .select("markdown_content, generated_at")
            .in_("session_id", session_ids)
            .order("generated_at", desc=True)
            .limit(2)
            .execute()
            .data or []
        )
        if reports:
            combined = "\n\n---\n\n".join(
                r["markdown_content"] for r in reports if r.get("markdown_content")
            )
            reports_section = f"\n\n## Relatórios de Diagnóstico\n\n{combined}"

    # Monta o contexto
    status_label = "Aprovada ✅" if pricing["status"] == "approved" else "Rascunho 📝"
    dms = project.get("data_maturity_score")
    dms_label = f"{dms}/5" if dms else "não definido"

    feature_lines = []
    for f in features:
        resp = " [CITi responsável]" if f.get("citi_responsible") else " [cliente responsável]"
        feature_lines.append(
            f"  - ID: `{f['id']}` | [{f['bloco']}] {f['funcionalidade']} — {f['horas']}h{resp}"
        )
    features_block = "\n".join(feature_lines) if feature_lines else "  Nenhuma funcionalidade cadastrada."

    pre_context = project.get("pre_meeting_context") or ""
    pre_section = f"\n\n## Contexto pré-reunião\n{pre_context}" if pre_context else ""

    return f"""# Precificação — {project.get('name', '?')} ({project.get('client', '?')})

**Status:** {status_label}
**Tipo de projeto:** {project.get('project_type', '?')}
**Maturidade de dados do cliente:** {dms_label}

## Parâmetros

| Campo | Valor |
|-------|-------|
| Data de início | {pricing.get('start_date', '?')} |
| Analistas | {pricing.get('num_analysts', '?')} |
| Horas/dia por analista | {pricing.get('hours_per_day', '?')}h |
| Ticket mensal | R$ {pricing.get('ticket_price', '?')} |
| Dias extras no calendário | {pricing.get('extra_calendar_days', 0)} |

## Funcionalidades ({len(features)} itens)

{features_block}

## Resultados Calculados

| Métrica | Valor |
|---------|-------|
| Total de horas | {outputs['total_horas']}h |
| Dias úteis | {outputs['dias_uteis']} |
| Dias corridos | {outputs['dias_corridos']} |
| Semanas | {outputs['duracao_semanas']} |
| Meses | {outputs['duracao_meses']} |
| Sprints (5 dias úteis) | {outputs['num_sprints']} |
| Data de entrega | {outputs['data_final']} |
| **Preço total** | **R$ {outputs['preco_total']:,.2f}** |
{pre_section}{reports_section}"""


# ---------------------------------------------------------------------------
# Tools de escrita
# ---------------------------------------------------------------------------


@mcp.tool()
def adicionar_funcionalidade(
    pricing_id: str,
    bloco: str,
    funcionalidade: str,
    horas: float,
) -> str:
    """Adiciona uma nova funcionalidade à tabela de precificação.

    bloco deve ser um dos valores: engenharia_dados, visualizacao, ciencia_dados,
    automacao, integracao, consumo, negocio, parceria, governanca, infra.
    Use obter_contexto_precificacao para ver os blocos já existentes.
    """
    db = _get_db()
    existing = (
        db.table("pricing_features")
        .select("ordem")
        .eq("pricing_id", pricing_id)
        .order("ordem", desc=True)
        .limit(1)
        .execute()
        .data or []
    )
    max_ordem = (existing[0]["ordem"] or 0) if existing else 0
    next_ordem = max_ordem + 1
    row = {
        "pricing_id": pricing_id,
        "bloco": bloco,
        "funcionalidade": funcionalidade,
        "horas": str(horas),
        "citi_responsible": True,
        "ordem": next_ordem,
    }
    inserted = db.table("pricing_features").insert(row).execute().data
    if not inserted:
        return "Erro: funcionalidade não foi inserida."
    return (
        f'Funcionalidade "{funcionalidade}" adicionada ao bloco "{bloco}" '
        f"com {horas}h (ID: `{inserted[0]['id']}`, ordem: {next_ordem})."
    )


@mcp.tool()
def remover_funcionalidade(pricing_id: str, feature_id: str) -> str:
    """Remove uma funcionalidade da tabela de precificação pelo ID.

    Use obter_contexto_precificacao para obter os IDs das funcionalidades.
    pricing_id é necessário para validar que a feature pertence a esta precificação.
    """
    db = _get_db()
    rows = (
        db.table("pricing_features")
        .select("id, funcionalidade, bloco")
        .eq("id", feature_id)
        .eq("pricing_id", pricing_id)
        .execute()
        .data or []
    )
    if not rows:
        return f"Funcionalidade `{feature_id}` não encontrada nesta precificação."
    nome = rows[0].get("funcionalidade", feature_id)
    db.table("pricing_features").delete().eq("id", feature_id).execute()
    return f'Funcionalidade "{nome}" removida com sucesso.'


@mcp.tool()
def editar_funcionalidade(
    pricing_id: str,
    feature_id: str,
    bloco: str | None = None,
    funcionalidade: str | None = None,
    horas: float | None = None,
) -> str:
    """Edita bloco, nome ou horas de uma funcionalidade existente.

    Forneça apenas os campos que devem mudar — os demais são mantidos.
    Use obter_contexto_precificacao para obter os IDs das funcionalidades.
    """
    db = _get_db()
    rows = (
        db.table("pricing_features")
        .select("id, funcionalidade")
        .eq("id", feature_id)
        .eq("pricing_id", pricing_id)
        .execute()
        .data or []
    )
    if not rows:
        return f"Funcionalidade `{feature_id}` não encontrada nesta precificação."
    updates: dict = {}
    if bloco is not None:
        updates["bloco"] = bloco
    if funcionalidade is not None:
        updates["funcionalidade"] = funcionalidade
    if horas is not None:
        updates["horas"] = str(horas)
    if not updates:
        return "Nenhum campo fornecido para atualizar."
    db.table("pricing_features").update(updates).eq("id", feature_id).execute()
    campos = ", ".join(updates.keys())
    return f'Funcionalidade "{rows[0]["funcionalidade"]}" atualizada: {campos}.'


@mcp.tool()
def reordenar_funcionalidades(pricing_id: str, feature_ids_in_order: list[str]) -> str:
    """Reordena as funcionalidades da precificação.

    Receba a lista COMPLETA de IDs na nova ordem desejada (primeiro ao último).
    Use obter_contexto_precificacao para ver os IDs atuais.
    """
    db = _get_db()
    updated = 0
    for i, fid in enumerate(feature_ids_in_order):
        result = (
            db.table("pricing_features")
            .update({"ordem": i + 1})
            .eq("id", fid)
            .eq("pricing_id", pricing_id)
            .execute()
            .data or []
        )
        if result:
            updated += 1
    return f"{updated} de {len(feature_ids_in_order)} funcionalidades reordenadas."


@mcp.tool()
def atualizar_parametros(
    pricing_id: str,
    num_analysts: int | None = None,
    hours_per_day: float | None = None,
    ticket_price: float | None = None,
    extra_calendar_days: int | None = None,
) -> str:
    """Atualiza os parâmetros de entrada da precificação.

    Forneça apenas os parâmetros que devem mudar:
    - num_analysts: número de analistas no time
    - hours_per_day: horas de trabalho por analista por dia
    - ticket_price: valor do ticket mensal em reais
    - extra_calendar_days: dias extras no calendário (margem, onboarding etc.)
    """
    db = _get_db()
    updates: dict = {}
    if num_analysts is not None:
        updates["num_analysts"] = num_analysts
    if hours_per_day is not None:
        updates["hours_per_day"] = str(hours_per_day)
    if ticket_price is not None:
        updates["ticket_price"] = str(ticket_price)
    if extra_calendar_days is not None:
        updates["extra_calendar_days"] = extra_calendar_days
    if not updates:
        return "Nenhum parâmetro fornecido para atualizar."
    db.table("pricings").update(updates).eq("id", pricing_id).execute()
    campos = ", ".join(f"{k}={v}" for k, v in updates.items())
    return f"Parâmetros atualizados: {campos}."


@mcp.tool()
def exportar_precificacao(pricing_id: str, pasta: str | None = None) -> str:
    """Gera um PDF da precificacao pronto para enviar ao cliente.

    Inclui parametros, tabela de funcionalidades agrupada por bloco, resumo de
    cronograma e destaque do preco total. Salva em ~/Downloads por padrao.

    pasta: caminho absoluto da pasta onde salvar (opcional).
    Requer: pip install fpdf2
    """
    try:
        from fpdf import FPDF
    except ImportError:
        return "Dependencia nao instalada. Execute: pip install fpdf2"

    db = _get_db()

    pricing_rows = db.table("pricings").select("*").eq("id", pricing_id).execute().data
    if not pricing_rows:
        return f"Precificacao `{pricing_id}` nao encontrada."
    pricing = pricing_rows[0]

    project_rows = (
        db.table("projects")
        .select("name, client, project_type, description")
        .eq("id", pricing["project_id"])
        .execute()
        .data
    )
    project = project_rows[0] if project_rows else {}

    features = (
        db.table("pricing_features")
        .select("bloco, funcionalidade, horas, citi_responsible, ordem")
        .eq("pricing_id", pricing_id)
        .order("ordem")
        .execute()
        .data or []
    )

    outputs = _calculate_outputs(features, pricing)

    by_bloco: dict[str, list] = defaultdict(list)
    for f in features:
        by_bloco[f["bloco"]].append(f)

    BLOCO_LABELS = {
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

    TIPO_LABELS = {
        "bi": "Business Intelligence",
        "ml": "Machine Learning",
        "data_engineering": "Engenharia de Dados",
        "automation": "Automacao",
        "integration": "Integracao",
        "science": "Ciencia de Dados",
    }

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
    tipo = TIPO_LABELS.get(project.get("project_type", ""), project.get("project_type", "—"))
    pdf.cell(CONTENT_W * 0.5, 6, f"Cliente: {cliente}", ln=0)
    pdf.cell(CONTENT_W * 0.5, 6, f"Tipo: {tipo}", ln=True)

    desc = project.get("description", "")
    if desc:
        pdf.ln(2)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(CONTENT_W, 5, desc)

    pdf.ln(8)

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

    COL_H = 30  # largura coluna horas
    COL_F = CONTENT_W - COL_H  # largura coluna funcionalidade

    pdf.set_fill_color(*C_DARK)
    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(COL_F, 7, "  Funcionalidade", fill=True, ln=0)
    pdf.cell(COL_H, 7, "Horas", align="R", fill=True, ln=True)

    row_alt = False
    for bloco, items in by_bloco.items():
        bloco_label = BLOCO_LABELS.get(bloco, bloco.replace("_", " ").title())
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
    pdf.cell(COL_H, 8, f"{outputs['total_horas']:.0f}h", align="R", fill=True, ln=True)

    pdf.ln(10)

    # ── cronograma ───────────────────────────────────────────────
    section_title("CRONOGRAMA ESTIMADO")
    param_cards([
        ("Total de horas", f"{outputs['total_horas']:.0f}h"),
        ("Dias uteis", str(outputs["dias_uteis"])),
        ("Dias corridos", str(outputs["dias_corridos"])),
        ("Semanas", str(outputs["duracao_semanas"])),
        ("Sprints (5 dias uteis)", str(outputs["num_sprints"])),
        ("Data de entrega", outputs.get("data_final") or "—"),
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
    pdf.cell(CONTENT_W * 0.6, 9, f"R$ {outputs['preco_total']:,.2f}", ln=0)

    pdf.set_x(MARGIN + CONTENT_W * 0.6)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(200, 220, 255)
    pdf.cell(CONTENT_W * 0.35, 9, f"Duracao: {outputs['duracao_meses']} meses", align="R")

    # ── footer ───────────────────────────────────────────────────
    pdf.set_y(-18)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(*C_MUTED)
    pdf.cell(CONTENT_W * 0.7, 5, "CITi - Centro de Informatica e Tecnologia - UFPE", ln=0)
    pdf.cell(CONTENT_W * 0.3, 5, "Documento gerado automaticamente", align="R")

    # ── salva ────────────────────────────────────────────────────
    target_dir = pasta or os.path.expanduser("~/Downloads")
    os.makedirs(target_dir, exist_ok=True)
    safe_name = (project.get("name") or "precificacao").replace(" ", "_").replace("/", "-")
    filename = f"CITi_{safe_name}_{date.today().isoformat()}.pdf"
    filepath = os.path.join(target_dir, filename)
    pdf.output(filepath)

    return (
        f"PDF gerado com sucesso!\n"
        f"Arquivo: {filepath}\n"
        f"Funcionalidades: {len(features)} | Total: R$ {outputs['preco_total']:,.2f}"
    )


if __name__ == "__main__":
    mcp.run()
