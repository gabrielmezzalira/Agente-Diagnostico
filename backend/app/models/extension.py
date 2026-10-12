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

from pydantic import BaseModel, Field


class ExtensionClientResponse(BaseModel):
    id: UUID
    client: str
    name: str


class ExtensionSessionCreate(BaseModel):
    project_id: UUID
    name: Optional[str] = Field(default=None, max_length=200)


class ExtensionSessionResponse(BaseModel):
    id: UUID
