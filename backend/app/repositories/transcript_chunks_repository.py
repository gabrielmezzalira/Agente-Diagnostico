# =============================================================================
# repositories/transcript_chunks_repository.py
#
# Responsabilidade única: gravar trechos de transcrição vindos da extensão
# Chrome na tabela transcript_chunks. Sem lógica de negócio.
# =============================================================================

from postgrest.exceptions import APIError
from supabase import Client

# Código SQLSTATE de unique_violation no Postgres.
_UNIQUE_VIOLATION = "23505"


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
        (reenvio da mesma fala, D-19); qualquer outro erro é relançado."""
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
            raise
        return True
