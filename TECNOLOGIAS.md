# Documentação de Tecnologias — Agente de Diagnóstico CITi

> Formato: **como foi usado** · **alertas/riscos** · **histórico de tempo**

---

## 1. Google Gemini (`google-generativeai`)

### Como foi usado
O Gemini é o LLM central do agente. Toda a inteligência da aplicação — fazer perguntas, detectar red flags, classificar cobertura de áreas de risco e gerar o relatório final — passa pelo Gemini. A integração é feita pelo `GeminiClient` (`llm/gemini_client.py`), que implementa a interface `LLMClient` e é o único arquivo que conhece o SDK.

O modelo padrão é `gemini-2.0-flash` (configurável via `.env`). O fluxo por chamada:
1. Separa mensagens `system` das de `user`/`assistant`
2. Cria o `GenerativeModel` com a `system_instruction` (o `SYSTEM_PROMPT` do agente)
3. Monta o histórico de chat com todos os turnos anteriores
4. Envia a última mensagem via `send_message()` e retorna `response.text`

O mesmo `GeminiClient` é compartilhado por três componentes distintos: `DiagnosticAgent` (entrevista), `CoverageClassifier` (mapa de cobertura) e `RedFlagDetector` (alertas em tempo real). Cada componente manda um histórico diferente — por isso o modelo é criado a cada chamada em vez de no `__init__`.

### Motivo do não uso do langchain/langgraph:

**Prós (o que ganharia):**
- `SystemMessage`, `HumanMessage`, `AIMessage` padronizariam o formato de mensagens — a tradução manual `"assistant"` → `"model"` do Gemini sumiria do `GeminiClient`
- Troca de provider (Gemini → Claude → OpenAI) ficaria mais simples: só mudar o objeto de modelo, sem reescrever o adapter
- LangGraph tornaria o pipeline `CoverageClassifier → RedFlagDetector → QuestionPlanner` mais explícito como grafo de nós com estado tipado

**Contras (por que não foi usado):**
- O modo realtime tem **6 tasks concorrentes** rodando simultaneamente com intervalos independentes (render a cada 0.25s, cobertura a cada 30s, red flag a cada 15s). LangGraph é sequencial/condicional por design — não tem primitiva para esse padrão. Asyncio resolveria por baixo de qualquer forma.
- LangChain instala ~100 sub-pacotes. Para um projeto que usa o SDK do Gemini diretamente com 4 dependências no total, seria dependência desproporcional ao benefício.
- A interface `LLMClient` já cumpre o papel de abstração de provider com um único método `generate()`. Adicionar LangChain substituiria uma classe simples por um framework inteiro para o mesmo resultado.
- O fluxo de streaming contínuo (chunks chegando via webhook, buffer acumulando, classificação disparada por volume de tokens) não mapeia bem para o modelo de execução do LangGraph, que espera inputs discretos por nó.


### Alertas / Riscos
- **SDK deprecado**: o pacote `google-generativeai` está marcado como deprecated pelo Google. A migração deveria ser para `google.genai` (novo SDK), mas ela só impacta `llm/gemini_client.py` — o resto da aplicação não muda.
- **Chamada bloqueante**: `send_message()` é síncrono. No modo realtime isso é contornado com `asyncio.to_thread()` para não bloquear o event loop. Se esquecer o `to_thread`, o painel congela enquanto o LLM responde.
- **Custo por tokens**: o `CoverageClassifier` e o `RedFlagDetector` rodam em intervalos automáticos (30s e 15s). Em reuniões longas, o volume de chamadas ao Gemini pode ser significativo.
- **Alucinação de IDs**: o classificador retorna IDs de áreas de risco em JSON. O `CoverageTracker.update_area()` ignora silenciosamente IDs inválidos — o LLM às vezes alucina nomes de área que não existem.

### Histórico de tempo
- Implementado desde o início do projeto (commit `d240300`, 30/04/2026)
- Modo interativo (entrevista por texto): primeira versão funcional
- Modo realtime com classificação periódica: adicionado na mesma sprint, commit `cf892d3` (01/05/2026)

---

## 2. aiohttp

### Como foi usado
Usado exclusivamente para o servidor de webhook que recebe transcrição do **Recall.ai** (`transcription/webhook_server.py`). O Recall.ai (extensão Chrome para Google Meet) transcreve a reunião em tempo real e envia cada trecho via HTTP POST para `http://127.0.0.1:8765/transcription`.

O `WebhookServer` expõe dois endpoints:
- `POST /transcription` — recebe o chunk de transcrição, valida autenticação (Bearer token opcional), converte via adapter e coloca numa `asyncio.Queue`
- `GET /healthz` — retorna `{"status": "ok"}` com o tamanho atual da fila

A escolha por `aiohttp` em vez de FastAPI/Flask foi intencional: o servidor tem apenas 2 rotas e serve só localmente (loopback). Adicionar FastAPI traria `uvicorn` + `pydantic` sem benefício real para esse caso.

O servidor roda no **mesmo event loop** do `RealtimeOrchestrator`, junto com as tasks de ingestão, render, cobertura e teclado — por isso usa o padrão `AppRunner` + `TCPSite` em vez de `web.run_app()` (que bloquearia o event loop).

### Alertas / Riscos
- **Bind local obrigatório**: o servidor sempre escuta em `127.0.0.1` (loopback). Para receber POSTs do Recall.ai (que roda na nuvem), é necessário expor via **ngrok** — não basta abrir a porta no firewall.
- **Sem autenticação por padrão**: se `TAQTIC_WEBHOOK_SECRET` não estiver no `.env`, qualquer processo local pode mandar chunks. Em desenvolvimento isso é aceitável; em demo com ngrok, configurar o secret.
- **Chunks parciais ignorados**: o handler descarta chunks com `is_final=False` para evitar ruído de classificação. Se o Recall.ai mudar o campo ou o adapter não parsear corretamente, chunks finais podem ser descartados também — monitorar os logs de `WebhookServer`.
- **Queue ilimitada**: `asyncio.Queue(maxsize=0)`. Se o classificador ficar mais lento que a chegada de chunks, a fila cresce sem limite. Improvável em uso normal, mas sem proteção para reuniões muito longas.

### Histórico de tempo
- Adicionado no modo realtime, commit `cf892d3` (01/05/2026)
- Antes disso, a única fonte de transcrição era `stdin` (modo dev)
- `FileTailSource` e `StdinSource` existem como alternativas sem dependência do aiohttp

---

## 3. asyncio (stdlib Python)

### Como foi usado
Base de todo o modo realtime. O `RealtimeOrchestrator` (`realtime_agent.py`) roda **seis tasks concorrentes** no mesmo event loop:

| Task | Intervalo | Responsabilidade |
|---|---|---|
| `_ingestion_task` | contínua | lê chunks do stream e alimenta buffer + conversa |
| `_coverage_task` | 30s (ou 250 tokens novos) | chama `CoverageClassifier` e atualiza mapa |
| `_red_flag_task` | 15s | chama `RedFlagDetector` e emite alertas |
| `_watchdog_task` | 10s | detecta pausa no stream (>60s sem chunk) |
| `_render_task` | 0.25s | redesenha o painel |
| `_web_command_task` | polling | processa comandos vindos da UI web |

Todas as tasks verificam `self._shutdown` (um `asyncio.Event`) para encerrar graciosamente quando o usuário pressiona Q ou o stream fecha.

Chamadas ao LLM (bloqueantes) são despachadas com `asyncio.to_thread()` para não travar o render. A classificação e o planejamento de perguntas são disparados juntos com `asyncio.gather()` quando há contexto novo suficiente.

### Alertas / Riscos
- **Chamadas LLM bloqueantes fora de `to_thread`**: qualquer `llm.generate()` chamado diretamente dentro de uma corrotine congela o event loop inteiro por 1–5 segundos. Todos os pontos críticos já usam `to_thread`, mas atenção em extensões futuras.
- **Shutdown cooperativo**: o `asyncio.Event` de shutdown depende de todas as tasks cooperarem. Se uma task não checar o evento em loop longo, o processo pode demorar para encerrar.
- **`asyncio.gather(..., return_exceptions=True)`**: usado no shutdown para não propagar exceções de tasks canceladas. Isso pode mascarar erros reais — checar os logs após shutdown inesperado.

### Histórico de tempo
- Presente desde o modo interativo (só `asyncio.run()` para chamar o modo realtime)
- Usado intensamente a partir do commit `cf892d3` (01/05/2026) com a chegada do modo realtime completo

---

## 4. rich

### Como foi usado
Responsável pelo painel visual no terminal (`ui/renderer.py` — `CLIRenderer`). O painel é redesenhado 4x por segundo e mostra:

- Mapa de cobertura de áreas de risco (verde/amarelo/vermelho)
- Score de saturação diagnóstica (0–100%)
- Alertas de red flags com nível (warning/critical)
- Sugestões de perguntas geradas pelo `QuestionPlanner`
- Status do stream (pausado/ativo)

O `CLIRenderer` usa `rich.live.Live` + `rich.layout.Layout` para atualizar o terminal sem piscar. A interface web (`WebRenderer`) não usa rich — envia o estado por WebSocket ao browser.

### Alertas / Riscos
- **Conflito com print()**: qualquer `print()` durante `Live.start()` corrompe o terminal. Todo output deve passar pelo `renderer.add_alert()`. O modo interativo (sem rich) usa print normalmente — misturar os dois modos quebraria o painel.
- **TTY obrigatório**: rich precisa de um terminal real. Em pipes (`python3 main.py | tee log.txt`) o `Live` pode se comportar de forma estranha. O `CommandHandler` já tem guarda para `sys.stdin.isatty()`.

### Histórico de tempo
- Adicionado junto com o modo realtime, commit `cf892d3` (01/05/2026)
- O modo interativo legado não usa rich (usa `print()` direto)

---

## 5. python-dotenv

### Como foi usado
Carrega variáveis de ambiente do arquivo `.env` via `load_dotenv()` dentro de `config.py`. As variáveis relevantes:

```
GEMINI_API_KEY=...          # obrigatório para LLM
MODEL_NAME=gemini-2.0-flash # opcional, tem default
REPORTS_DIR=reports         # onde salvar relatórios
TAQTIC_WEBHOOK_SECRET=...   # token de auth do webhook (opcional)
WEBHOOK_HOST=127.0.0.1      # host do servidor webhook
WEBHOOK_PORT=8765           # porta do servidor webhook
```

Em produção ou CI, as variáveis podem ser injetadas diretamente no ambiente sem precisar do `.env` — o `load_dotenv()` não sobrescreve variáveis já definidas.

### Alertas / Riscos
- **`.env` nunca commitado**: o `.env.example` existe como template. O `.env` real contém a API key e não deve ir para o repositório.
- **Sem `.env`, sem LLM**: se `GEMINI_API_KEY` não estiver definida, o modo realtime roda sem classificador (mapa estático). O modo interativo falha com erro explícito.

### Histórico de tempo
- Presente desde o início do projeto (commit `d240300`, 30/04/2026)

---

## 6. Recall.ai (integração externa, não é biblioteca Python)

### Como foi usado
Extensão Chrome que captura o áudio do **Google Meet**, transcreve em tempo real e envia cada frase via HTTP POST para o `WebhookServer` local. É o equivalente ao "microfone" do modo realtime — sem o Recall.ai, a única entrada é stdin (modo dev).

O payload enviado pelo Recall.ai tem o formato:
```json
{
  "session_id": "abc-123",
  "speaker": "client",
  "text": "a gente não tem sandbox do sistema legado...",
  "ts": "2026-04-29T14:32:11Z",
  "is_final": true
}
```

O `_default_adapter` em `webhook_server.py` converte esse JSON em `TranscriptChunk`. O `speaker` identifica quem falou (cliente vs. comercial) — o classificador usa isso para dar mais peso às falas do cliente.

### Alertas / Riscos
- **Exige ngrok**: o Recall.ai é uma extensão cloud que precisa de URL pública para fazer POST. Em desenvolvimento, é necessário expor o servidor local via ngrok (`ngrok http 8765`).
- **Formato pode mudar**: o adapter foi construído para o formato observado durante o desenvolvimento. Se o Recall.ai atualizar o schema do payload, o adapter quebra silenciosamente (retorna 422 e descarta o chunk).
- **Latência de transcrição**: o Recall.ai manda chunks conforme detecta pausas na fala. Frases longas sem pausa chegam como um único chunk ao final — o `EARLY_TRIGGER_TOKENS` (250 tokens) existe para forçar classificação antes do intervalo normal quando o buffer acumula muito.

### Histórico de tempo
- Integrado no commit `cf892d3` (01/05/2026) junto com o modo realtime
- Antes disso, o único modo de input era texto manual pelo terminal

---

## Resumo do histórico de desenvolvimento

| Data | Marco |
|---|---|
| 30/04/2026 | Primeiro commit — modo interativo funcional (Gemini + entrevista por texto + relatório) |
| 01/05/2026 | Modo realtime completo — webhook Recall.ai, mapa de cobertura, red flags, painel rich |
| 01–04/05/2026 | Testes com fixtures e relatórios gerados (`reports/`) |
