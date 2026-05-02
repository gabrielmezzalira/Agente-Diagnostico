# Contribuindo — Agente de Diagnóstico CITi

## Visão Geral

Este projeto é um agente que assiste o time comercial do CITi durante reuniões com clientes. Um bot entra na chamada via Recall.ai, captura a transcrição em tempo real (a partir das legendas geradas pelo Google Meet), e o agente analisa a conversa ao vivo, detectando red flags e sugerindo perguntas técnicas.

---

## Arquitetura

```
Google Meet
    |
    | (legendas / transcrição nativa)
    |
Recall.ai bot         ← entra na reunião e captura a transcrição
    |
    | POST /transcription  (JSON com chunks de texto)
    |
  ngrok               ← túnel HTTPS que expõe o servidor local à internet
    |
localhost:8765
    |
webhook_server.py     ← servidor HTTP que recebe os chunks
    |
RealtimeOrchestrator  ← coordena todas as tasks assíncronas
    |         |              |
 Gemini   CoverageTracker  RedFlagDetector
 (LLM)   (mapa de riscos) (alertas ao vivo)
    |
WebRenderer           ← painel no browser (http://127.0.0.1:8080)
```

### Como a transcrição chega

O Recall.ai manda um bot entrar na reunião do Google Meet. Esse bot captura as legendas geradas automaticamente pelo Meet e as envia em tempo real via HTTP POST para o webhook local (exposto pelo ngrok). Cada POST carrega um chunk de texto com o speaker e o timestamp.

O servidor local (`webhook_server.py`) recebe esses chunks, filtra os parciais (ainda sendo ditados) e coloca os finais numa fila assíncrona. O `RealtimeOrchestrator` drena essa fila e distribui para os componentes de análise.

### Componentes principais

| Arquivo | Responsabilidade |
|---|---|
| `main.py` | Ponto de entrada, parsing de argumentos |
| `realtime_agent.py` | Orquestra todas as tasks assíncronas |
| `transcription/webhook_server.py` | Servidor HTTP local que recebe chunks do Recall.ai |
| `transcription/webhook_source.py` | Adapta a fila interna como stream assíncrono (`--source webhook`) |
| `coverage/tracker.py` | Rastreia quais áreas de risco já foram cobertas |
| `analysis/red_flag.py` | Detecta alertas críticos no transcript |
| `analysis/question_planner.py` | Sugere perguntas com base nas lacunas |
| `ui/web_renderer.py` | Painel web via WebSocket |
| `agent.py` | Modo interativo (entrevista por texto, sem reunião) |
| `llm/gemini_client.py` | Cliente da API Gemini |


---

## Pré-requisitos

- Python 3.11+
- Conta no [Google AI Studio](https://aistudio.google.com/apikey) — para a `GEMINI_API_KEY`
- Conta no [Recall.ai](https://www.recall.ai) — token da API para mandar o bot entrar nas reuniões
- [ngrok](https://ngrok.com) instalado e autenticado — para expor o servidor local à internet

---

## Instalação

```bash
cd diagnostico/
pip3 install -r requirements.txt
```

Crie um arquivo `.env` baseado no template:

```bash
cp .env.example .env
```

Preencha o `.env`:

```env
GEMINI_API_KEY=sua-chave-do-google-ai-studio
```

---

## Como Rodar

### Modo 1 — Entrevista por texto (sem reunião)

Modo interativo simples: você digita as respostas do cliente manualmente no terminal.

```bash
python3 main.py
```

### Modo 2 — Tempo real com reunião (fluxo completo)

Requer ngrok, Recall.ai e `GEMINI_API_KEY` configurados.

**Passo 1 — Expor o webhook local:**

```bash
ngrok http 8765
```

Anote a URL gerada (ex: `https://xxxx.ngrok-free.app`).

**Passo 2 — Iniciar o agente:**

```bash
python3 main.py --mode realtime --source webhook --ui web
```

O painel abre em `http://127.0.0.1:8080`.

**Passo 3 — Mandar o bot entrar na reunião via Recall.ai:**

```bash
curl -X POST https://us-east-1.recall.ai/api/v1/bot \
  -H "Authorization: Token SEU_TOKEN_RECALL_AI" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_url": "URL_DA_REUNIAO",
    "bot_name": "CITi Diagnóstico",
    "transcription_options": { "provider": "default" },
    "real_time_transcription": {
      "destination_url": "https://xxxx.ngrok-free.app/transcription",
      "partial_results": false
    }
  }'
```

Substitua `SEU_TOKEN_RECALL_AI`, `URL_DA_REUNIAO` e o domínio do ngrok pelos valores reais.

O bot aparece na reunião como participante, captura as legendas do Google Meet e começa a enviar chunks para o agente automaticamente.

### Modo 3 — Tempo real sem reunião (simulação local)

Útil para desenvolvimento e testes sem precisar do Recall.ai ou ngrok.

```bash
# Terminal 1 — agente
python3 main.py --mode realtime --source webhook --ui web

# Terminal 2 — simulador de transcrição
python3 scripts/simulate_transcript.py
```

O simulador lê o arquivo `fixtures/reuniao_ecommerce.jsonl` e envia os chunks diretamente para o servidor local, reproduzindo uma reunião gravada.

---

## Controles do Painel Web

| Tecla / Botão | Ação |
|---|---|
| P | Atualiza sugestões de perguntas |
| R | Gera e salva o relatório em `reports/` |
| S | Força sincronização do mapa de cobertura |
| Q | Encerra o agente |

---

## Adicionando um Novo Provider de LLM

1. Crie `llm/novo_provider.py` implementando `LLMClient`:

```python
from llm.base import LLMClient, Message

class NovoProvider(LLMClient):
    def generate(self, messages: list[Message]) -> str:
        # sua implementação
```

2. Use em `main.py` no lugar de `GeminiClient`. Nenhum outro arquivo precisa mudar.

---

## Variáveis de Ambiente

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `GEMINI_API_KEY` | Sim | — | Chave da API do Google AI Studio |
| `GEMINI_MODEL` | Não | `gemini-2.0-flash` | Modelo Gemini a usar |
| `REPORTS_DIR` | Não | `reports` | Pasta onde os relatórios são salvos |
