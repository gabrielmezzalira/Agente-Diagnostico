# Agente de Diagnóstico CITi — Documentação para Claude Code

## O Projeto

Um agente conversacional que conduz entrevistas técnicas para diagnosticar riscos e complexidade de projetos antes de fechá-los. Atua como um tech lead sênior que já foi queimado por "projetos bomba".

## Estrutura

```
diagnostico/
├── main.py              # entrypoint CLI
├── agent.py             # DiagnosticAgent (orquestra entrevista)
├── llm/
│   ├── base.py          # LLMClient (ABC) + Message (dataclass)
│   └── gemini_client.py # GeminiClient (implementação Gemini)
├── conversation.py      # ConversationManager (histórico)
├── report.py            # ReportGenerator (salva .md com timestamp)
├── config.py            # Config + load_config() (env vars)
├── prompts.py           # SYSTEM_PROMPT + REPORT_PROMPT (constantes)
├── requirements.txt     # google-generativeai>=0.8.0, python-dotenv
├── .env.example         # template GEMINI_API_KEY
└── README.md            # documentação de uso
```

## Princípios de Design

### SOLID

1. **Single Responsibility** 
   - `config.py`: apenas lê variáveis de ambiente
   - `llm/`: apenas abstração + implementação do provider
   - `conversation.py`: apenas gerencia histórico
   - `report.py`: apenas gera e salva relatório
   - `agent.py`: apenas orquestra a entrevista

2. **Open/Closed**
   - Para trocar de modelo (gemini-flash para gemini-pro): mude config ou variável de ambiente
   - Para trocar de provider (Gemini → OpenAI): crie `llm/openai_client.py`, use em `main.py`, pronto

3. **Liskov Substitution**
   - `GeminiClient` é substitível por qualquer outra classe que implemente `LLMClient`
   - Contrato: `generate(messages: list[Message]) -> str`

4. **Interface Segregation**
   - `LLMClient` tem apenas `generate()`
   - `ReportGenerator` tem apenas `save()`
   - Sem classes "faz-tudo"

5. **Dependency Inversion**
   - `DiagnosticAgent` recebe `LLMClient`, `ConversationManager`, `ReportGenerator` por injeção
   - Não cria essas instâncias internamente
   - Depende de abstrações, não de implementações

## Fluxo do Agente

1. **Inicialização**
   - `main.py` carrega config (GEMINI_API_KEY)
   - Cria instâncias: `GeminiClient`, `ConversationManager`, `ReportGenerator`, `DiagnosticAgent`
   
2. **Entrevista**
   - User fornece descrição do projeto
   - `agent.start()` injeta system prompt + descrição → gera primeira pergunta
   - Loop: user responde → `agent.respond()` → agente faz próxima pergunta
   
3. **Detecção de Relatório**
   - `agent.respond()` verifica se a resposta contém "posso gerar o relatório"
   - Se sim, seta `agent.offered_report = True`
   - User confirma → `agent.generate_report()`
   
4. **Geração de Relatório**
   - Injeta `REPORT_PROMPT` no fim do histórico
   - LLM gera relatório estruturado
   - `ReportGenerator.save()` escreve em `reports/diagnostico_YYYYMMDD_HHMMSS.md`

## Comportamento do Agente (System Prompt)

O agente é instruído a:
- Fazer apenas UMA pergunta por vez
- NÃO sugerir tecnologias antes de entender o problema
- Sinalizar red flags (⚠️, 🚨) na conversa imediatamente
- Aprofundar onde há risco (não seguir roteiro fixo)
- Usar tudo que foi dito para perguntas cada vez mais específicas
- Nunca repetir terreno já coberto
- Ser direto e técnico
- Propor relatório quando tiver ~8-15 áreas investigadas

## Áreas de Risco Investigadas

Base para as perguntas (adaptadas ao projeto específico):
- Variabilidade de inputs (arquivos, APIs externas, dados não padronizados)
- Integrações com terceiros/legados (documentação? sandbox? SLA?)
- Autenticação/autorização (SSO, OAuth, multi-tenant, permissões)
- Volume e performance (usuários, transações, latência)
- Clareza do cliente (alguém técnico? designs? regras documentadas?)
- Dependências externas (órgãos públicos, terceiros)
- Prazo vs complexidade
- Validação de output (automático ou com humano no loop?)
- Tolerância a erro (99%? 95%? 100%?)
- Escalabilidade futura (cliente quer crescer?)

## Relatório Gerado

Formato Markdown estruturado:

```markdown
# RELATÓRIO DE DIAGNÓSTICO TÉCNICO — CITi

**Data:** [data]

## 1. NÍVEL DE COMPLEXIDADE
Baixo / Médio / Alto / 🚨 Bomba + justificativa

## 2. STACK E ARQUITETURA
- 2.1 Tecnologias específicas
- 2.2 Arquitetura de componentes
- 2.3 Armadilhas de arquitetura
- 2.4 Alternativas descartadas

## 3. PRINCIPAIS RISCOS
[Lista priorizada]

## 4. PERGUNTAS SEM RESPOSTA
[O que falta antes de fechar]

## 5. RECOMENDAÇÃO FINAL
✅ Pode fechar / ⚠️ Fechar com cautela / ❌ Não fechar
```

## Como Usar

```bash
cd diagnostico/
export GEMINI_API_KEY=sua-chave
python3 main.py
```

## Testes e Validação

Não há testes automatizados implementados por enquanto. Para testar:

1. Validar imports (já feito): `python3 -c "from config import *; from agent import *; ..."`
2. Teste manual: fornecer descrição de projeto, responder perguntas, gerar relatório
3. Verificar arquivo gerado em `reports/`

## Dependências

```
google-generativeai>=0.8.0    # SDK Gemini (deprecated, mas funcional)
python-dotenv>=1.0.0          # Carrega .env (opcional em prod)
```

## Possíveis Extensões Futuras

1. **Novo LLM Provider**
   - Criar `llm/openai_client.py`, `llm/claude_client.py`, etc.
   - Implementar `LLMClient`
   - Usar em `main.py`

2. **Persistência**
   - Salvar histórico de entrevista (JSON)
   - Retomar entrevista interrompida

3. **Validação**
   - Verificar se projeto_description é válido
   - Perguntar novamente se usuário digitar algo vazio

4. **Web Interface**
   - FastAPI com WebSocket para conversa em tempo real
   - Frontend para visualizar relatórios

5. **Banco de Dados**
   - Armazenar entrevistas e relatórios
   - Análise de trends (quais áreas mais problemáticas?)

6. **Migração para novo SDK**
   - Trocar `google.generativeai` por `google.genai` (atualmente deprecated)
   - Seria uma mudança só em `llm/gemini_client.py`

## Notas Importantes

- O agente **não deve ser prescritivo** (não diz "faça assim"). Ele diagra riscos e sugere arquitetura baseada nas descobertas.
- Cada pergunta é feita **uma por vez** para parecer natural.
- O agente rastreia o que foi perguntado (via histórico) para não repetir.
- Red flags são sinalizadas **durante a conversa**, não apenas no relatório final.
- O relatório é **emergente das respostas**, nunca pré-definido.
