"""
PromptBuilder — gera system prompts personalizados por agente.

Calibração dupla: DMS (1–5) × tipo de projeto (bi, ml, data_engineering, automation, integration, science).
"""

DMS_LABEL = {
    1: "Sem estrutura",
    2: "Estrutura inicial",
    3: "Dados centralizados",
    4: "Maturidade analítica",
    5: "Data-driven",
}

DMS_DESCRIPTION = {
    1: "dados espalhados em planilhas, WhatsApp e sistemas desconectados; sem governança, sem centralização",
    2: "dados minimamente organizados em algum sistema, mas sem integração entre fontes e sem processo de qualidade",
    3: "infraestrutura básica funcionando, dados acessíveis e centralizados, mas sem camada analítica consolidada",
    4: "dados organizados, BI em uso, time consome informação para decisão; pronto para automações e primeiros casos de IA",
    5: "cultura analítica consolidada, infraestrutura robusta e escalável, time preparado para IA estruturada",
}

_ADVANCED_TERMS = (
    "data contracts, lakehouse, data mesh, MLOps, feature store, "
    "data lineage, SLA de pipeline, observabilidade de dados, "
    "governança de dados, data catalog"
)

# ---------------------------------------------------------------------------
# Configuração de áreas por tipo de projeto
#   critical  — avaliar com rigor, cobertura fraca é gap real
#   optional  — avaliar se o cliente mencionar
#   inactive  — não aplicável; inicializar como not_applicable no state
# ---------------------------------------------------------------------------

AREAS_BY_PROJECT_TYPE: dict[str, dict[str, list[str]]] = {
    "bi": {
        "critical": ["negocio", "visualizacao", "eng_dados", "parceria"],
        "optional": ["integracao", "consumo"],
        "inactive": ["ciencia_dados", "automacao"],
    },
    "ml": {
        "critical": ["negocio", "ciencia_dados", "eng_dados", "parceria"],
        "optional": ["integracao", "consumo"],
        "inactive": ["visualizacao", "automacao"],
    },
    "data_engineering": {
        "critical": ["negocio", "eng_dados", "integracao", "parceria"],
        "optional": ["automacao", "consumo"],
        "inactive": ["visualizacao", "ciencia_dados"],
    },
    "automation": {
        "critical": ["negocio", "automacao", "integracao", "parceria"],
        "optional": ["eng_dados", "consumo"],
        "inactive": ["visualizacao", "ciencia_dados"],
    },
    "integration": {
        "critical": ["negocio", "integracao", "parceria"],
        "optional": ["eng_dados", "consumo", "automacao"],
        "inactive": ["visualizacao", "ciencia_dados"],
    },
    "science": {
        "critical": ["negocio", "ciencia_dados", "eng_dados", "parceria"],
        "optional": ["integracao", "consumo"],
        "inactive": ["visualizacao", "automacao"],
    },
}

_TYPE_RED_FLAG_HINTS: dict[str, str] = {
    "bi": (
        "Riscos específicos de BI: dashboards sem KPIs definidos pelo cliente, "
        "dados sem atualização automatizada, usuários finais sem acesso ou treinamento definido, "
        "ausência de fonte única de verdade para os KPIs."
    ),
    "ml": (
        "Riscos específicos de ML: volume ou qualidade insuficiente de dados para treinamento, "
        "ausência de pipeline de retraining, modelo em produção sem monitoramento de drift, "
        "label ou target mal definido ou inexistente."
    ),
    "data_engineering": (
        "Riscos específicos de Engenharia de Dados: fontes sem documentação ou schema instável, "
        "ETL frágil sem retry e sem observabilidade, ausência de contratos de dados, "
        "latência incompatível com o caso de uso downstream."
    ),
    "automation": (
        "Riscos específicos de Automação: processo com muitas exceções que exigem decisão humana, "
        "ausência de tratamento de falhas e reprocessamento, fluxo não documentado, "
        "dependência de sistema legado instável ou sem API."
    ),
    "integration": (
        "Riscos específicos de Integração: APIs sem documentação ou instáveis, "
        "autenticação complexa mal mapeada, sistemas legados com comportamento imprevisível, "
        "ausência de versionamento ou contrato de API."
    ),
    "science": (
        "Riscos específicos de Ciência de Dados: hipótese não validável com os dados disponíveis, "
        "ausência de dados históricos suficientes, resultado esperado não mensurável, "
        "viés de seleção nos dados de análise."
    ),
}

_TYPE_QUESTION_FOCUS: dict[str, str] = {
    "bi": (
        "FOCO PARA ESTE PROJETO (BI): blocos visualizacao (KPIs já definidos?, quem acessa?, "
        "frequência de uso, nível de interação) e eng_dados (fontes, frequência de atualização, "
        "qualidade dos dados). Negócio: qual decisão concreta o dashboard vai suportar?"
    ),
    "ml": (
        "FOCO PARA ESTE PROJETO (ML): bloco ciencia_dados (tipo de problema — "
        "classificação/regressão/clustering, volume histórico, existe label/target definido?) "
        "e eng_dados (qualidade, frequência dos dados de treino). "
        "Negócio: qual ação concreta o modelo vai automatizar?"
    ),
    "data_engineering": (
        "FOCO PARA ESTE PROJETO (Engenharia de Dados): bloco eng_dados (número de fontes, "
        "formatos, qualidade, latência esperada, consumidores downstream) e integracao "
        "(APIs disponíveis, autenticação, estabilidade). "
        "Negócio: quem são os consumidores finais dos dados e como os usam?"
    ),
    "automation": (
        "FOCO PARA ESTE PROJETO (Automação): bloco automacao (processo atual passo a passo, "
        "quantas exceções manuais existem, o que acontece quando o fluxo falha?) "
        "e integracao (sistemas envolvidos, APIs existentes). "
        "Negócio: quanto tempo/custo o processo manual consome hoje?"
    ),
    "integration": (
        "FOCO PARA ESTE PROJETO (Integração): bloco integracao (sistemas envolvidos, "
        "APIs documentadas?, tipo de autenticação, SLA de disponibilidade, versão estável?) "
        "e eng_dados (volume de dados, frequência, transformações necessárias). "
        "Negócio: qual fluxo de informação precisa ser conectado e por quê?"
    ),
    "science": (
        "FOCO PARA ESTE PROJETO (Ciência de Dados): bloco ciencia_dados (hipótese de negócio "
        "que guia a análise, dados disponíveis e período histórico, granularidade, "
        "tipo de insight esperado) e eng_dados (qualidade, completude, vieses conhecidos). "
        "Negócio: qual decisão estratégica será tomada com base na análise?"
    ),
}


CITI_PORTFOLIO = """
PORTFÓLIO CITi — FRENTES DE DADOS (use para alinhar recomendações comerciais):

Strategy & Vision (entrada consultiva):
  - Consultoria e Assessment de Dados: imersão estratégica (3-6 semanas). Recomendado quando
    o cliente não sabe o que precisa ou tem DMS baixo. Substitui o kick-off de projetos maiores.
  - IA Enterprise: adoção de IA na operação (frente técnica + frente humana). Exige DMS mínimo 3.
  - Agentes de IA e Chatbots: soluções conversacionais alimentadas pela base de conhecimento do
    cliente. Sem base de dados sólida, produz alucinações. Exige estrutura prévia.

Business Intelligence:
  - Análise de Dados: responde perguntas de negócio (descritiva → diagnóstica → preditiva → prescritiva)
  - Dashboards e Visualização: painéis sob medida por perfil de usuário (CEO ≠ gerente ≠ operação)
  - Automação de Relatórios e Alertas: elimina trabalho manual; geralmente acompanha BI ou Sustentação

Data Infrastructure (necessidade frequentemente oculta):
  - Pipelines e Centralização: ETL automatizado, Data Warehouse, Data Lake, infra em nuvem
  - Integração de Sistemas: APIs, conectores nativos, webhooks, dev customizado
  - Qualidade de Dados: limpeza, padronização, governança, LGPD — raramente vendido isolado

REGRAS COMERCIAIS (aplique na Recomendação Final e nos Sprints):
- Data Infrastructure quase sempre é necessidade oculta atrás de pedidos de BI ou IA.
  Se o cliente pede BI/IA mas os dados não estão organizados → sinalize e inclua infraestrutura nos sprints.
- Cliente quer IA com DMS ≤ 2 → recomende vender Discovery/Assessment antes da execução.
- Assessment pode ser o projeto inicial E substituir o kick-off de projetos maiores.
- Sem base de dados sólida, Agentes de IA e BI avançado produzem resultados ruins.

COMO INTERPRETAR O DMS (4 dimensões: Infraestrutura, Qualidade, Cultura Analítica, Maturidade com IA):
- O nível final é sempre o MENOR entre as 4 dimensões — a fundação determina o teto.
- Cliente com BI consolidado mas sem infraestrutura de dados = DMS 2, não DMS 3.
- Se o cliente não consegue explicar onde os dados vivem → infraestrutura não está resolvida → DMS ≤ 2.
- Sinais DMS 1-2: planilhas, coleta manual, sem cloud, sem responsável pelos dados, sem dashboard em uso.
- Sinais DMS 4-5: pipeline automatizado, BI em uso diário, time data-driven, já experimentou IA.
""".strip()

CITI_SERVICE_CATALOG = """
CATÁLOGO DE SERVIÇOS CITi (use como referência para montar a estrutura de sprints):

Geral
  - Onboarding e Alinhamento | Mapeamento de Regras de Negócio

Diagnóstico e Estratégia de Dados
  - Fase 1: Imersão Estratégica
  - Fase 2: Mapeamento de Dados e Processos
  - Fase 3: Análise e Diagnóstico
  - Fase 4: Plano de Ação

Engenharia de Dados
  - Ingestão de dados (planilha/banco) | Construção de API | Ingestão via API
  - Tratamento e limpeza | Padronização e regras de negócio | Integração entre fontes
  - Configuração de automação e orquestração de pipeline
  - Integração com APIs externas | Construção de endpoints

Data Warehouse
  - Setup da infraestrutura | Configuração do ambiente (cloud, banco, permissões)
  - Definição da arquitetura (camadas, tecnologia) | Modelagem de dados
  - Construção da camada RAW | Construção da camada tratada
  - Integração de dados no ambiente analítico | Estruturação de tabelas analíticas
  - Testes e validação | Documentação do modelo de dados

Dashboards
  - Definição de métricas e KPIs | Construção de visualizações básicas
  - Implementação de filtros e segmentações | Drill-down
  - Apresentação e entrega | Ajustes pós-feedback

Automação
  - Mapeamento do fluxo | Integração com APIs | Construção do fluxo
  - Regras de decisão | Tratamento de erros | Testes e validação

Análise e Insights Estratégicos
  - Levantamento e preparação dos dados | Exploração e cruzamento
  - Identificação de padrões e gargalos | Teste de hipóteses
  - Identificação de oportunidades e riscos | Recomendações estratégicas
  - Modelagem preditiva (se aplicável) | Avaliação e treinamento de modelo
  - Apresentação executiva

IA Aplicada ao Negócio
  - Entendimento do problema | Ingestão de dados (PDF/API/planilha)
  - Tratamento e estruturação | Criação de embeddings | Construção do RAG
  - Definição de regras e contexto | Lógica de recomendação
  - Construção de agente (se aplicável) | Integração com sistemas
  - Interface (chat/web) | Testes e validação | Deploy
""".strip()

CITI_TECH_REFERENCE = """
REFERÊNCIA DE TECNOLOGIAS (recomende o que se aplica ao projeto e ao DMS):

Linguagem / Backend:
  Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, asyncpg

Banco de Dados / DW:
  PostgreSQL 16, BigQuery, Snowflake, DuckDB, dbt, pgvector

Ingestão / ETL:
  pandas, polars, Airbyte, Apache Spark (volumes grandes)

Orquestração:
  n8n (automação low-code), Apache Airflow, Prefect, APScheduler

BI / Visualização:
  Power BI, Metabase, Looker Studio, Apache Superset

IA / ML:
  Google Gemini 2.5 Flash, OpenAI GPT-4o, LangChain, LangGraph,
  scikit-learn, XGBoost, MLflow, ChromaDB, FAISS

Infraestrutura:
  Docker, Docker Compose, Railway, Vercel, GCP (Cloud Run, BigQuery), AWS

Qualidade:
  pytest, Great Expectations, dbt tests
""".strip()


class PromptBuilder:
    def __init__(
        self,
        dms: "int | None",
        pre_meeting_context: str = "",
        project_type: str = "",
        custom_areas: "list[dict] | None" = None,
        structured_context: "object | None" = None,
    ):
        self.dms = max(1, min(5, dms)) if dms is not None else None
        self.context = pre_meeting_context or "não fornecido"
        self.project_type = project_type or ""
        self.custom_areas = custom_areas or []
        self.dms_label = DMS_LABEL[self.dms] if self.dms is not None else "Não mapeado"
        self.dms_desc = DMS_DESCRIPTION[self.dms] if self.dms is not None else "maturidade de dados ainda não avaliada para este cliente"
        # StructuredContext | None — duck typing, sem import em runtime
        self.sc = structured_context if (structured_context and not structured_context.is_empty()) else None

    # -------------------------------------------------------------------------
    # Helpers de tipo de projeto
    # -------------------------------------------------------------------------

    def _area_hint(self) -> str:
        config = AREAS_BY_PROJECT_TYPE.get(self.project_type, {})
        if not config:
            return ""
        critical = config.get("critical", [])
        optional = config.get("optional", [])
        inactive = config.get("inactive", [])
        parts = [f"TIPO DE PROJETO: {self.project_type}"]
        if critical:
            parts.append(f"Áreas OBRIGATÓRIAS (avaliar com rigor): {', '.join(critical)}")
        if optional:
            parts.append(f"Áreas OPCIONAIS (avaliar se mencionadas): {', '.join(optional)}")
        if inactive:
            parts.append(
                f"Áreas NÃO APLICÁVEIS para este tipo: {', '.join(inactive)}. "
                "Para estas áreas retorne exatamente: "
                'status="not_applicable", score=0, notes="não aplicável para este tipo de projeto".'
            )
        return "\n".join(parts)

    # -------------------------------------------------------------------------
    # CoverageClassifier
    # -------------------------------------------------------------------------

    def _dms_str(self) -> str:
        if self.dms is None:
            return f"Não mapeado ({self.dms_label}): {self.dms_desc}"
        return f"{self.dms}/5 ({self.dms_label}): {self.dms_desc}"

    def build_coverage_classifier(self) -> str:
        if self.dms is None:
            priority_hint = (
                "DMS DO CLIENTE NÃO FOI MAPEADO. Avalie todas as áreas aplicáveis sem pressupor "
                "nível de maturidade. Se a transcrição revelar sinais claros de maturidade baixa "
                "(planilhas, sem DW, dados manuais), calibre a pontuação a partir disso."
            )
        elif self.dms <= 2:
            priority_hint = (
                "ÁREAS PRIORITÁRIAS para este cliente: negocio (entender a dor e o processo atual), "
                "eng_dados (quantas fontes, qualidade dos dados, se há processo manual de coleta), "
                "parceria (prazo, urgência, ponto focal).\n"
                "ÁREAS DE MENOR PESO: ciencia_dados e visualizacao — clientes neste nível raramente "
                "têm infraestrutura para ML ou dashboards complexos; avalie com cautela.\n"
                "IMPORTANTE: ausência de DW, ETL manual e dados em planilhas NÃO são gaps de cobertura "
                "— são a realidade esperada para DMS 1-2. Não penalize por isso."
            )
        elif self.dms == 3:
            priority_hint = (
                "Todas as áreas aplicáveis têm peso equilibrado para este cliente. "
                "O cliente já tem infraestrutura básica; foque em entender a qualidade dos dados, "
                "cobertura do DW existente e capacidade de modelagem. "
                "automacao e integracao começam a ser relevantes neste nível."
            )
        else:
            priority_hint = (
                "ÁREAS CRÍTICAS para este cliente: eng_dados (observabilidade dos pipelines, "
                "monitoramento de qualidade, data lineage), ciencia_dados (qualidade do dado de "
                "treinamento, monitoramento de modelo em produção), integracao (estabilidade das APIs, "
                "documentação, autenticação).\n"
                "Questione ausência de governança, falta de monitoramento e escalabilidade — "
                "esses são gaps reais para um cliente DMS 4-5."
            )

        area_hint = self._area_hint()
        area_block = f"{area_hint}\n\n" if area_hint else ""

        stack_hint = self.sc.to_stack_hint() if self.sc else ""
        stack_block = f"{stack_hint}\n\n" if stack_hint else ""

        return (
            f"Você é um CoverageClassifier para diagnóstico de projetos de dados/tecnologia.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião: {self.context}\n\n"
            f"{area_block}"
            f"{stack_block}"
            f"{priority_hint}\n\n"
            "REGRAS ESTRITAS DE PONTUAÇÃO — siga à risca:\n"
            "- score 0 + 'uncovered': área NÃO foi mencionada na transcrição.\n"
            "- score 1–40 + 'partial': área foi tocada superficialmente (1–2 menções rápidas).\n"
            "- score 41–79 + 'partial': área foi discutida mas ainda há gaps importantes.\n"
            "- score 80–100 + 'covered': área foi discutida em profundidade, aspectos principais confirmados com detalhes concretos.\n"
            "- 'not_applicable': use APENAS para áreas declaradas NÃO APLICÁVEIS acima.\n"
            "Se a transcrição for curta (< 200 palavras), a MAIORIA das áreas DEVE ser 'uncovered' com score 0.\n"
            "NUNCA extrapole — não infira cobertura de algo não dito explicitamente.\n"
            "Texto fragmentado, palavras soltas ou frases incompletas NÃO contam como cobertura.\n"
            "Repetição da mesma frase várias vezes conta como UMA única menção.\n"
            "Quando houver dúvida entre 'partial' e 'covered', escolha 'partial'.\n"
            "Quando houver dúvida entre 'uncovered' e 'partial', escolha 'uncovered'.\n\n"
            "Analise a transcrição e classifique a cobertura de cada área.\n"
            "Retorne APENAS JSON válido (sem markdown fences):\n"
            '{"areas":{"negocio":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
            '"eng_dados":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
            '"visualizacao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
            '"ciencia_dados":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
            '"automacao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
            '"integracao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
            '"consumo":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
            '"parceria":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""}}}'
        )

    # -------------------------------------------------------------------------
    # RedFlagDetector
    # -------------------------------------------------------------------------

    def build_red_flag_detector(self) -> str:
        if self.dms is None:
            calibration = (
                "SENSIBILIDADE para DMS não mapeado: avalie riscos com base apenas no que a "
                "transcrição revelar. Emita alertas quando houver expectativas claramente irreais, "
                "falta de ponto focal, prazo incompatível com escopo ou dados caóticos. "
                "Calibre conforme sinais de maturidade que emergirem na conversa."
            )
        elif self.dms <= 2:
            calibration = (
                "SENSIBILIDADE CALIBRADA para DMS baixo:\n"
                "✅ EMITA alerta se: o cliente quer ML/IA complexo sem ter dados organizados, "
                "não há nenhum ponto focal técnico definido, o prazo é irreal para o escopo descrito, "
                "ou o cliente descreve dados completamente caóticos sem nenhuma estrutura.\n"
                "🚫 NÃO emita alerta para: ausência de DW, ETL manual, dados em planilhas, "
                "falta de pipeline automatizado — isso é normal e esperado para DMS 1-2."
            )
        elif self.dms == 3:
            calibration = (
                "SENSIBILIDADE CALIBRADA para DMS médio:\n"
                "✅ EMITA alerta se: dados de baixa qualidade para projetos ML, "
                "ausência de DW para BI complexo, prazo agressivo para escopo amplo, "
                "integrações críticas sem documentação de API.\n"
                "🚫 NÃO emita alerta para: processos ainda não totalmente automatizados "
                "ou falta de observabilidade avançada — são gaps esperados neste nível."
            )
        else:
            calibration = (
                "SENSIBILIDADE CALIBRADA para DMS alto:\n"
                "✅ EMITA alerta se: pipelines sem monitoramento, dados sensíveis sem governança, "
                "modelo em produção sem sistema de retraining, APIs críticas sem SLA definido, "
                "ausência de documentação e data lineage em integrações complexas.\n"
                "Para um cliente DMS 4-5, gaps de observabilidade e governança SÃO riscos reais."
            )

        type_hint = _TYPE_RED_FLAG_HINTS.get(self.project_type, "")
        type_block = (
            f"RISCOS ESPECÍFICOS PARA ESTE TIPO DE PROJETO ({self.project_type.upper()}):\n"
            f"{type_hint}\n\n"
        ) if type_hint else ""

        flag_hint = self.sc.to_flag_hint() if self.sc else ""
        flag_block = f"{flag_hint}\n\n" if flag_hint else ""

        return (
            f"Você é um RedFlagDetector para diagnóstico de projetos de dados/tecnologia.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião: {self.context}\n\n"
            f"{type_block}"
            f"{flag_block}"
            f"{calibration}\n\n"
            "Identifique até 2 riscos críticos na transcrição. Se não houver riscos reais, retorne lista vazia.\n"
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
                "Comece com perguntas de nível médio e ajuste para cima ou para baixo "
                "conforme o cliente demonstrar familiaridade técnica."
            )
        elif self.dms <= 2:
            vocab_hint = (
                "VOCABULÁRIO: use linguagem simples e prática. "
                f"EVITE completamente: {_ADVANCED_TERMS}. "
                "Perguntas devem ser acessíveis: 'Como os dados chegam hoje?', "
                "'Quem faz isso manualmente?', 'Existe alguma planilha central?'."
            )
        elif self.dms == 3:
            vocab_hint = (
                "VOCABULÁRIO: use nível intermediário. Pode mencionar DW, pipeline, ETL, dashboard, "
                "qualidade de dados, frequência de atualização. "
                "Evite termos de ponta como data mesh, lakehouse, MLOps."
            )
        else:
            vocab_hint = (
                "VOCABULÁRIO: pode usar vocabulário técnico completo — observabilidade, data contracts, "
                "MLOps, governança, SLA, data lineage, lakehouse, feature store. "
                "Este cliente entende e espera perguntas técnicas de alto nível."
            )

        type_focus = _TYPE_QUESTION_FOCUS.get(self.project_type, "")
        type_block = f"{type_focus}\n\n" if type_focus else ""

        question_hint = self.sc.to_question_hint() if self.sc else ""
        question_block = f"{question_hint}\n\n" if question_hint else ""

        return (
            f"Você é um QuestionPlanner para diagnóstico de projetos de dados/tecnologia.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião (o que já se sabe antes da conversa): {self.context}\n\n"
            f"{type_block}"
            f"{question_block}"
            f"{vocab_hint}\n\n"
            "Sua tarefa: gerar exatamente 3 perguntas em português para o comercial fazer ao cliente.\n\n"
            "ESTILO OBRIGATÓRIO — curtas, diretas, interrogativas:\n"
            "✅ BOM: 'Quantas fontes de dados?', 'Precisa de IA?', 'Prazo do projeto?', 'Já tem DW?'\n"
            "❌ RUIM: 'Poderia nos contar mais sobre como os dados chegam atualmente ao sistema?'\n"
            "Máximo 10 palavras por pergunta. Sem introduções, sem contexto embutido — só a pergunta.\n\n"
            "PRIORIDADE:\n"
            "1. Analise a transcrição — identifique o que já foi dito e o que está sendo discutido agora.\n"
            "2. Olhe a cobertura — priorize áreas ainda descobertas ou com score baixo.\n"
            "3. Use o banco de perguntas apenas como REFERÊNCIA de temas. "
            "Adapte, combine, reformule ou ignore completamente — use o que fizer sentido para a conversa atual.\n"
            "4. Não repita perguntas recentes.\n\n"
            "Retorne APENAS JSON válido:\n"
            '{"questions":[{"text":"...","block":"negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"}]}'
        )

    # -------------------------------------------------------------------------
    # ReportGenerator
    # -------------------------------------------------------------------------

    def build_report_generator(self) -> str:
        if self.dms is None:
            maturity_hint = (
                "Na seção 'Maturidade de Dados': o DMS não foi pré-mapeado. "
                "Infira o nível a partir do que a transcrição revelou e explique a classificação. "
                "Deixe claro que é uma estimativa baseada na reunião, não um assessment formal."
            )
        elif self.dms <= 2:
            maturity_hint = (
                "Na seção 'Maturidade de Dados': explique de forma simples o que o nível atual significa "
                "na prática, que tipo de projeto é viável agora e o que seria necessário para evoluir. "
                "Evite recomendar soluções complexas sem antes estruturar o básico."
            )
        elif self.dms == 3:
            maturity_hint = (
                "Na seção 'Maturidade de Dados': o cliente tem base funcional. "
                "Foque no gap entre o que tem hoje e o que o projeto exige. "
                "Recomende evoluções incrementais e pragmáticas."
            )
        else:
            maturity_hint = (
                "Na seção 'Maturidade de Dados': o cliente tem infraestrutura avançada. "
                "Questione se há observabilidade, governança e escalabilidade adequadas para o projeto. "
                "Se houver gaps nessas áreas, sinalize como riscos prioritários."
            )

        type_label = self.project_type.upper() if self.project_type else "não especificado"
        pre_meeting_section = (
            "## Diagnóstico Pré-Reunião vs Realidade\n"
            "  Esta é a PRIMEIRA seção do relatório. "
            "Use o bloco '## Contexto pré-reunião estruturado' da mensagem do usuário.\n"
            "  - **O que já se sabia:** resuma dores, stack e restrições que a CITi levou para a reunião\n"
            "  - **O que a reunião confirmou:** o que a transcrição validou do pré-mapeamento\n"
            "  - **O que mudou ou surpreendeu:** divergências entre o esperado e o revelado ao vivo\n"
            "  - **Riscos não discutidos com o cliente:** liste TODOS os riscos marcados como "
            "'NÃO discutidos' — inclua-os também nos Próximos Passos da Recomendação Final\n"
        ) if self.sc else ""

        complexity_hint = (
            "Na seção 'Nível de Complexidade': clientes DMS 1-2 frequentemente subestimam o esforço "
            "porque não enxergam o trabalho de infraestrutura que está por trás. Considere isso na "
            "classificação — um pedido de BI simples para um cliente DMS 1 raramente é Simples."
            if self.dms is not None and self.dms <= 2 else
            "Na seção 'Nível de Complexidade': avalie com base no escopo real, número de integrações, "
            "qualidade dos dados disponíveis, riscos técnicos e alinhamento entre expectativa e realidade."
        )

        sprint_hint = (
            "Na seção 'Estrutura de Sprints': inclua obrigatoriamente um sprint de Diagnóstico e "
            "Estratégia de Dados no início — o cliente precisa estruturar o básico antes de qualquer "
            "entrega técnica. Se quiser IA com DMS ≤ 2, inclua Discovery antes."
            if self.dms is not None and self.dms <= 2 else
            "Na seção 'Estrutura de Sprints': cliente tem base funcional. Pode pular setup básico "
            "se já o tiver. Foque nos módulos que entregam valor incremental real."
            if self.dms == 3 else
            "Na seção 'Estrutura de Sprints': client DMS não mapeado ou avançado. "
            "Monte sprints com base no que a transcrição revelou sobre a infraestrutura atual. "
            "Inclua setup básico se sinais de baixa maturidade forem detectados."
        )

        return (
            "Você é um tech lead sênior da CITi gerando um relatório de diagnóstico técnico-comercial "
            "em português brasileiro.\n"
            f"Tipo de projeto: {type_label}.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n\n"
            "Escreva em Markdown claro e profissional. Seja específico, direto e orientado a ações. "
            "Sem texto de preenchimento. Quando houver risco legal ou expectativa irreal, diga claramente.\n\n"
            f"{complexity_hint}\n\n"
            f"{maturity_hint}\n\n"
            f"{sprint_hint}\n\n"
            "Na seção 'Recomendação Final', a decisão deve ser uma de:\n"
            "  ✅ Fechar — projeto viável conforme apresentado\n"
            "  ⚠️ Fechar com condições — liste o que precisa ser resolvido antes/durante\n"
            "  ❌ Não fechar sem antes resolver X — liste o que inviabiliza o fechamento agora\n\n"
            "Estruture o relatório com estas seções na ordem exata:\n"
            f"{pre_meeting_section}"
            "## Nível de Complexidade\n"
            "  - Classificação: Simples | Médio | Complexo | Bomba\n"
            "  - Justificativa baseada no escopo, DMS, riscos técnicos e alinhamento de expectativas\n"
            "## Cobertura por Área\n"
            "  Tabela: Área | Status | Score | Observações (omita not_applicable)\n"
            "## Riscos e Alertas\n"
            "  - 🚨 ALERTA CRÍTICO: riscos que podem inviabilizar o projeto ou gerar prejuízo\n"
            "  - ⚠️ RED FLAG: pontos de atenção que precisam ser endereçados antes ou durante\n"
            "## Arquitetura Recomendada\n"
            "  ### Stack por Camada\n"
            "    Tabela: Camada | Tecnologia Recomendada | Justificativa\n"
            "    Camadas possíveis: Ingestão | Armazenamento/DW | Transformação | Orquestração | Consumo/Visualização | IA/ML\n"
            "    Omita camadas não aplicáveis. Justifique cada escolha com base no projeto e DMS.\n"
            "  ### Componentes e Fluxo de Dados\n"
            "    - Liste os módulos principais numerados\n"
            "    - Descreva o fluxo de dados entre eles em uma linha (ex: Módulo A → Módulo B → ...)\n"
            "  ### Possíveis Armadilhas\n"
            "    - Riscos arquiteturais específicos deste projeto que costumam ser subestimados\n"
            "## Estrutura de Sprints Recomendada\n"
            "  Selecione apenas módulos do catálogo CITi relevantes. Use o portfólio CITi para guiar "
            "quais frentes incluir.\n"
            "  Tabela: Sprint | Módulo CITi | Principais Atividades | Duração (semanas)\n"
            "  Adicione linha 'Total' com a soma de semanas ao final.\n"
            "## Perguntas Ainda Sem Resposta\n"
            "  - Liste o que ficou sem resposta na reunião e precisa ser esclarecido antes de fechar\n"
            "  - Para cada pergunta: por que é crítica e o que a falta dela implica\n"
            "## Recomendação Final\n"
            "  - Decisão com emoji (✅ / ⚠️ / ❌)\n"
            "  - Justificativa objetiva\n"
            "  - Próximos passos concretos numerados\n"
            "## Maturidade de Dados\n"
            "  - Nível atual e o que significa na prática para este cliente\n"
            "  - Maturidade mínima necessária para o projeto proposto\n"
            "  - Gap identificado e impacto concreto no projeto\n"
            "  - Recomendações para elevar a maturidade\n"
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
