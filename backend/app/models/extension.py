# =============================================================================
# models/extension.py
#
# Schemas Pydantic das rotas da extensão Chrome (Taqciti) sob /webhook/extension.
# Separados por contexto (CLAUDE.md): resposta de listagem, criação e resposta
# de sessão. A listagem expõe SÓ id, client e name — nunca contexto, orçamento
# ou chave (T-08-11 / LGPD).
# =============================================================================

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ExtensionClientResponse(BaseModel):
    id: UUID
    client: str
    name: str


class ExtensionClientCreate(BaseModel):
    """Cliente criado só com o nome (D-08, D-13). Sem chave Gemini."""

    name: str = Field(min_length=1, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        # strip antes da checagem de tamanho: "   " vira "" e é recusado (422).
        return value.strip() if isinstance(value, str) else value


class ExtensionSessionCreate(BaseModel):
    project_id: UUID
    name: Optional[str] = Field(default=None, max_length=200)


class ExtensionSessionResponse(BaseModel):
    id: UUID
