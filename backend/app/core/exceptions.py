# =============================================================================
# core/exceptions.py
#
# Exceções de domínio compartilhadas entre repositories e routers. Quem
# levanta (repository) não conhece HTTP; quem traduz para resposta (router)
# não conhece o banco.
# =============================================================================


class SessionNotFoundError(Exception):
    """A sessão referenciada não existe (ou o id nem tem formato de UUID)."""

    def __init__(self, session_id: str) -> None:
        super().__init__(f"Session not found: {session_id}")
        self.session_id = session_id
