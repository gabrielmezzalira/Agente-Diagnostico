# =============================================================================
# repositories/transcript_chunks_repository.py
#
# Responsabilidade única: gravar trechos de transcrição vindos da extensão
# Chrome na tabela transcript_chunks. Sem lógica de negócio.
# =============================================================================

from supabase import Client


class TranscriptChunksRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def insert_chunk(self, session_id: str, text: str, speaker: str | None) -> bool:
        self._db.table("transcript_chunks").insert({
            "session_id": session_id,
            "speaker": speaker,
            "text": text,
        }).execute()
        return True
