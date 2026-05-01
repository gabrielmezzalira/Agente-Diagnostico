# 🚀 Quick Start — Agente de Diagnóstico CITi

## O que foi construído

Um agente de diagnóstico técnico em Python que conduz entrevistas adaptativas para avaliar riscos e complexidade de projetos antes do fechamento com clientes.

## Arquitetura SOLID

Todos os 5 princípios SOLID implementados:
- ✅ Single Responsibility
- ✅ Open/Closed  
- ✅ Liskov Substitution
- ✅ Interface Segregation
- ✅ Dependency Inversion

## Estrutura de Arquivos

```
diagnostico/
├── main.py                 # entrypoint — CLI loop
├── agent.py                # DiagnosticAgent — orquestra entrevista
├── config.py               # lê GEMINI_API_KEY do ambiente
├── conversation.py         # gerencia histórico de mensagens
├── report.py               # gera e salva relatório .md
├── prompts.py              # SYSTEM_PROMPT + REPORT_PROMPT
├── llm/
│   ├── __init__.py
│   ├── base.py             # LLMClient (ABC)
│   └── gemini_client.py    # GeminiClient (implementação Gemini)
├── requirements.txt        # dependências
├── .env.example            # template de configuração
├── README.md               # documentação completa
└── EXTENSION.md            # como estender o agente
```

## Como Usar

### 1️⃣ Instalar dependências

```bash
cd diagnostico/
pip3 install -r requirements.txt
```

### 2️⃣ Configurar chave Gemini

```bash
export GEMINI_API_KEY=sua-chave-gemini-aqui
```

Ou edite `.env.example` → `.env`:
```bash
cp .env.example .env
# Edite .env com sua chave
```

### 3️⃣ Executar o agente

```bash
python3 main.py
```

### 4️⃣ Usar o agente

1. Descreva o projeto brevemente
2. Responda as perguntas do agente (uma por vez, muito precisas)
3. Quando o agente disser "Posso gerar o relatório agora?", confirme com `sim`
4. Relatório é salvo em `reports/diagnostico_YYYYMMDD_HHMMSS.md`

### Exemplo de Conversa

```
Agente: Descreva o projeto:
Você: Preciso extrair dados de PDFs de operadoras de saúde e salvar em banco

Agente: Esses PDFs vêm de quantas operadoras diferentes?
Você: De umas 30-40 operadoras

Agente: ⚠️ RED FLAG: 30-40 operadoras significa 30-40 formatos diferentes de PDF
(continua com perguntas sobre variabilidade...)

Agente: Acho que tenho contexto suficiente. Posso gerar o relatório agora?
Você: sim
```

## O Agente Faz

1. **Uma pergunta por vez** — conversacional, não formulário
2. **Aprofunda em riscos** — não segue roteiro fixo
3. **Sinaliza red flags** — ⚠️ durante a conversa
4. **Nunca repete** — rastreia o que foi perguntado
5. **Gera relatório** com:
   - Nível de complexidade (Baixo/Médio/Alto/🚨 Bomba)
   - Stack recomendado com justificativa
   - Arquitetura de componentes
   - Armadilhas específicas do projeto
   - Riscos prioritizados
   - Recomendação final

## Documentação Completa

- `README.md` — uso e funcionalidades
- `EXTENSION.md` — como adicionar novos LLM providers ou estender
- `CLAUDE.md` — arquitetura e design interno

## Arquitetura (Por Que SOLID?)

Se quiser trocar Gemini por OpenAI:
```python
# Crie llm/openai_client.py
class OpenAIClient(LLMClient):
    def generate(self, messages: list[Message]) -> str:
        # implementação OpenAI
```

Depois use em `main.py`. **Nenhuma mudança em `agent.py`, `conversation.py`, etc.**

Isso é **Liskov Substitution Principle** em ação.

## Próximos Passos

1. **Teste com um projeto real** — veja a qualidade das perguntas e recomendações
2. **Ajuste os prompts** em `prompts.py` conforme feedback do time
3. **Considere persistência** — salvar histórico completo de entrevista (veja `EXTENSION.md`)
4. **Web interface** — FastAPI + WebSocket para usar na web (veja `EXTENSION.md`)
5. **Novo LLM provider** — trocar para Claude, OpenAI, ou outro (veja `EXTENSION.md`)

## Avisos

- ⚠️ O SDK `google.generativeai` está deprecated. Para migrar para `google.genai`: mude apenas `llm/gemini_client.py`
- Relatórios salvos em `reports/` com timestamp — nunca sobrescreve
- Histórico mantido em memória durante a sessão

## Suporte

Toda a lógica está separada em módulos pequenos e testáveis. Se precisar de ajustes:
- Lógica do agente? → `agent.py` + `prompts.py`
- Novo provider? → `llm/novo_provider.py`
- Persistência? → `conversation.py`
- Novo formato de relatório? → `report.py`

Nenhuma função tem mais de 20 linhas. Código limpo e modular.

---

**Divirta-se diagnosticando projetos! 🚀**
