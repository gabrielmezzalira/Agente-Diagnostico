# =============================================================================
# repositories/transcript_chunks_repository.py
#
# Responsabilidade única: gravar trechos de transcrição vindos da extensão
# Chrome na tabela transcript_chunks. Sem lógica de negócio.
# =============================================================================

from postgrest.exceptions import APIError
from supabase import Client

from app.core.exceptions import SessionNotFoundError

# Códigos SQLSTATE do Postgres.
_UNIQUE_VIOLATION = "23505"
# Sessão inexistente (FK de transcript_chunks.session_id) ou id que nem é um UUID
# (invalid_text_representation): nos dois casos não existe sessão para receber a fala.
_FOREIGN_KEY_VIOLATION = "23503"
_INVALID_TEXT_REPRESENTATION = "22P02"
_SESSION_MISSING_CODES = frozenset({_FOREIGN_KEY_VIOLATION, _INVALID_TEXT_REPRESENTATION})


class TranscriptChunksRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def insert_chunk(
        self,
        session_id: str,
        text: str,
        speaker: str | None,
        chunk_id: str | None = None,
    ) -> bool:
        """Grava o trecho. Devolve False se (session_id, chunk_id) já existia
        (reenvio da mesma fala, D-19). Levanta SessionNotFoundError se a sessão não
        existe (ou o id não é UUID); qualquer outro erro é relançado."""
        row = {"session_id": session_id, "speaker": speaker, "text": text}
        if chunk_id:
            # Só inclui a chave quando preenchida: clientes antigos e o recall
            # continuam gravando exatamente como antes da migração.
            row["chunk_id"] = chunk_id
        try:
            self._db.table("transcript_chunks").insert(row).execute()
        except APIError as exc:
            if exc.code == _UNIQUE_VIOLATION:
                return False
            if exc.code in _SESSION_MISSING_CODES:
                raise SessionNotFoundError(session_id) from exc
            raise
        return True
