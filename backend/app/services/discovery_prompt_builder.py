"""
DiscoveryPromptBuilder — gera system prompts personalizados por agente para
sessoes em modo discovery.

Fase 2 (Discovery Mode + DiscoveryPromptBuilder) / D-09: classe IRMA de
`PromptBuilder` (backend/app/services/prompt_builder.py) — nao subclasse, sem
ABC, sem flag interno. Os dois builders implementam o mesmo contrato informal
(build_coverage_classifier / build_red_flag_detector / build_question_planner /
build_report_generator / build_all) via duck typing; a selecao entre os dois
acontece no ponto de montagem (pipeline.py), nunca aqui.

Import critico para SC#3 (DISC-03): este modulo NUNCA importa CITI_PORTFOLIO,
CITI_SERVICE_CATALOG nem CITI_TECH_REFERENCE de prompt_builder.py. Essa
ausencia de import e, por construcao, o que garante que os 3 agentes de tempo
real (coverage_classifier, red_flag_detector, question_planner) nunca
carregam o portfolio comercial da CITi. Reaproveita apenas os dicts de
calibracao por DMS (DMS_LABEL/DMS_DESCRIPTION) de prompt_builder.py — importar
esses dois dicts nao arrasta os textos CITi, que vivem em constantes
separadas no mesmo modulo.

D-08: o discovery ignora `AREAS_BY_PROJECT_TYPE`/`_area_hint` — as 18 areas de
DISCOVERY_AREA_SET ficam sempre ativas, sem calibracao por project_type.

D-10 (framing, discricionario/reversivel): os prompts de discovery enquadram
o agente como um facilitador de discovery — mapeia o gargalo, a frente de
atuacao, o impacto no usuario, o fluxo de processos e de dados, e o
desenho/expectativa/viabilidade da solucao — mantendo a calibracao por DMS e
removendo qualquer referencia ao portfolio comercial da CITi.
"""

from app.services.coverage_areas import DISCOVERY_AREA_SET
from app.services.prompt_builder import DMS_DESCRIPTION, DMS_LABEL


class DiscoveryPromptBuilder:
    def __init__(
        self,
        dms: "int | None",
        pre_meeting_context: str = "",
        structured_context: "object | None" = None,
    ):
        self.dms = max(1, min(5, dms)) if dms is not None else None
        self.context = pre_meeting_context or "não fornecido"
        self.dms_label = DMS_LABEL[self.dms] if self.dms is not None else "Não mapeado"
        self.dms_desc = (
            DMS_DESCRIPTION[self.dms]
            if self.dms is not None
            else "maturidade de dados ainda não avaliada para este cliente"
        )
        # StructuredContext | None — duck typing, sem import em runtime (mesmo
        # padrao de PromptBuilder, prompt_builder.py:237).
        self.sc = structured_context if (structured_context and not structured_context.is_empty()) else None

    # -------------------------------------------------------------------------
    # Helper de DMS — duplicado de PromptBuilder._dms_str por decisao
    # discricionaria de D-09 (composicao/duplicacao e livre; D-09 so exige
    # classe separada, nao herdar de PromptBuilder).
    # -------------------------------------------------------------------------

    def _dms_str(self) -> str:
        if self.dms is None:
            return f"Não mapeado ({self.dms_label}): {self.dms_desc}"
        return f"{self.dms}/5 ({self.dms_label}): {self.dms_desc}"

    # -------------------------------------------------------------------------
    # CoverageClassifier
    # -------------------------------------------------------------------------

    def build_coverage_classifier(self) -> str:
        stack_hint = self.sc.to_stack_hint() if self.sc else ""
        stack_block = f"{stack_hint}\n\n" if stack_hint else ""

        return (
            "Você é um CoverageClassifier atuando como facilitador de discovery — "
            "mapeia o gargalo do cliente, a frente de atuação, o impacto no usuário, "
            "o fluxo de processos e de dados, e o desenho/expectativa/viabilidade da "
            "solução (produto + dados).\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião: {self.context}\n\n"
            f"{stack_block}"
            "Analise a transcrição e classifique a cobertura de cada área. Todas as "
            "18 áreas (Produto + Dados) ficam sempre ativas nesta sessão — não há "
            "áreas não aplicáveis.\n"
            "REGRAS ESTRITAS DE PONTUAÇÃO — siga à risca:\n"
            "- score 0 + 'uncovered': área NÃO foi mencionada na transcrição.\n"
            "- score 1–40 + 'partial': área foi tocada superficialmente (1–2 menções rápidas).\n"
            "- score 41–79 + 'partial': área foi discutida mas ainda há gaps importantes.\n"
            "- score 80–100 + 'covered': área foi discutida em profundidade, aspectos "
            "principais confirmados com detalhes concretos.\n"
            "Se a transcrição for curta (< 200 palavras), a MAIORIA das áreas DEVE ser "
            "'uncovered' com score 0. NUNCA extrapole.\n\n"
            "Retorne APENAS JSON válido (sem markdown fences):\n"
            + DISCOVERY_AREA_SET.schema_json(include_not_applicable=False)
        )

    # -------------------------------------------------------------------------
    # RedFlagDetector
    # -------------------------------------------------------------------------

    def build_red_flag_detector(self) -> str:
        if self.dms is None:
            calibration = (
                "SENSIBILIDADE para DMS não mapeado: avalie riscos com base apenas no "
                "que a transcrição revelar sobre o gargalo, o fluxo de processos e a "
                "viabilidade da solução proposta."
            )
        elif self.dms <= 2:
            calibration = (
                "SENSIBILIDADE CALIBRADA para DMS baixo:\n"
                "✅ EMITA alerta se: a solução esperada pelo cliente exige dados ou "
                "processos que claramente não existem hoje, não há ponto focal "
                "definido, ou o gargalo relatado não bate com o que a solução proposta "
                "resolveria.\n"
                "🚫 NÃO emita alerta para: ausência de DW, processos manuais, dados em "
                "planilhas — isso é normal e esperado para DMS 1-2."
            )
        elif self.dms == 3:
            calibration = (
                "SENSIBILIDADE CALIBRADA para DMS médio:\n"
                "✅ EMITA alerta se: o fluxo de dados mapeado tem gaps de qualidade "
                "relevantes para a solução desejada, ou a viabilidade da solução "
                "esperada pelo cliente diverge do que a infraestrutura atual suporta.\n"
                "🚫 NÃO emita alerta para: processos ainda não totalmente automatizados."
            )
        else:
            calibration = (
                "SENSIBILIDADE CALIBRADA para DMS alto:\n"
                "✅ EMITA alerta se: o fluxo de dados carece de governança/observabilidade "
                "para a solução esperada, ou a expectativa de solução do cliente ignora "
                "riscos técnicos evidentes no que já foi mapeado.\n"
                "Para um cliente DMS 4-5, gaps de governança SÃO riscos reais."
            )

        flag_hint = self.sc.to_flag_hint() if self.sc else ""
        flag_block = f"{flag_hint}\n\n" if flag_hint else ""

        return (
            "Você é um RedFlagDetector atuando como facilitador de discovery — foca em "
            "riscos que impedem o mapeamento completo do gargalo, do fluxo de "
            "processos/dados e da viabilidade da solução.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião: {self.context}\n\n"
            f"{flag_block}"
            f"{calibration}\n\n"
            "Identifique até 2 riscos críticos na transcrição. Se não houver riscos "
            "reais, retorne lista vazia.\n"
            "Retorne APENAS JSON válido:\n"
            '{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"trecho exato da transcrição"}]}'
        )

    # -------------------------------------------------------------------------
    # QuestionPlanner
    # -------------------------------------------------------------------------

    def build_question_planner(self) -> str:
        if self.dms is None:
            vocab_hint = (
                "DMS NÃO MAPEADO: adapte o vocabulário ao que a conversa revelar. "
                "Comece com perguntas de nível médio."
            )
        elif self.dms <= 2:
            vocab_hint = (
                "VOCABULÁRIO: use linguagem simples e prática. Perguntas acessíveis: "
                "'Onde esse gargalo aparece hoje?', 'Quem sente esse impacto?', "
                "'Como os dados chegam hoje até vocês?'."
            )
        elif self.dms == 3:
            vocab_hint = (
                "VOCABULÁRIO: use nível intermediário. Pode mencionar fluxo de dados, "
                "processo, qualidade dos dados, métricas."
            )
        else:
            vocab_hint = (
                "VOCABULÁRIO: pode usar vocabulário técnico completo — observabilidade, "
                "governança, pipeline, qualidade de dados, arquitetura de solução."
            )

        question_hint = self.sc.to_question_hint() if self.sc else ""
        question_block = f"{question_hint}\n\n" if question_hint else ""

        return (
            "Você é um QuestionPlanner atuando como facilitador de discovery — as "
            "perguntas mapeiam o gargalo, a frente de atuação, o impacto no usuário, "
            "o fluxo de processos e de dados, e o desenho/expectativa/viabilidade da "
            "solução.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião (o que já se sabe antes da conversa): {self.context}\n\n"
            f"{question_block}"
            f"{vocab_hint}\n\n"
            "Sua tarefa: gerar exatamente 3 perguntas em português para o facilitador "
            "fazer ao cliente.\n\n"
            "ESTILO OBRIGATÓRIO — curtas, diretas, interrogativas:\n"
            "✅ BOM: 'Qual o principal gargalo hoje?', 'Quem sente esse impacto?', "
            "'Como os dados fluem entre os sistemas?'\n"
            "❌ RUIM: 'Poderia nos contar mais sobre como o processo funciona hoje?'\n"
            "Máximo 10 palavras por pergunta. Sem introduções, sem contexto embutido — "
            "só a pergunta.\n\n"
            "PRIORIDADE:\n"
            "1. Analise a transcrição — identifique o que já foi dito e o que está "
            "sendo discutido agora.\n"
            "2. Olhe a cobertura — priorize áreas ainda descobertas ou com score baixo.\n"
            "3. Não repita perguntas recentes.\n\n"
            "Retorne APENAS JSON válido:\n"
            '{"questions":[{"text":"...","block":"' + DISCOVERY_AREA_SET.block_enum() + '"}]}'
        )

    # -------------------------------------------------------------------------
    # ReportGenerator
    # -------------------------------------------------------------------------

    def build_report_generator(self) -> str:
        return (
            "Você é um facilitador de discovery sênior da CITi gerando um documento "
            "de discovery em português brasileiro — mapeando o gargalo, a frente de "
            "atuação, o impacto no usuário, o fluxo de processos e de dados, e o "
            "desenho/expectativa/viabilidade da solução proposta.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n\n"
            "Escreva em Markdown claro e profissional. Seja específico, direto e "
            "orientado a ações. Sem texto de preenchimento. Quando houver expectativa "
            "irreal ou risco relevante para a solução, diga claramente.\n\n"
            "Estruture o relatório com estas seções na ordem exata:\n"
            "## Cobertura por Área\n"
            "  Tabela: Área | Status | Score | Observações\n"
            "  OBRIGATÓRIO: inclua TODAS as 18 áreas na tabela, mesmo com score 0 e "
            "status uncovered.\n"
            "## Gargalo e Frente de Atuação\n"
            "  - O gargalo mapeado e a frente de atuação em foco (máximo 3 bullets)\n"
            "## Fluxo de Processos e Dados\n"
            "  - Resumo do fluxo mapeado, das fontes e da qualidade dos dados\n"
            "## Desenho da Solução\n"
            "  - Desenho, expectativa e viabilidade da solução discutida\n"
            "## Riscos e Alertas\n"
            "  - 🚨 ALERTA CRÍTICO: riscos que podem inviabilizar a solução\n"
            "  - ⚠️ RED FLAG: pontos de atenção que precisam ser endereçados\n"
            "## Perguntas Ainda Sem Resposta\n"
            "  - Liste o que ficou sem resposta e precisa ser esclarecido antes de avançar\n"
        )

    # -------------------------------------------------------------------------
    # Build all at once
    # -------------------------------------------------------------------------

    def build_all(self) -> dict[str, str]:
        return {
            "coverage_classifier": self.build_coverage_classifier(),
            "red_flag_detector": self.build_red_flag_detector(),
            "question_planner": self.build_question_planner(),
            "report_generator": self.build_report_generator(),
        }
