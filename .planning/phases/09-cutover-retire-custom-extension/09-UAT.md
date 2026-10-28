---
status: testing
phase: 09-cutover-retire-custom-extension
source: [09-02-PLAN.md, 09-03-PLAN.md, 09-07-PLAN.md]
started: 2026-10-27T17:00:00.000Z
updated: 2026-10-27T18:00:00.000Z
gate_d02: pendente
---

# valores possíveis de gate_d02: pendente -> aguardando-aprovacao -> aprovado, ou reprovado.
# Só o plano 09-03 muda esta chave. A remoção da extensão antiga (09-05) só roda com gate_d02 = aprovado (D-02).

## Current Test

número: 2
nome: Pré: Taqciti local (taqciti/dist) apontando para o backend local, com o envio ligado
expected: ver o teste 2 abaixo
awaiting: recarregar a Taqciti em chrome://extensions a partir de taqciti/dist e conferir a tela do Agente (checkpoint do plano 09-02, Task 3)

> **Re-decisão do usuário (2026-10-27): prova LOCAL primeiro, deploy depois.** Os testes 1 e 2 conferem o ambiente
> local (backend e web app desta branch no computador da prova, e a build local da Taqciti). O que só a produção prova
> (deploy, release com a URL de produção) está em `## Depois do deploy (fora da Fase 9)`, no fim deste arquivo.

## Tests

### 1. Pré: backend e web app LOCAIS com Fases 7-8 (D-13, re-decisão de 2026-10-27)
expected: O backend desta branch roda em `127.0.0.1:8000` (a rota `/webhook/extension/sessions` aparece no `openapi.json`) e o web app local (`localhost:5173`) fala com esse backend, não com produção. No `backend/.env` local, conferido pelo usuário: GEMINI_API_KEY existe; EXTENSION_SHARED_KEY está ausente ou sem valor (D-08); o projeto Supabase usado está identificado (produção ou outro); a situação de DOCUDATA_URL está decidida antes da prova. Só os NOMES das variáveis aparecem aqui, nunca valores.
result: pass
evidence:
data: 2026-10-27
ambiente: local
branch: feat/fase-09-cutover-retire-custom-extension
codigo_commit: 0a4b792
health: ok
openapi_webhook_sessions: 2
web_api: http://localhost:8000 (log do backend local recebeu `GET /projects/ 200` depois do F5 no web app; o web app local fala com o backend local, não com produção)
banco: producao (Agente-Diagnostico, ref fzvwtkipzxdnubprvfct)
variaveis (só nomes, conferido pelo usuário no backend/.env local):
- GEMINI_API_KEY: presente
- EXTENSION_SHARED_KEY: ausente (D-08)
- DOCUDATA_URL: ausente; sem exportação ao DocuData nesta prova, a ligação com o DocuData fica para a Fase 10 ou depois (decisão do usuário)
nota: o banco é o de produção (confirmado por select somente leitura: cliente real visus e as 2 sessões da Fase 8 estão lá); os SQLs da prova e da limpeza rodam nesse projeto.

### 2. Pré: Taqciti local (taqciti/dist) apontando para o backend local, com o envio ligado
expected: A build de `taqciti/dist` foi feita a partir do commit atual desta branch com `VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000` e `VITE_AGENTE_STREAMING_ENABLED=true`; o endereço `127.0.0.1:8000` aparece nos arquivos `assets/*.js`; no Chrome da prova, a Taqciti está carregada da pasta `taqciti/dist` deste repo e a tela do Agente mostra `http://127.0.0.1:8000` com o envio ligado.
result: pending
evidence:

### 3. SC1-1 transcrição só pela Taqciti, sessão source=extension, mode discovery, toda fala com chunk_id
expected: A sessão da prova tem `source='extension'`, o projeto está em `mode='discovery'` e o cliente começa com `ZZ-TESTE`; há falas e `com_chunk_id = falas` (a extensão antiga nunca mandava `chunk_id`, então isso prova que só a Taqciti transmitiu). Se alguma fala tiver `chunk_id` nulo, investigar antes de aprovar.
result: pending
evidence:

SQL (somente leitura; trocar `:sid` pelo id da sessão que aparece na URL `/sessions/<id>` do web app):

```sql
select s.id, s.status, s.source, s.started_at, s.finished_at, p.client, p.mode, p.source as project_source
from sessions s join projects p on p.id = s.project_id where s.id = ':sid';
-- esperado: source='extension', mode='discovery', client começa com 'ZZ-TESTE'

select count(*) as falas, count(chunk_id) as com_chunk_id, count(distinct speaker) as falantes,
       min(timestamp), max(timestamp)
from transcript_chunks where session_id = ':sid';
-- esperado: falas > 0 e com_chunk_id = falas
```

### 4. SC1-2 coverage_snapshots >= 1 e perguntas das lentes produto E dados
expected: Existe pelo menos 1 snapshot de cobertura e há perguntas com `lens='produto'` E com `lens='dados'` (qualquer status: fila, fixada, usada, descartada ou expirada conta).
result: pending
evidence:

SQL (somente leitura):

```sql
select count(*) as snapshots, min(snapshot_at), max(snapshot_at) from coverage_snapshots where session_id = ':sid';
-- esperado: snapshots >= 1

select lens, status, count(*) from questions where session_id = ':sid' group by lens, status order by lens, status;
-- esperado: linhas para lens='produto' E lens='dados'
```

### 5. SC1-3 relatório de discovery (botão Gerar PRD da página do projeto, com a sessão ainda ativa) salvo em reports com 6.3, 7.3 e seção 11
expected: Há pelo menos 1 linha em `reports` para a sessão, gerada pelo botão "Gerar PRD" da página do projeto com a sessão ainda ativa, e as quatro flags abaixo são `true`. Atenção: o relatório de discovery não tem uma seção chamada "Precificação". Os sinais nativos são a subseção 6.3 (backlog + estimativas), a 7.3 (volumetria) e a seção 11 (priorização e faseamento) do PRD (decisão 5 do planejamento: isso é a "seção de precificação" do D-03). A checagem textual diz que a seção existe, não que tem conteúdo; ler o relatório na tela também.
result: pending
evidence:

SQL (somente leitura; é o mesmo `select` que o roteiro manda rodar ANTES de sair da sala):

```sql
select id, status, generated_at, cost_usd, length(markdown_content) as tamanho,
       markdown_content ~ '## 6\. Requisitos funcionais' as tem_sec6,
       markdown_content ~ '6\.3' as tem_backlog_6_3,
       markdown_content ~ '7\.3' as tem_volumetria_7_3,
       markdown_content ~ '## 11\. Prioriza' as tem_faseamento_11
from reports where session_id = ':sid' order by generated_at desc;
-- esperado: >= 1 linha; as quatro flags true (status = 'Rascunho' etc. no discovery)
```

### 6. SC1-4 sair da sala encerra a sessão (DA-4) -> finished
expected: Depois de sair da sala, a sessão fica `finished` com `finished_at` poucos segundos após a última fala. Complemento fora do SQL: o log do backend com `POST /webhook/extension/sessions/<id>/finish 200` e o selo de sessão encerrada no web app.
result: pending
evidence:

SQL (somente leitura):

```sql
select status, finished_at, finished_at - (select max(timestamp) from transcript_chunks where session_id = ':sid') as depois_da_ultima_fala
from sessions where id = ':sid';
-- esperado: status='finished', finished_at preenchido, poucos segundos após sair da sala
```

### 7. Limpeza dos dados de teste (D-04)
expected: Só DEPOIS de `gate_d02: aprovado`: as sessões e o projeto `ZZ-TESTE-F09 <data>` da prova, mais as duas sessões sobrando da Fase 8, são apagados por id conferido (ver a seção "Limpeza" abaixo). O cliente real `visus` continua intacto. Se a sessão da prova foi exportada ao DocuData real, a limpeza também é feita lá (ação externa do time).
result: pending
evidence:

## Roteiro da reunião SC1

Ordem que atende o D-03: a prova só vale se o relatório sair com a sessão ainda ativa e for conferido no banco ANTES de sair da sala. Quem segue o roteiro precisa dos dois pré-requisitos (testes 1 e 2) com `result: pass`.

(a) Remova ou desative a extensão antiga em `chrome://extensions`, no navegador onde a prova vai rodar.

(b) Confira que a Taqciti carregada é a build local de `taqciti/dist` (teste 2) e, na tela "Agente Diagnóstico" da Taqciti, que a URL é `http://127.0.0.1:8000` e que o envio está ligado. Se o perfil já tinha configuração salva, ela prevalece sobre o padrão da build: corrija antes de seguir.

(c) Abra o web app LOCAL (`http://localhost:5173`), com o backend local rodando (teste 1). Os SQLs abaixo rodam no SQL Editor do projeto Supabase anotado no teste 1.

(d) Entre num Meet real, clique na bolha "!" da cápsula, escolha "Selecionar cliente" e crie o cliente `ZZ-TESTE-F09 <data>`.

(e) Fale com vários falantes e frases curtas (o Meet junta fala contínua de uma pessoa só num único trecho), puxando assuntos das DUAS lentes, até ver no web app cobertura e perguntas de Produto e de Dados.

(f) Com a reunião AINDA aberta, em outra aba, abra no web app a página do projeto `ZZ-TESTE-F09 <data>` (lista de projetos, depois o projeto) e ache o cartão "Gerar PRD" (texto "NN% pronto" e a barra "Prontidão para gerar o PRD"). Como funciona, em português simples:

- O número NÃO se atualiza sozinho. Recarregue a página (F5) a cada poucos minutos.
- O botão fica cinza até 65% (`READINESS_THRESHOLD = 0.65` em `backend/app/services/session_state.py`). Passar o mouse no botão cinza pode mostrar a dica "Faltam: ...".
- A prontidão soma quatro partes (`READINESS_WEIGHTS`):
  - 30% = quanto foi coberto da lente MAIS FRACA (Produto ou Dados): por isso é preciso falar das duas.
  - 30% = quanto das 18 áreas foi coberto no total (área coberta conta inteira, parcial conta metade).
  - 20% = volume de conversa: cerca de 2.000 caracteres de transcrição (poucos minutos de fala) OU 3 perguntas marcadas como usadas/fixadas na tela ao vivo.
  - 20% = material para as seções-chave do relatório: alguma cobertura de Produto, alguma de Dados, pelo menos 1 alerta e pelo menos 1 pergunta gerada.
- Conta de bolso: com conversa longa e essas quatro coisas presentes (as duas últimas partes cheias, 40%), falta cobrir mais ou menos metade das áreas de cada lente, ao menos como parcial.
- Áreas de Produto: gargalo/dor, frente de atuação, impacto no usuário, fluxo do processo, fluxo dos dados, desenho da solução, expectativa, viabilidade.
- Áreas de Dados: fontes e qualidade, métricas, LGPD/segurança, quick wins, ciência de dados, análise de dados, engenharia de dados, machine learning, nuvem, automações.
- Para sair um alerta, cite um risco concreto na conversa (ex.: dados só em planilhas manuais, prazo apertado).
- O cartão usa a sessão MAIS RECENTE do projeto: não crie outra sessão no mesmo projeto durante a prova.

(g) Quando o cartão mostrar 65% ou mais, clique "Gerar PRD" com a sessão AINDA ativa (Meet aberto), espere o web app abrir `/sessions/<id>` sem mensagem de erro e anote esse `<id>` (é o id da sessão).

(h) Com o id, rode no SQL Editor do Supabase o `select` do teste 5 (só leitura) e confira pelo menos 1 linha em `reports`. Só então siga: o relatório NÃO é gerado ao sair da sala.

(i) Saia da sala digitando `https://example.com` na mesma aba do Meet e confira, no web app, o selo de sessão encerrada. Depois rode os `select` dos testes 3, 4 e 6 e cole os resultados nos `evidence:`.

Ramo de falha: se a reunião chegar ao fim combinado sem a prontidão chegar a 65%, NÃO gere relatório por nenhum outro caminho (nem pelo "Regenerar" da tela de sessão encerrada, depois de sair: isso inverteria a ordem travada pelo D-03). Saia da sala normalmente e registre `reuniao-falhou: prontidão não chegou a 65% (máximo visto: NN%)`. A rodada conta como falha (o plano 09-03 marca `gate_d02: reprovado`) e repetir a reunião é decisão do time.

Nenhum passo deste roteiro usa o botão manual de relatório da tela ao vivo: em sessão discovery ele fica oculto (`shouldShowManualReportButton` em `frontend/src/lib/lens.ts`).

## Limpeza (só depois do gate aprovado)

Regras: só depois de `gate_d02: aprovado`; sempre `select` antes de `delete`; conferir por ID, nunca por prefixo; sessões primeiro, projeto depois. Nunca use filtro por prefixo do nome do cliente `vis`: ele casaria o cliente real `visus`. Apagar dados é ação em produção: o executor entrega o SQL ao humano ou só roda com confirmação explícita naquele momento.

Listagem (somente leitura):

```sql
select s.id, s.name, s.status, p.client from sessions s join projects p on p.id = s.project_id
where s.id in ('ce75b9af-d3d9-40de-b6e5-00ae38553f91','6cd362ad-cdc1-425f-8aca-d23d6a451d03')
   or p.client like 'ZZ-TESTE%';
select id, client, name from projects where client like 'ZZ-TESTE%';
```

As sessões `ce75b9af-d3d9-40de-b6e5-00ae38553f91` e `6cd362ad-cdc1-425f-8aca-d23d6a451d03` (rodada do 08-28) podem pertencer a um projeto que não é `ZZ-TESTE`: a listagem mostra a qual projeto estão ligadas antes de decidir se o projeto também sai. O projeto antigo `vis` (`bb3b10d7-e15a-4947-a7cc-ec86a5b278a8`) só é apagado por id e só se ainda existir.

Apagar (modelo; substituir pelos ids conferidos na listagem):

```sql
delete from sessions where id in ('<id-da-sessao-1>', '<id-da-sessao-2>');
delete from projects where id in ('<id-do-projeto>') and client like 'ZZ-TESTE%';
```

## Decisões pendentes do time (não agir)

- Release v1.0.0 do GitHub (`gabrielmezzalira/Agente-Diagnostico`) e pasta antiga do Drive: apagar ou manter. O zip antigo continua baixável enquanto a release existir.
- WR-01 / T-08-10 segue aberto por D-08: com `EXTENSION_SHARED_KEY` vazia, `/webhook/extension*` aceita qualquer chamador. A prova e as páginas não devem sugerir que existe chave.
- `.planning/codebase/*.md` está defasado: regenerar depois ou deixar assim (decisão 10 do planejamento).
- Bloco "ID da sessão + copiar" de `SessionActivePage.tsx` mantido (decisão 9 do planejamento); removê-lo seria mudança de comportamento à parte.
- Backend e release dependem de código que, até a data deste roteiro, existe só na `main` LOCAL (196 commits à frente de `origin/main`, nada enviado): o time decide quando publicar na `master`/`origin` para o Railway e a Vercel enxergarem as Fases 7-8. Faz parte de `## Depois do deploy` abaixo.

## Depois do deploy (fora da Fase 9)

Re-decisão do usuário (2026-10-27): a prova SC1 roda localmente e a fase fecha sem deploy. Os itens abaixo NÃO bloqueiam a Fase 9, mas precisam acontecer, nesta ordem, antes de o time usar a Taqciti em produção. Nada aqui é feito pelo executor da fase.

1. Publicar o código: levar a `main` (Fases 7-9) para a `master`/`origin` (decisão do time; ver HANDOFF §2, `chore/sync-main-to-master`).
2. Railway: criar `GEMINI_API_KEY` (lembrete fixo do time), deixar `EXTENSION_SHARED_KEY` sem valor (D-08), decidir `DOCUDATA_URL`. Conferir `GET /health` e `openapi.json` listando `/webhook/extension/sessions`.
3. Vercel: deploy de Production "Ready" no commit da `master` que contém as Fases 7-9 (inclui a página `/extension` nova do 09-04).
4. Repositório original da Taqciti: ANTES de cortar a release, conferir que ele tem o código das Fases 7-8 de `taqciti/` (4 blobs git iguais aos de `main:taqciti/`: `src/shared/config/agenteConfig.ts`, `src/background/agenteStreamer.ts`, `src/background/agenteStreamDestination.ts`, `src/features/agente/association.ts`). Se não tiver, o mecanismo de sincronização é DECISÃO EM ABERTO do time (decisão B).
5. Release da Taqciti: no `release.yml` do repositório ORIGINAL (nunca o do subtree deste repo), acrescentar `VITE_AGENTE_BACKEND_URL: ${{ vars.AGENTE_BACKEND_URL }}` e `VITE_AGENTE_STREAMING_ENABLED: 'true'`, criar a Variable com a URL https do backend do passo 2 e cortar a tag. Conferência (re-decisão de 2026-10-26): o host de produção aparece nos `assets/*.js` da pasta instalada nova; o trecho `("")||"http://localhost:8000"` NÃO aparece (o literal de fallback sozinho é esperado); num perfil LIMPO do Chrome, a tela do Agente mostra a URL de produção e o envio ligado. A conferência completa está no histórico do `09-02-PLAN.md` (Task 3 da versão anterior ao commit desta re-decisão).
6. Ordem de distribuição: a release do passo 5 sai ANTES de avisar o time, porque a página `/extension` nova já aponta para a página de releases.
7. Teste rápido em produção: uma reunião curta com um cliente `ZZ-TESTE-PROD <data>`, confirmando no banco de produção uma sessão `source='extension'` com falas e `chunk_id` em todas; depois, apagar a sessão e o projeto por id (mesma regra da seção Limpeza).
