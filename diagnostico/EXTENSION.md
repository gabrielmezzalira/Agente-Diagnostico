# Como Estender o Agente — Exemplos

A arquitetura segue SOLID, então estender é simples.

## Exemplo 1: Adicionar Novo Modelo Gemini

Para trocar de `gemini-2.0-flash` para `gemini-1.5-pro`:

**Opção A: Variável de Ambiente**
```bash
export GEMINI_MODEL=gemini-1.5-pro
python3 main.py
```

**Opção B: .env**
```bash
GEMINI_MODEL=gemini-1.5-pro
```

Zero mudança de código. Isso é **Open/Closed Principle** em ação.

---

## Exemplo 2: Adicionar novo LLM Provider (OpenAI)

1. Crie `llm/openai_client.py`:

```python
from openai import OpenAI
from .base import LLMClient, Message


class OpenAIClient(LLMClient):
    def __init__(self, api_key: str, model_name: str):
        self._client = OpenAI(api_key=api_key)
        self._model_name = model_name

    def generate(self, messages: list[Message]) -> str:
        system_msg = next((m for m in messages if m.role == "system"), None)
        chat_messages = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role != "system"
        ]
        
        response = self._client.chat.completions.create(
            model=self._model_name,
            messages=chat_messages,
            system=system_msg.content if system_msg else None,
        )
        return response.choices[0].message.content
```

2. Atualize `main.py`:

```python
from llm import OpenAIClient  # ou GeminiClient

def main():
    config = load_config()
    # llm = GeminiClient(...)  # comentado
    llm = OpenAIClient(config.openai_api_key, config.model_name)
    # resto do código continua igual
```

**Nenhuma mudança necessária em**: `agent.py`, `conversation.py`, `report.py`

Isso é **Liskov Substitution Principle** em ação.

---

## Exemplo 3: Adicionar Validação de Inputs

Modifique `agent.py`:

```python
def start(self, project_description: str) -> str:
    if not project_description or len(project_description.strip()) < 10:
        raise ValueError("Descrição muito curta (mínimo 10 caracteres)")
    
    self._conversation.add_message("system", SYSTEM_PROMPT)
    # resto continua igual
```

Apenas `agent.py` muda. Outros módulos nem sabem que validação foi adicionada.

---

## Exemplo 4: Persistir Histórico em JSON

Modifique `conversation.py`:

```python
import json
from pathlib import Path

class ConversationManager:
    def __init__(self, history_file: str | None = None):
        self._history = []
        self._history_file = Path(history_file) if history_file else None
        if self._history_file and self._history_file.exists():
            self._load()
    
    def _save(self):
        if self._history_file:
            data = [{"role": m.role, "content": m.content} for m in self._history]
            self._history_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    
    def _load(self):
        if self._history_file and self._history_file.exists():
            data = json.loads(self._history_file.read_text())
            self._history = [Message(role=d["role"], content=d["content"]) for d in data]
    
    def add_message(self, role: str, content: str) -> None:
        self._history.append(Message(role=role, content=content))
        self._save()
```

Use em `main.py`:

```python
conversation = ConversationManager(history_file="conversation_history.json")
```

---

## Exemplo 5: Adicionar Web Interface com FastAPI

Crie `api.py`:

```python
from fastapi import FastAPI, WebSocket
from contextlib import asynccontextmanager
from config import load_config
from llm import GeminiClient
from conversation import ConversationManager
from report import ReportGenerator
from agent import DiagnosticAgent


app = FastAPI()
agent = None


@app.on_event("startup")
async def startup():
    global agent
    config = load_config()
    llm = GeminiClient(config.gemini_api_key, config.model_name)
    conversation = ConversationManager()
    reporter = ReportGenerator(config.reports_dir)
    agent = DiagnosticAgent(llm, conversation, reporter)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Recebe descrição inicial
    project_desc = await websocket.receive_text()
    response = agent.start(project_desc)
    await websocket.send_text(response)
    
    # Loop de conversa
    while True:
        user_input = await websocket.receive_text()
        if user_input.lower() in ["sair", "exit"]:
            await websocket.send_text("Encerrando.")
            break
        
        response = agent.respond(user_input)
        await websocket.send_text(response)
        
        if agent.offered_report and user_input.lower() in ["sim", "s", "yes"]:
            report, path = agent.generate_report()
            await websocket.send_json({"type": "report", "path": str(path)})
            break


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Execute:
```bash
pip install fastapi uvicorn
python3 api.py
```

E crie um frontend React ou Vue que se conecta via WebSocket.

---

## Princípios de Extensão

Toda extensão segue este padrão:

1. **Identifique a responsabilidade** que quer estender
2. **Modifique apenas o módulo responsável**
3. **Respeite as interfaces** (não quebre `LLMClient.generate()`, etc)
4. **Não toque em outros módulos** (se precisar, a arquitetura não está SOLID)

Exemplos:
- Novo LLM? Modifique `llm/novo_provider.py`
- Novo formato de relatório? Modifique `report.py`
- Nova lógica de perguntas? Modifique `prompts.py` ou `agent.py`
- Persistência? Modifique `conversation.py`
- Validação? Modifique `config.py` ou `agent.py`

Se uma extensão exige mudança em vários módulos, a arquitetura precisa de refactoring.
