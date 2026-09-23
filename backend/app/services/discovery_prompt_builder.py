"""
DiscoveryPromptBuilder — gera system prompts personalizados por agente para
sessoes em modo discovery.

Fase 2 (Discovery Mode + DiscoveryPromptBuilder) / D-09: classe IRMA de
`PromptBuilder` (backend/app/services/prompt_builder.py) — nao subclasse, sem
ABC, sem flag interno. Os dois builders implementam o mesmo contrato informal
(build_coverage_classifier / build_red_flag_detector / build_question_planner /
build_report_generator / build_all) via duck typing; a selecao entre os dois
acontece no ponto de montagem (pipeline.py), nunca aqui.

Import critico para SC#3 (DISC-03): este modulo NUNCA importa os tres
simbolos comerciais do portfolio/catalogo/referencia tecnica de
prompt_builder.py (ver DISC-03 em REQUIREMENTS.md para os nomes exatos). Essa
ausencia de import e, por construcao, o que garante que os 3 agentes de tempo
real (coverage_classifier, red_flag_detector, question_planner) nunca
carregam o portfolio comercial da CITi. Reaproveita apenas os dicts de
calibracao por DMS (DMS_LABEL/DMS_DESCRIPTION) de prompt_builder.py — importar
esses dois dicts nao arrasta os textos comerciais, que vivem em constantes
separadas no mesmo modulo.

D-08: o discovery ignora `AREAS_BY_PROJECT_TYPE`/`_area_hint` — as 18 areas de
DISCOVERY_AREA_SET ficam sempre ativas, sem calibracao por project_type.

D-10 (framing, discricionario/reversivel): os prompts de discovery enquadram
o agente como um facilitador de discovery — mapeia o gargalo, a frente de
atuacao, o impacto no usuario, o fluxo de processos e de dados, e o
desenho/expectativa/viabilidade da solucao — mantendo a calibracao por DMS e
removendo qualquer referencia ao portfolio comercial da CITi.

Fase 3 (Two-Agent Questions + Lens Tagging) / D-19, D-21, D-23:
build_question_planner ganha o parametro `lens` ("produto" | "dados") e
escopa o enum de block ao subconjunto de areas daquela lente
(DISCOVERY_AREA_SET.by_lens(lens)). build_all() passa a devolver duas
chaves de planner (question_planner_produto / question_planner_dados) em
vez de uma unica question_planner — a lente e sempre autoritaria do laco do
orquestrador que consome o prompt, nunca derivada do campo `block` que o
LLM devolve (D-21).
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
            return f"Não mapeado: {self.dms_desc}"
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
            "Para cada risco, classifique também a lente ('lens'): 'produto' para "
            "riscos de gargalo, processo ou viabilidade da solução; 'dados' para "
            "riscos de fontes, qualidade, LGPD/segurança ou métricas dos dados.\n"
            "Retorne APENAS JSON válido:\n"
            '{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"trecho exato da transcrição","lens":"produto|dados"}]}'
        )

    # -------------------------------------------------------------------------
    # QuestionPlanner
    # -------------------------------------------------------------------------

    def build_question_planner(self, lens: str) -> str:
        scoped = DISCOVERY_AREA_SET.by_lens(lens)

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

        # Fase 3 / D-20, D-21: enquadramento e quantidade variam por lente —
        # Produto (primária, roda em todo gatilho) pede 3; Dados (auxiliar,
        # roda em gatilho par) pede 2. Texto de enquadramento discricionário
        # (analogo a D-10), a validar pelo time.
        if lens == "produto":
            framing = (
                "Você é o QuestionPlanner de PRODUTO (lente primária) atuando como "
                "facilitador de discovery — suas perguntas mapeiam o gargalo, a "
                "frente de atuação, o impacto no usuário, o mapeamento de processos "
                "e a viabilidade de entrega da solução. Você roda em TODO ciclo de "
                "geração desta sessão."
            )
            n_questions = 3
        else:  # lens == "dados"
            framing = (
                "Você é o QuestionPlanner de DADOS (lente auxiliar) atuando como "
                "facilitador de discovery — suas perguntas mapeiam as fontes e a "
                "qualidade dos dados, as métricas relevantes, riscos de "
                "LGPD/segurança, a abordagem técnica da solução e possíveis quick "
                "wins. Você roda com menor frequência que o QuestionPlanner de "
                "Produto — aproveite cada ciclo para aprofundar o que ainda não foi "
                "perguntado."
            )
            n_questions = 2

        return (
            f"{framing}\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião (o que já se sabe antes da conversa): {self.context}\n\n"
            f"{question_block}"
            f"{vocab_hint}\n\n"
            f"Sua tarefa: gerar exatamente {n_questions} perguntas em português para o "
            "facilitador fazer ao cliente.\n\n"
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
            '{"questions":[{"text":"...","block":"' + scoped.block_enum() + '"}]}'
        )

    # -------------------------------------------------------------------------
    # ReportGenerator
    # -------------------------------------------------------------------------

    # Fase 4 (Discovery Report + Pricing Handoff) / D-26: marcador exato de
    # subseção sem insumo — discricionário (D-26), mas precisa ser consistente
    # e informado ao LLM (ver `<behavior>` do plano 04-02). Constante de
    # módulo para o teste poder importar/comparar sem duplicar o literal.
    EMPTY_SECTION_MARKER = "[a preencher no PRD]"

    def build_report_generator(self) -> str:
        # D-25/D-26: esqueleto do PRD padrão da CITi (16 seções, 0-15),
        # extraído de PRD_modelo_em_branco_CITi.pdf (ver 04-RESEARCH.md,
        # "PRD Skeleton"). Preenche SOMENTE o que as tabelas/listas do 'user'
        # message trouxerem (pré-montagem híbrida código+LLM, D-27, feita em
        # llm.py::generate_report) — nunca inventa personas, protótipos,
        # matriz É/Não É ou CSD formal que o pipeline não captura.
        #
        # Mapa de lens por seção (D-27): Produto -> 1-6, 10, 11; Dados -> 7 +
        # partes de 8 (LGPD/observabilidade) e 9 (arquitetura/integrações).
        # Sinais nativos de precificação (D-29, SEM seção nomeada): 6.3
        # (backlog+estimativas), 7.3 (volumetria), 11 (faseamento).
        return (
            "Você é um facilitador de discovery sênior da CITi gerando o PRD padrão "
            "da subárea de Produto (esqueleto de 16 seções, 0-15) em português "
            "brasileiro, a partir de uma reunião de discovery.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n\n"
            "Escreva em Markdown claro e profissional. Seja específico, direto e "
            "orientado a ações. Sem texto de preenchimento. Quando houver expectativa "
            "irreal ou risco relevante para a solução, diga claramente.\n\n"
            "REGRA CRÍTICA DE PREENCHIMENTO (D-26): preencha CADA seção/subseção "
            "APENAS com o que vier nas tabelas e listas do 'user' message (cobertura "
            "por lens, red flags por lens, perguntas por lens, transcrição, contexto "
            "estruturado). NUNCA invente personas, protótipos, matriz É/Não É ou "
            f"matriz CSD que não estejam nos insumos. Se uma subseção não tiver "
            f"nenhum insumo, escreva literalmente o marcador '{self.EMPTY_SECTION_MARKER}' "
            "nela — isso é ESPERADO e CORRETO para várias subseções (seções 4, 5, 10 "
            "e partes de 2.4/12.4 tendem a ficar assim; discovery não produz personas, "
            "protótipos nem CSD formal).\n\n"
            "Estruture o relatório com estas 16 seções, NESTA ORDEM EXATA, usando os "
            "títulos e subtítulos abaixo (numeração incluída):\n\n"
            "## 0. Controle do documento\n"
            f"  0.1 Histórico de versões — {self.EMPTY_SECTION_MARKER}\n"
            f"  0.2 Aprovações (sign-off) — {self.EMPTY_SECTION_MARKER}\n"
            f"  0.3 Referências — {self.EMPTY_SECTION_MARKER}\n"
            "## 1. Sumário executivo\n"
            "  Problema / Solução proposta / Valor esperado / Escopo do MVP em uma "
            "frase — derive do gargalo, frente de atuação e desenho de solução "
            "mapeados (lens Produto).\n"
            "## 2. Contexto & problema\n"
            "  2.1 Contexto de negócio\n"
            "  2.2 Problema central (o gargalo mapeado)\n"
            "  2.3 Situação atual (AS-IS) e dores\n"
            f"  2.4 Insights-chave do discovery (CSD) — {self.EMPTY_SECTION_MARKER} "
            "se não houver matriz CSD formal nos insumos.\n"
            "## 3. Objetivos & métricas de sucesso\n"
            "  3.1 Objetivos de negócio\n"
            "  3.2 Métrica North Star\n"
            "  3.3 KPIs e metas\n"
            "## 4. Público & jornadas\n"
            f"  4.1 Personas — {self.EMPTY_SECTION_MARKER}\n"
            "  4.2 Perfis de acesso (papéis)\n"
            f"  4.3 Jornada TO-BE (fluxo desejado) — {self.EMPTY_SECTION_MARKER} salvo "
            "se o desenho de solução mapeado descrever o fluxo desejado.\n"
            "## 5. Escopo (É / Não É)\n"
            f"  5.1 No escopo (É) — {self.EMPTY_SECTION_MARKER}\n"
            f"  5.2 Fora do escopo (Não É) — {self.EMPTY_SECTION_MARKER}\n"
            "  5.3 Escopo futuro (backlog / próximos ciclos)\n"
            "  5.4 Premissas de escopo\n"
            "## 6. Requisitos funcionais & user stories\n"
            "  6.1 Visão de épicos\n"
            "  6.2 Detalhamento dos requisitos\n"
            "  6.3 Backlog consolidado de user stories (tabela: ID | Épico | User "
            "story | Prio. | Est. | Depende de) — SINAL NATIVO DE PRECIFICAÇÃO "
            "(D-29): preencha com o que for extraível do fluxo/solução mapeados; "
            "estimativas grosseiras são aceitáveis, marcadas como tal.\n"
            "  6.4 Catálogo de regras de negócio\n"
            "## 7. Requisitos de dados\n"
            "  Use as duas tabelas de cobertura por lens fornecidas no 'user' "
            "message (Produto e Dados) — copie a tabela Dados SEM alterar.\n"
            "  7.1 Entidades principais (modelo conceitual)\n"
            "  7.2 Fontes e integrações de dados\n"
            "  7.3 Volumetria e crescimento (volume inicial / crescimento / "
            "retenção) — SINAL NATIVO DE PRECIFICAÇÃO (D-29).\n"
            "  7.4 Qualidade de dados\n"
            "  7.5 Dados pessoais & LGPD — NUNCA omitir esta subseção mesmo vazia; "
            f"use '{self.EMPTY_SECTION_MARKER}' se não houver insumo de LGPD.\n"
            "  7.6 Analytics & BI\n"
            "  7.7 Migração de dados\n"
            "## 8. Requisitos não-funcionais\n"
            "  Tabela: Performance | Disponibilidade/SLA | Escalabilidade | "
            "Segurança | Usabilidade/Acessibilidade | Compatibilidade | "
            "Compliance/LGPD | Observabilidade | Backup & recuperação — preencha "
            "as colunas de LGPD/observabilidade com o que vier da lente Dados.\n"
            "## 9. Arquitetura, integrações & restrições técnicas\n"
            "  9.1 Sistemas e integrações externas\n"
            "  9.2 Restrições técnicas conhecidas\n"
            "  9.3 Ambientes\n"
            f"  9.4 Diagrama de contexto — {self.EMPTY_SECTION_MARKER} (não gere "
            "diagramas ASCII especulativos)\n"
            "## 10. Design & protótipos\n"
            f"  10.1 Protótipos — {self.EMPTY_SECTION_MARKER}\n"
            f"  10.2 Design system / identidade — {self.EMPTY_SECTION_MARKER}\n"
            f"  10.3 Telas principais e mapeamento com requisitos — {self.EMPTY_SECTION_MARKER}\n"
            "## 11. Priorização & faseamento\n"
            "  11.1 Definição do MVP\n"
            "  11.2 Fases de entrega / releases — SINAL NATIVO DE PRECIFICAÇÃO "
            "(D-29): use o que for extraível da viabilidade/expectativa de solução.\n"
            "  11.3 Critério de priorização utilizado\n"
            "## 12. Riscos, premissas, dependências & dúvidas em aberto\n"
            "  12.1 Riscos — use a lista de red flags por lens fornecida (Produto "
            "e Dados) no 'user' message.\n"
            "  12.2 Dependências\n"
            "  12.3 Restrições\n"
            "  12.4 Dúvidas em aberto (do CSD) — use a lista de perguntas por lens "
            f"fornecida no 'user' message; itens no bucket 'não classificado' "
            "aparecem numa subseção à parte, sem forçar lens.\n"
            "## 13. Critérios de qualidade: Ready, Done & aceite\n"
            "  13.1 Definition of Ready\n"
            "  13.2 Definition of Done\n"
            "  13.3 Critérios de aceite do MVP\n"
            "  13.4 Estratégia de testes\n"
            "## 14. Glossário\n"
            f"  {self.EMPTY_SECTION_MARKER} salvo termos técnicos específicos já "
            "usados na transcrição.\n"
            "## 15. Anexos & matriz de rastreabilidade\n"
            f"  15.1 Matriz de rastreabilidade — {self.EMPTY_SECTION_MARKER}\n"
            f"  15.2 Anexos — {self.EMPTY_SECTION_MARKER}\n"
        )

    # -------------------------------------------------------------------------
    # Build all at once
    # -------------------------------------------------------------------------

    def build_all(self) -> dict[str, str]:
        # D-23: dois valores de planner (Produto sempre roda; Dados só em
        # gatilho par) — substitui a chave única "question_planner" do sales.
        return {
            "coverage_classifier": self.build_coverage_classifier(),
            "red_flag_detector": self.build_red_flag_detector(),
            "question_planner_produto": self.build_question_planner(lens="produto"),
            "question_planner_dados": self.build_question_planner(lens="dados"),
            "report_generator": self.build_report_generator(),
        }
