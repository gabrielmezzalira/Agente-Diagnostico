# =============================================================================
# coverage/area.py
#
# Define as estruturas de dados básicas para as áreas de risco.
# Este arquivo só tem modelos — zero lógica de negócio aqui.
# =============================================================================

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Literal


class Status(Enum):
    """Estado de cobertura de uma área de risco durante a reunião.

    - RED    → a área ainda NÃO foi tocada em nenhum momento da conversa
    - YELLOW → a área foi mencionada, mas com informação incompleta ou vaga
    - GREEN  → a área foi explorada com profundidade suficiente

    Usamos um Enum (em vez de strings soltas como "red"/"green") para evitar
    erros de digitação e facilitar comparações com == e in.
    """
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"


@dataclass
class RiskArea:
    """Representa uma área de risco que precisa ser investigada no diagnóstico.

    Por que @dataclass?
    O decorador @dataclass gera automaticamente os métodos __init__, __repr__
    e __eq__ com base nos campos declarados. Sem ele, precisaríamos escrever
    todo esse código manualmente — o dataclass elimina esse boilerplate.

    Campos:
        id           → identificador único e estável (ex: "auth_seguranca").
                       Usado como chave no dicionário do CoverageTracker.
        name         → nome legível exibido no painel (ex: "Auth / Segurança").
        kind         → tipo da área:
                         "universal" → presente em TODO projeto, sempre ativa
                         "dynamic"   → ativada quando a IA detecta o tipo do
                                       projeto (ex: detectou e-commerce → ativa
                                       sub-áreas de gateway, estoque, frete)
                         "specific"  → criada pela IA para projetos atípicos
                                       que não se encaixam em nenhuma categoria
        status       → cobertura atual: RED / YELLOW / GREEN
        evidence     → trecho curto da transcrição que justificou o status.
                       Limitado a 200 chars para não poluir o painel.
        last_updated → timestamp da última vez que o status foi alterado.
                       Usado para saber quando uma área foi "tocada".
    """
    id: str
    name: str

    # Literal["a", "b", "c"] restringe o tipo a exatamente esses três valores.
    # O type checker (mypy/pyright) vai avisar se passar qualquer outra string.
    kind: Literal["universal", "dynamic", "specific"] = "universal"

    # field(default=...) é necessário para campos com valores padrão que vêm
    # DEPOIS de campos sem padrão. O Python exige essa sintaxe em dataclasses
    # para evitar ambiguidade na ordem dos argumentos do __init__ gerado.
    status: Status = field(default=Status.RED)

    evidence: str = ""

    # default_factory=datetime.now significa: "chame datetime.now() no momento
    # em que o objeto for criado". Se usássemos default=datetime.now() (sem
    # factory), TODOS os objetos teriam o mesmo timestamp — o do momento em
    # que o módulo foi importado. Com factory, cada instância tem o seu próprio.
    last_updated: datetime = field(default_factory=datetime.now)
