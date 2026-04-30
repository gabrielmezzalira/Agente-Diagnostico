# =============================================================================
# transcription/buffer.py
#
# TranscriptBuffer: acumulador de chunks de transcrição.
#
# Por que precisamos de um buffer?
# O classificador (passo 6) não vai rodar a cada chunk individual — isso seria
# caríssimo em chamadas de LLM. Em vez disso, ele roda em intervalos (ex: a
# cada 30s) e processa um "janela" de chunks acumulados desde a última vez.
# O TranscriptBuffer gerencia esse acúmulo e expõe a janela relevante.
# =============================================================================

from datetime import datetime

from .base import TranscriptChunk


class TranscriptBuffer:
    """Acumula chunks de transcrição e expõe janelas de contexto para análise.

    Responsabilidades:
    1. Guardar todos os chunks recebidos durante a reunião
    2. Rastrear quantos tokens novos chegaram desde o último "flush"
       (para disparar a classificação quando passar de 250 tokens — early trigger)
    3. Retornar o texto recente em formato legível para o LLM
    4. Informar quando foi o último chunk (para o watchdog detectar pause)
    """

    def __init__(self) -> None:
        self._chunks: list[TranscriptChunk] = []

        # Marca o momento do último flush. Chunks posteriores a este timestamp
        # formam a "janela desde o último flush" — são os dados novos que o
        # classificador ainda não processou.
        self._last_flush: datetime = datetime.now()

        # Contador de tokens acumulados desde o último flush.
        # Quando passar de ~250, o orchestrator pode disparar uma classificação
        # antecipada mesmo antes do timer de 30s.
        self._tokens_since_flush: int = 0

    def append(self, chunk: TranscriptChunk) -> None:
        """Adiciona um novo chunk ao buffer e atualiza o contador de tokens."""
        self._chunks.append(chunk)

        # Estimativa de tokens: dividimos as palavras por 0.75 (ou multiplicamos
        # por 4/3). Isso é uma heurística — em inglês/português, 1 token ≈ 0.75
        # palavras na maioria dos tokenizadores (GPT, Gemini). Não é exato, mas
        # é suficiente para o rate-limiting das chamadas ao LLM.
        self._tokens_since_flush += max(1, len(chunk.text.split()) * 4 // 3)

    def window_since_flush(self) -> list[TranscriptChunk]:
        """Retorna os chunks que chegaram desde o último flush.

        Esses são os chunks "novos" que o classificador ainda não processou.
        Enviamos apenas esses (não a transcrição inteira) para economizar tokens
        nas chamadas ao LLM — o classificador mantém estado via CoverageTracker.
        """
        return [chunk for chunk in self._chunks if chunk.ts >= self._last_flush]

    def flush(self) -> None:
        """Marca o timestamp atual como novo ponto de partida da janela.

        Chamado pelo classificador após processar a janela atual. Zera o
        contador de tokens e avança o ponteiro de "último processado".
        """
        self._last_flush = datetime.now()
        self._tokens_since_flush = 0

    def tokens_since_flush(self) -> int:
        """Quantos tokens (estimados) chegaram desde o último flush.

        Usado pelo orchestrator para o "early trigger": se passar de 250 tokens
        antes do timer de 30s, vale rodar o classificador antecipadamente.
        """
        return self._tokens_since_flush

    def recent_text(self, max_tokens: int = 3000) -> str:
        """Retorna os chunks mais recentes em texto formatado, limitado por tokens.

        Por que limitar? Cada chamada ao LLM tem um limite de contexto e tem
        custo. Não precisamos mandar a reunião inteira — apenas os últimos
        ~3000 tokens são suficientes para o classificador entender o contexto.

        Percorre os chunks de trás para frente, vai adicionando até chegar no
        limite, depois reverte a ordem para que o texto fique cronológico.

        Formato: "[speaker]: texto da fala"
        """
        selected: list[str] = []
        token_count = 0

        # reversed() itera do mais recente para o mais antigo sem copiar a lista
        for chunk in reversed(self._chunks):
            tokens = max(1, len(chunk.text.split()) * 4 // 3)
            if token_count + tokens > max_tokens:
                break  # passou do limite — para de adicionar
            selected.append(f"[{chunk.speaker}]: {chunk.text}")
            token_count += tokens

        # reversed(selected) porque construímos de trás para frente
        return "\n".join(reversed(selected))

    def last_chunk_at(self) -> datetime | None:
        """Timestamp do chunk mais recente. None se o buffer estiver vazio.

        Usado pelo watchdog para detectar se o stream do Taqtic pausou:
        se agora - last_chunk_at() > 60s, o stream provavelmente caiu.
        """
        return self._chunks[-1].ts if self._chunks else None

    def chunk_count(self) -> int:
        """Número total de chunks recebidos desde o início da sessão."""
        return len(self._chunks)

    def is_empty(self) -> bool:
        """True se nenhum chunk foi recebido ainda."""
        return not self._chunks
