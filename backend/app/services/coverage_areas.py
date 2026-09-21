"""
coverage_areas — registro unico de verdade para as areas de cobertura.

Fase 1 (Area-Set Registry) / D-01, D-02: substitui as 8 areas de cobertura do
modo vendas, ate entao duplicadas em varios arquivos (llm.py, prompt_builder.py,
session_state.py), por um unico modulo que gera todas as strings derivadas
(schema JSON do prompt, labels legiveis, enum de blocos) a partir de uma unica
lista ordenada.

Modulo FOLHA (leaf): importa apenas `dataclasses` (stdlib). NAO importa nada de
`app.services.*` para evitar import circular com os consumidores (Pitfall 3,
RESEARCH.md).

O dataclass por-area chama-se `AreaDefinition` (nao `CoverageArea`) de proposito
— `session_state.py` ja define um dataclass `CoverageArea` diferente (o registro
por-sessao em tempo de execucao); reusar o nome colidiria conceitualmente mesmo
sem colisao de import (modulos distintos).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class AreaDefinition:
    key: str
    label: str
    order: int


@dataclass(frozen=True)
class AreaSet:
    name: str
    areas: tuple[AreaDefinition, ...]

    def _ordered(self) -> tuple[AreaDefinition, ...]:
        return tuple(sorted(self.areas, key=lambda a: a.order))

    def keys(self) -> list[str]:
        return [a.key for a in self._ordered()]

    def labels(self) -> dict[str, str]:
        return {a.key: a.label for a in self._ordered()}

    def schema_json(self, *, include_not_applicable: bool = False) -> str:
        status = "covered|partial|uncovered" + ("|not_applicable" if include_not_applicable else "")
        body = ",".join(
            f'"{a.key}":{{"status":"{status}","score":0-100,"notes":""}}'
            for a in self._ordered()
        )
        return '{"areas":{' + body + "}}"

    def block_enum(self) -> str:
        return "|".join(self.keys())


# As 8 areas do modo vendas, na ordem atual (llm.py / prompt_builder.py / session_state.py).
SALES_AREA_SET = AreaSet(
    name="sales",
    areas=(
        AreaDefinition("negocio", "Negócio", 0),
        AreaDefinition("eng_dados", "Eng. de Dados", 1),
        AreaDefinition("visualizacao", "Visualização", 2),
        AreaDefinition("ciencia_dados", "Ciência de Dados", 3),
        AreaDefinition("automacao", "Automação", 4),
        AreaDefinition("integracao", "Integração", 5),
        AreaDefinition("consumo", "Consumo", 6),
        AreaDefinition("parceria", "Parceria", 7),
    ),
)

# Fase 2 (Discovery Mode) / D-06: as 18 areas do modo discovery — Produto
# (order 0-7) seguido de Dados (order 8-17). Instancia independente de
# SALES_AREA_SET: coexistem no mesmo modulo sem colisao de namespace mesmo
# com a chave "ciencia_dados" presente nos dois AreaSets (D-08: exclusivos
# por `mode`, nunca misturados no mesmo dict de cobertura).
DISCOVERY_AREA_SET = AreaSet(
    name="discovery",
    areas=(
        # Produto (0-7) — D-06
        AreaDefinition("gargalo", "Gargalo", 0),
        AreaDefinition("frente_atuacao", "Frente de Atuação", 1),
        AreaDefinition("impacto_usuario", "Impacto no Usuário", 2),
        AreaDefinition("mapeamento_processos", "Mapeamento do Fluxo de Processos", 3),
        AreaDefinition("fluxo_dados", "Fluxo dos Dados", 4),
        AreaDefinition("desenho_solucao", "Desenho da Solução", 5),
        AreaDefinition("expectativa_solucao", "Expectativa de Solução", 6),
        AreaDefinition("viabilidade_solucao", "Viabilidade da Solução", 7),
        # Dados (8-17) — D-06
        AreaDefinition("qualidade_fontes", "Fontes e Qualidade dos Dados", 8),
        AreaDefinition("metricas", "Métricas", 9),
        AreaDefinition("lgpd_seguranca", "LGPD/Segurança", 10),
        AreaDefinition("quick_wins", "Quick Wins", 11),
        AreaDefinition("ciencia_dados", "Ciência de Dados", 12),
        AreaDefinition("analise_dados", "Análise de Dados", 13),
        AreaDefinition("engenharia_dados", "Engenharia de Dados", 14),
        AreaDefinition("machine_learning", "Machine Learning", 15),
        AreaDefinition("sistemas_nuvem", "Sistemas em Nuvem", 16),
        AreaDefinition("automacoes", "Automações", 17),
    ),
)

# D-02: relocado verbatim de prompt_builder.py:36-67 — semantica inalterada.
#   critical  — avaliar com rigor, cobertura fraca e gap real
#   optional  — avaliar se o cliente mencionar
#   inactive  — nao aplicavel; inicializar como not_applicable no state
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
