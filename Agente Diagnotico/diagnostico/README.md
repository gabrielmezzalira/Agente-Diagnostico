# Agente de Diagnóstico Técnico — CITi

Um agente inteligente que conduz entrevistas técnicas profundas para diagnosticar riscos e complexidade de projetos antes de fechá-los com clientes.

## Motivação

O time comercial do CITi frequentemente fecha projetos sem análise técnica profunda, resultando em "projetos bomba" — projetos muito mais complexos do que o previsto, com stacks erradas e retrabalho massivo.

Este agente atua como um **tech lead sênior queimado por projeto bomba**, aprofundando onde há risco e gerando um relatório estruturado com recomendações arquiteturais concretas.

## Instalação

1. **Clone ou entre no diretório do projeto:**
   ```bash
   cd diagnostico/
   ```

2. **Configure a variável de ambiente com sua chave Gemini:**
   ```bash
   export GEMINI_API_KEY=sua-chave-aqui
   ```

   Ou copie `.env.example` para `.env` e preencha:
   ```bash
   cp .env.example .env
   # Edite .env com sua chave
   ```

3. **Instale dependências:**
   ```bash
   pip3 install -r requirements.txt
   ```

## Uso

```bash
python3 main.py
```

O agente:
1. Pede uma descrição breve do projeto
2. Conduz uma entrevista com perguntas técnicas (uma por vez)
3. Aprofunda onde detecta riscos
4. Quando tem contexto suficiente, oferece gerar o relatório
5. Gera relatório em Markdown e salva em `reports/diagnostico_YYYYMMDD_HHMMSS.md`

### Exemplos de Resposta

- Descrever: `"Extrair dados de PDFs de operadoras de saúde e salvar em banco de dados"`
- Responder perguntas técnicas com clareza máxima
- Confirmar geração de relatório: `sim`, `s`, `gerar`, `pode`, `claro`
- Sair a qualquer momento: `sair`, `exit`, `quit`

## Arquitetura (SOLID)

```
config.py          # Carrega variáveis de ambiente
llm/base.py        # Interface abstrata LLMClient + dataclass Message
llm/gemini_client.py # Implementação Gemini
conversation.py    # Gerencia histórico de mensagens
report.py          # Gera e salva relatório
prompts.py         # System prompt + report template
agent.py           # DiagnosticAgent (orquestra entrevista)
main.py            # CLI loop
```

### Princípios SOLID

- **Single Responsibility**: Cada módulo tem uma responsabilidade única
- **Open/Closed**: Trocar modelo ou adicionar novo LLM não quebra outros módulos
- **Liskov Substitution**: `GeminiClient` substitui `LLMClient` sem quebrar contrato
- **Interface Segregation**: Interfaces pequenas e focadas (`LLMClient.generate()`)
- **Dependency Inversion**: `DiagnosticAgent` recebe abstrações por injeção de dependência

## Extensibilidade

Para usar um modelo diferente do Gemini:

1. Crie uma nova classe em `llm/novo_provider.py`:
   ```python
   from llm.base import LLMClient, Message
   
   class NovoProvider(LLMClient):
       def generate(self, messages: list[Message]) -> str:
           # implementação específica
   ```

2. Use em `main.py`:
   ```python
   llm = NovoProvider(...)  # ao invés de GeminiClient
   ```

Nenhuma outra mudança é necessária — a arquitetura é extensível.

## Relatório Gerado

O relatório inclui:

- **Nível de complexidade**: Baixo / Médio / Alto / 🚨 Bomba
- **Stack recomendado**: tecnologias específicas com justificativa
- **Arquitetura**: fluxo de dados, componentes, responsabilidades
- **Armadilhas**: possíveis erros que o time pode cometer
- **Alternativas descartadas**: por quê certas tecnologias foram rejeitadas
- **Riscos**: lista priorizada de pontos de atenção
- **Perguntas em aberto**: o que ainda precisa ser respondido
- **Recomendação final**: ✅ Pode fechar / ⚠️ Fechar com cautela / ❌ Não fechar

## Notas

- Todos os relatórios são salvos com timestamp em `reports/`
- O agente mantém histórico completo para evitar repetições
- Red flags (⚠️, 🚨) são sinalizados durante a conversa, não apenas no relatório
- Prompts são configuráveis em `prompts.py` para ajustes futuros
