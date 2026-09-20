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
