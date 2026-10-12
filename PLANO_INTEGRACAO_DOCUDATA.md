# Plano — Integrar o Agente Diagnóstico ao DocuData: contexto cumulativo de Discovery e requisitos por reunião

> Plano no formato obrigatório do `CLAUDE.md` (7 seções). **Nada aqui foi executado.** Fatia 1 da "Esteira Agêntica".
> Escrito em 2026-10-12. O DocuData foi lido por documentação (`CONTEXTO-DOCUDATA.md` de 12/09, `AGENTS.md`,
> `ROADMAP.md`, schema SQL e `import_graph.py`); **o código dos grafos de extração e geração não foi lido** — onde o plano
> depende dele está marcado "(confirmar no código)".

## 0. Contexto e decisões já tomadas

A proposta: um agente que acompanha o projeto do primeiro contato à entrega, com um **registro único** de onde nascem os
entregáveis do Discovery e os documentos do Delivery. O Agente Diagnóstico já acompanha a reunião ao vivo e gera o PRD; o
DocuData já documenta o Delivery sprint a sprint (funcionalidades, kanban, 9 tipos de documento, RBAC). Falta o elo: o que
se descobre **reunião a reunião** virar escopo validado.

Decisões do usuário (2026-10-12):
1. **Dois serviços, um registro.** O banco do DocuData é o registro único; o Agente grava nele pela API. Fusão de código fica para depois.
2. **Primeira fatia:** requisitos por reunião, com revisão e validação.
3. **Pode alterar o DocuData, em branch própria.** (O working tree dele tem trabalho seu não commitado — ver seção 6.)
4. **Insight que molda o desenho:** a reunião **não é uma peça isolada**. Há reunião de contexto da empresa, entrevista técnica,
   validação etc. Todas são analisadas **em conjunto** para achar os requisitos mais (ou menos) importantes; no fim se constroem
   **uma ou mais opções de solução**; **tudo fica armazenado** e **cada agente bebe do contexto todo**.

Correção a uma afirmação anterior: no DocuData, `funcionalidades.status_cliente`, `data_aprovacao_cliente` e `testes_e2e`
estão **órfãs** desde set/2026 (o código não lê nem escreve). A trilha de aprovação por requisito **não existe** lá e entra no nosso trabalho.

## 1. O que muda (em linguagem comum)

Hoje cada reunião do Agente vira um relatório próprio e termina ali. Passa a existir um **caderno do projeto**: cada reunião
acrescenta páginas, e os **requisitos** são fichas que vão ganhando evidências de várias reuniões ("na reunião 1 disseram X;
na 3, o técnico confirmou Y"). Um agente lê o caderno inteiro, sugere o que é importante, e as pessoas decidem: o operacional
que conduziu a reunião revisa, o gerente valida. O que entra vira escopo; o que não entra fica registrado **com o motivo**.

Três consequências práticas:
- o que se descobriu na reunião 1 já aparece como contexto na reunião 5 (perguntas melhores, menos repetição);
- cada requisito sabe **de qual trecho de qual reunião veio**;
- quando o Discovery acaba, os requisitos validados viram as funcionalidades do Delivery **sem redigitar** (o DocuData já tem
  essa estrutura: critério de aceite, prioridade MoSCoW).

O tipo da reunião muda **o que o agente procura**: contexto da empresa → processo atual, dores, atores; entrevista técnica →
integrações, dados, volumetria, restrições; validação → o que foi aceito ou contestado.

## 2. Como vai ser alterado

### 2.1 Modelo de dados novo (DocuData, aditivo, migration manual v9; a v8 é a sub-área Produto)
Tabelas **próprias** de Discovery. Não mexo em `ingestions` (ela tem `sprint_number NOT NULL` e o Discovery não tem sprint)
nem em `funcionalidades` (continua sendo o escopo **validado** do Delivery).

| Tabela | Para quê | Campos principais |
|---|---|---|
| `discovery_reunioes` | uma linha por reunião, qualquer tipo | `project_id`, `tipo` (`contexto_empresa`/`entrevista_tecnica`/`validacao`/`outra`), `origem` (`agente_diagnostico`/`manual`), `fonte_session_id` (único: idempotência), `ocorrida_em`, `conteudo_estruturado` (jsonb: resumo, decisões, problemas, contexto do cliente + áreas cobertas, red flags, perguntas respondidas), `transcricao_ref` |
| `requisitos` | a ficha viva, **cumulativa** | `project_id`, `codigo` (RQ-001), `titulo`, `descricao`, `tipo` (`funcional`/`dados`/`integracao`/`nao_funcional`/`regra_negocio`), `lente`, `criterios_aceite[]` (Dado/Quando/Então), `prioridade_sugerida` (MoSCoW), `justificativa`, `status` (`proposto`/`em_revisao`/`validado`/`rejeitado`), `motivo_decisao`, `revisado_por`, `validado_por`, `funcionalidade_id` (preenchido ao virar escopo) |
| `requisito_evidencias` | N reuniões ↔ N requisitos | `requisito_id`, `reuniao_id`, `trecho`, `speaker`, `confianca` |
| `requisito_transicoes` | histórico (mesmo desenho de `transicoes_status`) | `requisito_id`, `campo`, `de`, `para`, `autor`, `motivo`, `timestamp` |
| `opcoes_solucao` | **fatia 2**: uma ou mais opções | `project_id`, `nome`, `descricao`, `componentes`, `requisito_ids[]`, `premissas`, `riscos`, `status` |

### 2.2 Ordem dos commits
**DocuData** (branch `feat/discovery-requisitos`, cortada da `main`; **sem** tocar nos arquivos que você já tem modificados):
1. Spec `docs/superpowers/specs/NN-discovery-requisitos.md` (a convenção do repo é "uma spec por vez"). Só documento.
2. Migration v9 como bloco **comentado** em `supabase_schema.sql` + SQL de preflight somente-leitura (padrão do arquivo). **Eu não aplico.**
3. Modelos Pydantic e `services/discovery_requisitos.py` (regras puras: mesclar evidência, mudar status, gerar código).
4. Grafo `graphs/requisitos_graph.py` (LangGraph): recebe a reunião nova + **todos os requisitos já existentes** e devolve
   candidatos novos, evidências para requisitos existentes e conflitos. Foco por `tipo` de reunião. Reaproveita o padrão do
   `import_graph.py` (critérios EARS, retry com JSON endurecido, validação). Chave Gemini pelo `services/gemini_key.py`.
5. Router `routers/discovery.py`: `POST /discovery/reunioes` (chave de serviço `require_app_key`, idempotente por
   `fonte_session_id`); `GET /discovery/projetos/{id}/requisitos`; `PATCH .../requisitos/{id}` (revisar/validar, com RBAC);
   `POST .../requisitos/{id}/promover` (cria a `funcionalidade`); `GET .../contexto` (o contexto cumulativo compilado).
6. Testes com mocks (RBAC, idempotência, mesclagem, conflito, promoção). Sem Supabase nem Gemini reais.
7. **Fatia 1b (UI):** aba "Requisitos" no Next.js (lista, evidências, revisar/validar, rejeitar com motivo).

**Agente Diagnóstico** (branch `feat/integracao-docudata`, cortada da `main`):
8. `DocudataClient` como porta + adaptador HTTP (DIP: o service só conhece a interface), config `DOCUDATA_URL` e `DOCUDATA_APP_KEY` via env.
9. Vínculo projeto ↔ projeto do DocuData: coluna aditiva `projects.docudata_project_id` (migration manual no Supabase do Agente).
10. Envio ao **encerrar** uma sessão de discovery: monta o pacote (conteúdo estruturado + evidências) e envia em segundo plano,
    idempotente por `session_id`, com nova tentativa; falhar **nunca** quebra o encerramento da sessão.
11. **Fatia 2:** puxar `GET /discovery/.../contexto` para preencher o contexto pré-reunião e alimentar os planejadores de perguntas
    (fecha o ciclo: o contexto acumulado volta para a reunião ao vivo). Depois: opções de solução e documentos (diagnóstico,
    desenho da solução, business case, PRD, BPMN) sobre o mesmo contexto.

O que é mecânico: 1, 2 e 8. O que muda comportamento: 5, 10 e 11.

## 3. Riscos de cada ação

| # | Risco concreto |
|---|---|
| 2 | SQL aplicado errado no banco real; colidir com a v7 da "Spec 10" (RBAC) que está em curso |
| 4 | Alucinar requisito sem evidência; duplicar o mesmo requisito reunião após reunião; custo de IA crescendo com o contexto todo |
| 5 | Endpoint com chave de serviço aceitando dado de qualquer projeto; operacional editando o que só o gerente valida; dado de transcrição (pessoal/sensível) saindo do Agente |
| 5 | Reenvio duplicando reunião e requisitos |
| 6 | Teste verde sem provar isolamento por subárea e por projeto |
| 7 | Quebrar a UI atual do DocuData; operacional (que só vê 4 abas) enxergando a aba errada |
| 10 | O envio travar ou derrubar o encerramento; mandar para o projeto errado |
| 11 | Contexto acumulado enorme estourando o prompt dos planejadores |

## 4. Como prevenir

- **2:** SQL idempotente, aditivo, comentado, com preflight somente-leitura; **você** aplica. Conferir a numeração com a Spec 10 antes de fechar a `v9` (e a `v8`).
- **4:** o grafo só devolve requisito **com trecho de evidência** (o código rejeita candidato sem evidência, como as travas do `generation_graph`);
  a mesclagem compara por similaridade **e** exige confirmação humana quando houver dúvida (status `em_revisao`, nunca auto-fusão silenciosa);
  limite de tamanho do contexto + resumo incremental por reunião; delimitar e redigir segredos do conteúdo enviado ao modelo (regra do `AGENTS.md` §5.3).
- **5:** `require_app_key` + o projeto é **carregado no servidor** e validado (regra §3.2 do DocuData); revisar = `operacional`+, validar/promover = `gerente`+,
  checado no backend; chave única `fonte_session_id` para idempotência; limite de tamanho do corpo e rate limit como nos outros endpoints de ingestão.
- **6:** testes cobrindo acesso negado entre projetos/subáreas, idempotência e RBAC por cargo.
- **7:** `npm run build` + teste da aba por cargo; manter o estilo inline atual.
- **10:** fila/retentativa assíncrona, `timeout` curto, o service só marca "enviado" na resposta 2xx; o `docudata_project_id` vem do vínculo, nunca do payload.
- **11:** só os resumos e os requisitos validados/em revisão entram; trechos brutos só sob demanda.

## 5. Como consertar (rollback)

- Cada passo é um commit; `git revert` do commit desfaz só aquele passo. A integração do Agente (8–11) desliga removendo `DOCUDATA_URL`
  (sem a variável, nada é enviado) — **sem deploy de código novo**.
- As tabelas novas são aditivas: reverter o código as deixa inertes. Remover o SQL é decisão sua (nada de `DROP` automático).
- Requisito promovido a funcionalidade por engano: `funcionalidade_id` é nulo-ável e o histórico fica em `requisito_transicoes`; desfazer = apagar a
  funcionalidade e voltar o requisito a `validado`, por uma rota explícita (passo 5).

## 6. Decisões que são do usuário/time

**Decididas em 2026-10-12 (brainstorm):** (1) criar a subárea **Produto já** (Spec 11 do DocuData, separada e feita antes); (2) **chave de serviço dedicada** para o Agente
(`DOCUDATA_DISCOVERY_KEY`); (3) enviar **a transcrição inteira também** (guardada à parte, só `gerente`+ lê, teto de 2 MB, redigida de segredos); (4) **operacional revisa e gerente valida**;
(5) análise cumulativa **incremental + botão "reconsolidar"** (abordagem C). Specs escritas em `Agente-Documentador/docs/superpowers/specs/11-*.md` e `12-*.md` (não commitadas, aguardando revisão).

**Ainda em aberto — DECISÃO EM ABERTO:**

1. **Subárea.** O DocuData só tem `dados` e `dev`, e o Discovery é da subárea de **Produto**. Criar a subárea `produto` mexe em permissões, Google Drive e
   templates por subárea. *Proposta para a fatia 1:* usar projetos `dados` com `arquetipo = consultoria_discovery` (já existe) e decidir `produto` depois.
2. **Quem aplica as migrations v8 e v9** e **quando**, considerando a Spec 10 em andamento. Eu entrego o SQL; não aplico em banco real.
3. **Credencial de serviço.** Reusar o `DOCUDATA_APP_SECRET`/`require_app_key` (hoje marcado como "legado/hook") ou criar uma chave dedicada para o Agente.
4. **Transcrição e LGPD.** O que sai do Agente para o DocuData: só o conteúdo estruturado e trechos de evidência, ou a transcrição inteira? Retenção?
5. **Papéis.** Operacional revisa e gerente valida (proposta), mas o operacional hoje só vê 4 abas e só os projetos em que está cadastrado. A aba "Requisitos" é visível a ele?
6. **Como medir "importância".** Proposta: o modelo sugere MoSCoW + justificativa (frequência entre reuniões, quem disse, dor quantificada); a pessoa decide. Sem nota numérica automática.
7. **Trabalho seu no DocuData.** O working tree tem alterações não commitadas (`metricas.py`, testes, `.planning/*`, `RELATORIO-DOCUDATA.md`). A branch nova preservará tudo isso e eu **não commito esses arquivos**.
   O `AGENTS.md` do DocuData pede "não faça commit/push salvo pedido explícito": entendo que a branch própria autoriza commits locais **nela**; push só se você pedir.
8. **Passo 11 em diante** (opções de solução, documentos e BPMN): ordem e prioridade.

## 7. Verificação (ponta a ponta)

- **Automática:** `python -m pytest` no DocuData e no backend do Agente (mocks; sem banco nem Gemini reais); `npm run build` no front do DocuData; `git diff --check`.
- **Fluxo ponta a ponta (mockado):** encerrar uma sessão de discovery no Agente → o pacote chega em `POST /discovery/reunioes` → aparecem requisitos `proposto`
  com evidências → uma **segunda** reunião reforça um requisito existente (não duplica) → o operacional passa a `em_revisao`, o gerente `validado` →
  promover cria a `funcionalidade`. Reenviar a mesma sessão não cria nada novo.
- **Segurança:** acesso negado entre projetos e entre subáreas; operacional não valida; sem chave de serviço = 401.
- **Teste real mínimo (só com sua autorização):** um projeto de teste no ambiente de desenvolvimento, com o SQL aplicado por você.
- **Sementes de teste:** um teste novo por módulo (passos 3, 4, 5, 8 e 10).
