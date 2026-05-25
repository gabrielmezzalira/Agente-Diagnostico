# =============================================================================
# database.py
#
# Responsabilidade única: fornecer um cliente Supabase singleton.
#
# Padrão: module-level _supabase singleton, inicializado uma única vez em
# get_supabase(). Segue o padrão singleton do ConversationManager da v1
# (diagnostico/conversation.py), adaptado para o cliente Supabase.
# =============================================================================

import os
from supabase import create_client, Client

# Singleton — inicializado na primeira chamada de get_supabase()
_supabase: Client | None = None


def get_supabase() -> Client:
    """Retorna o cliente Supabase singleton.

    Na primeira chamada, lê SUPABASE_URL e SUPABASE_KEY do ambiente,
    cria o cliente via create_client() e armazena na variável de módulo
    _supabase. Chamadas subsequentes retornam o cliente já criado.

    Lança RuntimeError se as variáveis de ambiente não estiverem definidas —
    fail fast antes de qualquer chamada ao banco.

    Returns:
        Client: cliente Supabase pronto para uso.

    Raises:
        RuntimeError: se SUPABASE_URL ou SUPABASE_KEY não estiver definida.
    """
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set. "
                "Check backend/.env"
            )
        _supabase = create_client(url, key)
    return _supabase
