# =============================================================================
# coverage/tracker.py
#
# CoverageTracker: o "mapa de cobertura" da reunião.
#
# Mantém o estado de todas as áreas de risco (universais + dinâmicas),
# calcula o score de saturação e decide quando a reunião já tem contexto
# suficiente para gerar o relatório.
# =============================================================================

import copy
from datetime import datetime

from .area import RiskArea, Status


# -----------------------------------------------------------------------------
# Áreas universais — presentes em TODO diagnóstico, independente do projeto.
# Derivadas das categorias do SYSTEM_PROMPT marcadas como "todo e qualquer
# projeto". São o ponto de partida do mapa antes da IA detectar o tipo do
# projeto.
# -----------------------------------------------------------------------------
UNIVERSAL_AREAS: list[RiskArea] = [
    RiskArea(id="clareza_cliente_escopo",    name="Clareza do cliente / Escopo"),
    RiskArea(id="inputs_dados",              name="Inputs e Dados"),
    RiskArea(id="integracoes",               name="Integrações Externas"),
    RiskArea(id="auth_seguranca",            name="Auth / Segurança"),
    RiskArea(id="volume_performance",        name="Volume / Performance"),
    RiskArea(id="validacao_tolerancia_erro", name="Validação / Tolerância a Erro"),
    RiskArea(id="prazo_capacidade",          name="Prazo / Capacidade"),
    RiskArea(id="operacao_pos_entrega",      name="Operação Pós-entrega"),
]

# -----------------------------------------------------------------------------
# Presets dinâmicos — conjuntos de sub-áreas específicas que a IA pode ativar
# quando detecta sinais do tipo de projeto na transcrição.
#
# Exemplo: o cliente menciona "PIX e gateway de pagamento" → a IA sinaliza
# project_type_signal = "ecommerce" → o orchestrator chama activate_preset("ecommerce")
# → as sub-áreas de gateway, estoque e frete aparecem no mapa.
#
# Por que não ativar tudo de cara? Para não poluir o painel com áreas
# irrelevantes — um projeto de BI interno não precisa de "gateway de pagamento".
# -----------------------------------------------------------------------------
DYNAMIC_AREA_PRESETS: dict[str, list[RiskArea]] = {
    "ia_ml": [
        RiskArea(id="ia_taxa_erro",        name="Taxa de erro / Acurácia IA",    kind="dynamic"),
        RiskArea(id="ia_humano_no_loop",   name="Humano no loop / Validação",    kind="dynamic"),
        RiskArea(id="ia_dados_treinamento",name="Dados de treinamento / Drift",  kind="dynamic"),
    ],
    "mobile": [
        RiskArea(id="mobile_plataformas",  name="iOS / Android / Multiplataforma", kind="dynamic"),
        RiskArea(id="mobile_offline",      name="Offline / Sincronização",          kind="dynamic"),
    ],
    "lgpd_compliance": [
        RiskArea(id="lgpd_dados_pessoais", name="LGPD / Dados pessoais",  kind="dynamic"),
        RiskArea(id="lgpd_auditoria",      name="Auditoria / Logs de ação", kind="dynamic"),
    ],
    "ecommerce": [
        RiskArea(id="ecommerce_gateway",   name="Gateway de pagamento", kind="dynamic"),
        RiskArea(id="ecommerce_estoque",   name="Gestão de estoque",    kind="dynamic"),
        RiskArea(id="ecommerce_frete",     name="Cálculo de frete",     kind="dynamic"),
    ],
    "gov_integracao": [
        RiskArea(id="gov_homologacao",     name="Homologação / Sandbox gov",    kind="dynamic"),
        RiskArea(id="gov_sla_regulatorio", name="SLA / Mudanças regulatórias",  kind="dynamic"),
    ],
}


class CoverageTracker:
    """Mantém e atualiza o mapa de cobertura de áreas de risco da reunião.

    É o "estado central" do modo realtime: o renderer lê daqui para montar
    o painel, o classificador escreve aqui quando detecta novas informações,
    e o orchestrator consulta is_saturated() para saber quando oferecer o
    relatório.

    Estrutura interna: um dict[str, RiskArea] indexado pelo id da área.
    Usamos dict para acesso O(1) por id — o classificador retorna ids, não nomes.
    """

    # Peso das áreas no cálculo de saturação.
    # Áreas universais valem mais porque são obrigatórias; as dinâmicas são
    # bônus (específicas do tipo de projeto) e pesam menos.
    UNIVERSAL_WEIGHT = 1.0
    DYNAMIC_WEIGHT = 0.5

    # Limite de áreas dinâmicas para evitar que o painel fique grande demais.
    DYNAMIC_AREA_CAP = 12

    def __init__(self) -> None:
        # copy.copy() faz uma cópia rasa de cada RiskArea antes de guardá-la.
        # Sem a cópia, todos os trackers compartilhariam os MESMOS objetos de
        # UNIVERSAL_AREAS — mudar o status em um tracker mudaria em todos.
        self._areas: dict[str, RiskArea] = {
            area.id: copy.copy(area) for area in UNIVERSAL_AREAS
        }

    def get_state(self) -> dict[str, RiskArea]:
        """Retorna uma cópia do estado atual de todas as áreas.

        Retornamos um novo dict (não o interno) para que quem lê não possa
        modificar acidentalmente o estado do tracker por referência.
        """
        return dict(self._areas)

    def update_area(self, area_id: str, status: Status, evidence: str = "") -> None:
        """Atualiza o status e evidência de uma área existente.

        Chamado pelo CoverageClassifier (passo 6) quando o LLM retorna o JSON
        de classificação. Se o area_id não existir, ignora silenciosamente —
        isso pode acontecer se o LLM alucinar um id inválido.
        """
        if area_id not in self._areas:
            return  # id inválido ou área ainda não ativada → descarta

        area = self._areas[area_id]
        area.status = status
        if evidence:
            area.evidence = evidence[:200]  # limita tamanho para não poluir o painel
        area.last_updated = datetime.now()

    def add_dynamic_area(self, area: RiskArea) -> bool:
        """Adiciona uma área dinâmica ou específica ao mapa.

        Retorna True se foi adicionada, False se já existe ou se o cap foi
        atingido. O cap evita que o mapa cresça indefinidamente em reuniões
        muito longas ou com projetos muito complexos.
        """
        # Conta quantas áreas não-universais já existem
        dynamic_count = sum(1 for a in self._areas.values() if a.kind != "universal")
        if dynamic_count >= self.DYNAMIC_AREA_CAP:
            return False  # painel ficaria grande demais
        if area.id in self._areas:
            return False  # área já existe, não duplica
        self._areas[area.id] = area
        return True

    def activate_preset(self, preset_key: str) -> int:
        """Ativa um conjunto pré-definido de áreas dinâmicas por tipo de projeto.

        Ex: activate_preset("ecommerce") adiciona gateway, estoque, frete.
        Retorna quantas áreas foram efetivamente adicionadas (as que já
        existiam são ignoradas pelo add_dynamic_area).
        """
        preset = DYNAMIC_AREA_PRESETS.get(preset_key, [])
        # copy.copy() porque add_dynamic_area guarda a referência diretamente;
        # sem cópia, múltiplos trackers compartilhariam o mesmo objeto.
        added = sum(1 for area in preset if self.add_dynamic_area(copy.copy(area)))
        return added

    def saturation_score(self) -> float:
        """Calcula o score de saturação do diagnóstico. Retorna valor entre 0.0 e 1.0.

        Fórmula: soma dos pesos das áreas "cobertas" / soma total dos pesos.

        - GREEN  → conta 100% do peso da área
        - YELLOW → conta 50% do peso (parcialmente coberta)
        - RED    → conta 0%

        Áreas universais pesam 1.0, dinâmicas pesam 0.5, porque as dinâmicas
        são extras (específicas do tipo de projeto) — não penalizam tanto a
        saturação se ficarem incompletas.

        Exemplo com 8 universais todas verdes e nenhuma dinâmica:
            total_weight = 8 × 1.0 = 8.0
            weighted_covered = 8 × 1.0 = 8.0
            score = 8.0 / 8.0 = 1.0  (100% saturado)
        """
        total_weight = 0.0
        weighted_covered = 0.0

        for area in self._areas.values():
            w = self.UNIVERSAL_WEIGHT if area.kind == "universal" else self.DYNAMIC_WEIGHT
            total_weight += w
            if area.status == Status.GREEN:
                weighted_covered += w          # coberta completamente
            elif area.status == Status.YELLOW:
                weighted_covered += w * 0.5    # coberta pela metade

        # Guarda divisão por zero se não houver áreas (improvável, mas seguro)
        return weighted_covered / total_weight if total_weight > 0 else 0.0

    def is_saturated(self, threshold: float = 0.85) -> bool:
        """Retorna True quando o diagnóstico tem contexto suficiente para o relatório.

        O threshold padrão de 0.85 (85%) foi escolhido para não exigir 100%
        de cobertura — em uma conversa real, algumas áreas irrelevantes ao
        projeto específico podem ficar em RED sem problema.
        """
        return self.saturation_score() >= threshold

    def red_zones(self) -> list[RiskArea]:
        """Retorna todas as áreas que ainda precisam ser investigadas (RED ou YELLOW).

        Usado pelo QuestionPlanner (passo 8) para saber quais perguntas
        priorizar quando o comercial pressiona P.
        """
        return [
            area for area in self._areas.values()
            if area.status in (Status.RED, Status.YELLOW)
        ]

    def universal_areas(self) -> list[RiskArea]:
        """Retorna apenas as 8 áreas universais."""
        return [a for a in self._areas.values() if a.kind == "universal"]

    def dynamic_areas(self) -> list[RiskArea]:
        """Retorna apenas as áreas dinâmicas e específicas."""
        return [a for a in self._areas.values() if a.kind != "universal"]
