# Fase 9: Cutover + Aposentar a Extensão Customizada - Pesquisa

**Pesquisado em:** 2026-10-26 (sessão de 2026-10-26/27)
**Domínio:** remoção controlada de código legado (extensão Chrome antiga), reescrita de uma página React, regressão de contrato de API (FastAPI/Pydantic) e prova de aceite em produção (Supabase)
**Confiança geral:** ALTA para o inventário e para os testes (tudo lido/executado nesta sessão); MÉDIA para distribuição da Taqciti (depende de repositório e release que não estão neste repo)

> Restrições desta rodada respeitadas: nenhum `git add`/`commit`, nenhuma troca de branch, nenhum `.env` aberto, greps sem `node_modules`, `.claude/worktrees`, `taqciti/server/.next`, `taqciti/dist`, `frontend/dist`. Este arquivo fica **não rastreado**.

<user_constraints>
## User Constraints (de 09-CONTEXT.md)

### Decisões travadas (copiadas do CONTEXT, não reabrir)
- **D-00a:** O rótulo `extension` no backend fica como está: nome da rota `/webhook/extension`, `ExtensionChunk`, valor `extension` do enum `source`, e as rotas da Fase 8 (`/webhook/extension/clients`, `/sessions`, `/sessions/{id}/finish`). Sessões da Taqciti gravam `source=extension`.
- **D-01:** Taqciti validada = UAT da Fase 8 (135/135) + 1 reunião real de ponta a ponta só com a Taqciti, até o relatório final. Sem período de espera.
- **D-02:** A prova SC1 acontece **ANTES** de qualquer remoção; a remoção de `extension/`/zip fica bloqueada até a prova passar (evidência em `09-UAT.md`).
- **D-03:** A prova comprova no banco, todos os quatro: (1) transcrição pela Taqciti com sessão `source=extension`; (2) `coverage_snapshots` + perguntas das lentes produto **e** dados na fila; (3) relatório de discovery em `reports` (com a seção de precificação); (4) sair da sala encerra a sessão (DA-4) → `finished`.
- **D-04:** A prova roda em **produção** (Railway + Vercel) com cliente/projeto `ZZ-TESTE…`, apagado no fim (sessões primeiro, depois o projeto). Nunca apagar o cliente real `visus`.
- **D-05:** Distribuição = instaladores da release (`taqciti/installer/{windows,macos,linux}`, runbook `taqciti/docs/publicar-release.md`), publicados pelo **repositório original da Taqciti** (o `release.yml` do subtree NÃO roda neste repo). A página linka a release de lá.
- **D-06:** `ExtensionPage` reescrita para a Taqciti: mesma rota `/extension`, mesmo item de menu; texto, passos e link novos; nenhuma menção à extensão antiga exceto o aviso de D-11. `EXTENSION_URL` de `frontend/src/lib/labels.ts` é substituído. Reversível por `git revert`.
- **D-07:** A URL do backend de produção do Agente **vem no build** da release (`VITE_AGENTE_*`). A página só ensina a instalar e a vincular a reunião a um cliente (fluxo da Fase 8); não ensina configurar URL.
- **D-08:** Sem chave por enquanto: `EXTENSION_SHARED_KEY` continua **sem valor** no Railway até o login do AGM; ninguém cola `agenteApiKey`. WR-01 da Fase 8 segue aberto (risco T-08-10 aceito). A chave NUNCA vai no bundle (D-10 da Fase 7). A página não menciona chave.
- **D-09:** **Remover de vez** `extension/` e `agente-diagnostico-extension-v1.0.0.zip` via `git rm`, em commits atômicos, depois da prova SC1. Reversível pelo histórico.
- **D-10:** **Limpar referências mortas** fora de `extension/` (links/rótulos de UI para a extensão antiga; comentários que citam caminhos apagados). **NÃO** tocar no contrato do backend nem nos testes que o protegem. Refator de comentário ≠ mudança de comportamento: commits separados.
- **D-11:** A `ExtensionPage` nova traz o aviso: "se você tem a extensão antiga instalada, remova antes de instalar a Taqciti". Comunicação ao time fora do código.
- **D-12:** Documentação que cita `extension/` (`CLAUDE.md` seção 10, `diagnostico/README.md`, `PLANO_AJUSTES.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`) entra num **commit só de docs**. Corrigir também o ROADMAP que ainda diz que a Taqciti "vive em repo separado".
- **D-13:** **Deploy primeiro, depois a prova:** backend com Fases 7-8 + `GEMINI_API_KEY` sobe no Railway antes da reunião SC1 (`EXTENSION_SHARED_KEY` vazia). Deploy é ação humana (checkpoint).
- **D-14:** Instalações antigas que continuarem em uso **seguem funcionando**: o backend não bloqueia chunks da extensão antiga (consequência do SC3).

### Critério do Claude (liberdade)
- Texto exato e layout da `ExtensionPage` reescrita (usar o kit de UI/tema existente).
- Quais testes existentes estender para o SC3 (preferir estender a criar do zero).
- Granularidade dos commits de limpeza (D-10), cada um reversível sozinho.

### Ideias adiadas (FORA DE ESCOPO)
- Renomear "extension" no backend (rota/enum/labels) com migração.
- Bloquear a extensão antiga no backend (rejeitado, D-14).
- Configurar `EXTENSION_SHARED_KEY` e ensinar a colar a chave (adiado até o login do AGM).
- Workflow de release da Taqciti neste repo (rejeitado em favor do repo original).

### DECISÃO EM ABERTO (o planner deve PARAR e pedir ao time)
- URL do repositório original da Taqciti e da release que a página vai linkar.
- Se já existe release da Taqciti buildada com a URL de produção do Agente (`VITE_AGENTE_*`).
- Quem faz o deploy no Railway e quando.
</user_constraints>

<phase_requirements>
## Requisitos da fase

| ID | Descrição | Apoio da pesquisa |
|----|-----------|-------------------|
| TAQ-04 | A extensão customizada antiga é aposentada depois que a Taqciti for validada (cutover). | Inventário completo de referências (Seção "Inventário"); nada em CI/build/deploy depende de `extension/`; SQL de prova do SC1; teste-semente do SC3; riscos e rollback por passo. |
</phase_requirements>

## Resumo

A remoção em si é **barata e segura**: `extension/` é uma pasta isolada (9 arquivos rastreados + `lib/` e `tests/` com `node:test` sem dependências) e o zip é um binário de 9 KB na raiz. Nada no repositório importa, empacota, builda ou roda arquivos dela: não existe `.github/` na raiz (os únicos workflows são os de `taqciti/.github/`, que não rodam neste repo e não citam `extension/`), não existe `package.json` na raiz, o `Dockerfile` copia só `backend/`, os `vercel.json` só fazem rewrite/redirect, e o `frontend/` nunca importa nada de fora de `src/`. Os testes de `extension/tests/` só rodam manualmente (`node --test`) e não estão em CI nenhum.

O trabalho de verdade está em quatro frentes: (1) a **prova SC1 em produção**, que tem 3 pré-requisitos humanos (deploy no Railway, release da Taqciti com a URL certa, link da release); (2) **reescrever a `ExtensionPage`** (hoje 55 linhas, sem teste, e o vitest do frontend roda em ambiente `node` só com `*.test.ts`, então a lógica testável tem que sair do `.tsx`); (3) a **limpeza de referências**: só 2 comentários citam caminhos apagados no código, mais 5 textos de UI que chamam a Taqciti de "Extensão Chrome", e a lista de documentos de D-12 (que ficou incompleta, ver abaixo); (4) o **teste-semente do SC3**, onde os testes existentes já cobrem o modelo e o handler, mas **não** cobrem o registro da rota `POST /webhook/extension` nem o enum `source=extension` nem a leitura de sessão histórica.

Achado que muda o plano: o `release.yml` do subtree da Taqciti **não passa `VITE_AGENTE_BACKEND_URL` nem `VITE_AGENTE_STREAMING_ENABLED`** para o build, e o `check-release-env.sh` não valida nenhum dos dois. Sem isso, a release sai com `http://localhost:8000` e streaming **desligado**. Logo D-07 ("a URL vem no build") exige uma mudança no repositório original da Taqciti antes de cortar a release. Isso reforça o checkpoint humano já previsto.

**Recomendação principal:** executar na ordem: checkpoints humanos (URL do repo, release com `VITE_AGENTE_*`, deploy) → teste-semente SC3 (rede de segurança, antes de apagar qualquer coisa) → prova SC1 e `09-UAT.md` → página nova → `git rm` do zip → `git rm` da pasta → refator de comentários → docs → limpeza dos dados de teste.

## Mapa de responsabilidade arquitetural

| Capacidade | Tier primário | Tier secundário | Justificativa |
|------------|---------------|-----------------|---------------|
| Instruções de instalação da Taqciti | Browser / Client (página React) | CDN / Static (Vercel serve o SPA) | É conteúdo estático; sem chamada de API. |
| Link da release / texto de passos | Browser / Client | — | Constante pura em `lib/`, testável em Node. |
| Contrato `POST /webhook/extension` + `ExtensionChunk` | API / Backend | Database / Storage | Já existe; a fase só **protege** com teste. |
| Enum `source=extension` | API / Backend (Pydantic `Literal`) | Database (coluna `text` sem CHECK) | Sem CHECK no banco: o enum só vive em Pydantic. |
| Prova SC1 (transcrição, cobertura, perguntas, relatório, encerramento) | Database / Storage (evidência) | API / Backend (pipeline) | A evidência é lida no Supabase; a execução é do pipeline. |
| Remoção de `extension/` | Repositório (fora de qualquer tier de runtime) | — | Nenhum runtime depende dela. |

## Stack padrão

Sem pacotes novos. A fase não instala nenhuma dependência externa.

### Em uso (já presentes)
| Biblioteca | Versão | Uso nesta fase | Origem |
|-----------|--------|----------------|--------|
| vitest | ^4.1.7 | testes do frontend (`npm test` = `vitest run`) | [VERIFIED: frontend/package.json] |
| @testing-library/react + jest-dom + user-event | ^16.3.2 / ^6.9.1 / ^14.6.1 | **instalados mas sem uso**: ambiente do vitest é `node` e o `include` é só `src/**/*.test.ts` | [VERIFIED: frontend/package.json, frontend/vite.config.ts] |
| jsdom / happy-dom | ausente | **não instalado** em `frontend/node_modules` | [VERIFIED: ls node_modules] |
| lucide-react | ^1.16.0 | ícones da página | [VERIFIED: frontend/package.json] |
| pytest 9.1.1 / fastapi 0.138.0 / pydantic 2.13.4 | — | testes do SC3 | [VERIFIED: pip list] |

### Alternativas consideradas
| Em vez de | Poderia usar | Tradeoff |
|-----------|--------------|----------|
| Extrair constantes/lógica para `lib/*.ts` e testar em Node | Instalar `jsdom` e testar o `.tsx` com RTL | jsdom é dependência nova + mudança no `vite.config.ts` (`environment`, `include`). Fora do escopo; a extração é SOLID e não mexe em config. |

**Auditoria de legitimidade de pacotes:** nenhum pacote será instalado. Tabela omitida de propósito.

## Inventário completo de referências à extensão antiga (fora de `extension/`)

Método: `grep` por `extension/`, `extension-v1`, nomes de arquivo (`content_meet`, `popup.js`, `normalizeUrl`, `emitNew`, `configFieldGuard`...), e por `extens|Extens` em `frontend/`, `backend/app`, `supabase/`, docs raiz e `.planning/` (fora de `phases/01..08`, que são histórico congelado). Tudo lido nesta sessão.

### (a) UI / rótulo / link morto ou a reescrever

| Arquivo:linha | Texto atual | Situação | Ação |
|---|---|---|---|
| `frontend/src/pages/ExtensionPage.tsx:1-55` | passos de "baixe o .zip / chrome://extensions / Carregar sem compactação", botão "Baixar extensão v1.0.0", título "Extensão Chrome" | **Reescrever inteira** (D-06, D-11) | Commit próprio |
| `frontend/src/lib/labels.ts:18-19` | `export const EXTENSION_URL =` / `'https://github.com/gabrielmezzalira/Agente-Diagnostico/releases/download/v1.0.0/agente-diagnostico-extension-v1.0.0.zip'` | Aponta para o zip antigo. Único uso: `ExtensionPage.tsx:2,41` | Substituir pelo link novo (depende do checkpoint de URL); mesmo commit da página |
| `frontend/src/components/layout/navItems.ts:15` | `{ to: '/extension', label: 'Extensão Chrome' }` | Rota fica (D-06); o rótulo do menu pode virar "Taqciti" | Recomendado: renomear só o `label`, manter `to` |
| `frontend/src/pages/HomePage.tsx:9-20` (`ExtensionBanner`, linhas 14-17) | "Extensão Chrome disponível" / "Necessária para capturar transcrições do Google Meet" / botão "Instalar extensão" → `/extension` | Continua verdadeiro em termos de função, mas ambíguo agora; link para `/extension` é mantido | Recomendado: texto passa a citar a Taqciti; `to="/extension"` fica |
| `frontend/src/components/session/TranscriptPanel.tsx:24` | "Abra a reunião no Google Meet com a extensão ativa." | Genérico, ainda correto | Opcional: "com a Taqciti ativa" |
| `frontend/src/pages/ProjectFormPage.tsx:213` e `frontend/src/pages/SessionSetupPage.tsx:151` | `{ value: 'extension', label: 'Extensão Chrome', description: 'Gratuito' }` | O **valor** `extension` é contrato (fica). Só o **rótulo** é UI | Critério do Claude/time: manter ou virar "Taqciti (extensão Chrome)". Não toca o valor. |

### (a') NÃO são extensão antiga: valor `source=extension` ou lógica que usa o valor (FICAM)
- `frontend/src/lib/api.ts:61` `source: 'extension' | 'recall'`
- `frontend/src/pages/ProjectFormPage.tsx:28, 65` e `SessionSetupPage.tsx:21, 34` (estado inicial/leitura do `source`)
- `frontend/src/pages/SessionActivePage.tsx:177` `const isExtension = session.source === 'extension'`

**Dúvida pequena (DECISÃO do time, baixa prioridade):** `SessionActivePage.tsx:224-239` mostra "ID" da sessão + botão copiar quando `isExtension`. Esse bloco existia para o usuário **colar o ID no popup da extensão** (fluxo da Fase 7, antes do vínculo explícito da Fase 8). Hoje a Taqciti cria/vincula sessão sozinha, então o bloco é vestigial, mas é útil para suporte/depuração. Recomendação: **manter** (remover é mudança de comportamento, não de limpeza) e só registrar como follow-up. [VERIFIED: SessionActivePage.tsx lido nesta sessão]

### (b) Comentário que cita caminho que será apagado (D-10, refator em commit separado)
| Arquivo:linha | Trecho |
|---|---|
| `taqciti/src/shared/config/agenteConfig.ts:42` | `* `extension/background.js::normalizeUrl` (trim, remove barras finais,` |
| `taqciti/src/features/agente/wordDelta.ts:3` | `* `chrome`/`fetch`. Espelha o padrão de `extension/content_meet.js::emitNew()`,` (e a linha 5: "a extensão antiga tinha só uma fala de cada vez") |

Opcional, sem caminho apagado mas desatualizado: `backend/app/routers/sessions.py:206` diz "extensão Chrome faz POST direto para localhost — sem tunnel necessário" (em produção já não é localhost). É comentário puro; só entra se o time quiser.

**Atenção:** `taqciti/` é um subtree importado da Taqciti original. Editar comentários aqui faz o subtree **divergir** do upstream (um futuro `git subtree pull` pode gerar conflito trivial nessas duas linhas). Custo baixo, mas o time deve saber. Rodar `npx vitest run` em `taqciti/` não é necessário para comentário puro; rodar por segurança custa ~84 s.

### (c) Documentação (D-12, um único commit só de docs)
D-12 listou 5 arquivos. O levantamento achou **mais**:

| Arquivo:linha | O que diz | Ação |
|---|---|---|
| `CLAUDE.md:836-840` e `:858` (seção 10) | "A extensão (`extension/`) fala apenas com o backend v2... Nenhum arquivo de `backend/`, `frontend/` ou `extension/` importa `diagnostico/`" / "(`backend/` + `frontend/` + `extension/`)" | Reescrever: a extensão passa a ser a Taqciti (`taqciti/`) |
| `diagnostico/README.md:9-10` e `:19` | "A extensão Chrome (`extension/`) fala **apenas** com o backend v2..." / "(extensão + web)" | Atualizar o caminho |
| `PLANO_AJUSTES.md:247` e `:476` (+ `:11,18,160-171,491`) | cita `extension/` e `content_meet.js → background.js → POST /webhook/extension` | Histórico de plano já executado: preferir **nota** "(extensão antiga removida na Fase 9)" a reescrever tudo |
| `.planning/PROJECT.md:19, 35, 47, 91` | "retire the duplicated custom extension" / linha 91: "(extension retirement still pending, Phase 9)" | Atualizar status |
| `.planning/ROADMAP.md:39` (checkbox Fase 9), `:346` ("Lives in the separate Taqciti repo (like Phases 7-8)"), `:363` (tabela de progresso) | Fase 10 e STATE ainda dizem "repo separado" | Corrigir (D-12 já pede). Linha 203 é registro de plano concluído: não mexer |
| `.planning/STATE.md:201` | "Phases 7-8 live in the separate Taqciti repo" | Corrigir junto (é o mesmo erro) |
| `.planning/REQUIREMENTS.md:42, 95` | TAQ-04 `[ ]` / `Pending` | O verificador/transição marca; **não** faz parte do commit de docs de D-12 |
| `.planning/codebase/{STRUCTURE,ARCHITECTURE,INTEGRATIONS,CONVENTIONS}.md` | mapa gerado do repo descrevendo `extension/` | Snapshot gerado; **recomendado**: não editar à mão, regenerar com `/gsd-map-codebase` depois, ou aceitar defasagem e registrar como follow-up. Decisão do time |
| `.planning/debug/extension-key-field-clears-while-typing.md` | sessão de debug da Fase 6 sobre `extension/popup.js` | Histórico; deixar |
| `.planning/phases/01..08/**` | planos/summaries citando `extension/` | Histórico congelado; deixar |
| `diagnostico/EXTENSION.md`, `TECNOLOGIAS.md:50,153,169`, `CLAUDE.md:338,693` | falam de "extensão" no sentido de **extensibilidade** da v1 ou do **Taqtic/Recall** original da v1 | **Não são** a extensão antiga. Não tocar |

### (d) Contrato do backend que FICA (não propor tocar)
Valores lidos nesta sessão (citação literal):
- `backend/app/routers/webhook.py:12` `router = APIRouter(prefix="/webhook", tags=["webhook"])`
- `webhook.py:16-20` `class ExtensionChunk(BaseModel):` com `session_id: str`, `text: str`, `speaker: str | None = None`, `chunk_id: str | None = Field(default=None, max_length=200)`
- `webhook.py:23` `def verify_extension_key(x_agente_key: str | None = Header(default=None)) -> None:`
- `webhook.py:33` `@router.post("/extension", status_code=202)`
- `backend/app/models/projects.py:9` `TranscriptSource = Literal["extension", "recall"]`; `:43` `source: TranscriptSource = "extension"`
- `backend/app/models/sessions.py` `SessionResponse.source: str` (string livre: sessão histórica sempre resolve na leitura)
- `backend/app/routers/extension_clients.py:30` `router = APIRouter(prefix="/webhook/extension", tags=["webhook-extension"])`; rotas `/clients` (GET, POST), `/sessions` (POST), `/sessions/{session_id}/finish` (POST)
- `backend/app/services/extension_session_service.py:27` `_EXTENSION_CLIENT_SOURCE = "extension"`; `:112` `"source": "extension",`; `:130` `if row.get("source") != "extension" or row.get("status") not in ("active", "finished"):`
- Banco: coluna `source text` sem CHECK nem enum SQL (`supabase/migrations/20260524000000_initial_schema.sql:64`, e `20260526000000_rename_taqtic_to_extension.sql` só fez UPDATE de dados). [VERIFIED: leitura dos arquivos]

Comentários do backend que dizem "extensão" mas descrevem o contrato (`webhook.py:39` docstring, `main.py:49`, `session_state.py:148`, `transcript_chunks_repository.py:4`): **fora do escopo**.

## O que pode quebrar com `git rm -r extension/` + zip

Verificado, item por item:

| Candidato a dependente | Resultado | Evidência |
|---|---|---|
| CI na raiz | **Não existe** `.github/` na raiz | `ls .github` → erro; `git ls-files` só acha `taqciti/.github/*` |
| CI do subtree (`taqciti/.github/workflows/ci.yml`, `release.yml`) | Não rodam neste repo e **não** citam `extension/` | grep `extension` em `ci.yml` = vazio |
| `package.json` na raiz / workspaces | **Não existe** | `ls package.json` → erro |
| `extension/package.json` (script `test` = `node --test "tests/*.test.js"`) | Só uso manual; nenhum CI/hook chama | sem hooks (`git ls-files` sem `.husky`/`pre-commit`) |
| `Dockerfile` (Railway) | Só `COPY backend/requirements.txt` e `COPY backend/ ./backend/` | Dockerfile lido |
| `railway.toml`, `vercel.json` (raiz e `frontend/`) | Só healthcheck / redirect / rewrite SPA | arquivos lidos |
| `frontend` build/vite/tsconfig | Nada importa fora de `src/`; zip não é copiado (`frontend/public` só tem `favicon.svg` e `icons.svg`) | grep `zip` em `frontend/src` só acha `labels.ts` e o texto da página |
| `backend` (pytest, `pytest.ini` = `testpaths = tests`, `asyncio_mode = auto`) | Nenhum teste lê `extension/` | grep |
| `diagnostico/` | Não importa `extension/`; só README cita o caminho | grep |
| `.dockerignore` / `.gitignore` | Não têm regra para `extension/` nem `*.zip` | arquivos lidos |
| `.claude/` | só `settings.json` rastreado; `.claude/worktrees/rf-07-*` é lixo não rastreado | `git ls-files .claude` |

**Conclusão:** `git rm` é seguro. Ainda assim rodar os portões completos (backend, frontend test+lint+build) depois da remoção, como prova.

Fora do repositório (não é o plano que resolve, mas o time precisa saber): a **release v1.0.0 no GitHub** (`gabrielmezzalira/Agente-Diagnostico`) continua com o zip antigo e o link antigo continua baixando. Apagar a release é ação externa e irreversível: **decisão do time**, não do executor. Remover o link da página já impede novos downloads por ali.

## Estado atual do frontend e como testar

- **Kit de UI reaproveitável** (`frontend/src/components/ui/index.ts`): `Card`, `Button`, `ButtonLink` (para rota interna), `buttonClasses(variant, size, extra)` (para `<a href>` externo), `Chip`, `StatusDot`, `SectionLabel`, `Eyebrow`, `PageHeader`, `DetailRows`, `EmptyState`, `ErrorNotice`, `Field`... [VERIFIED: index.ts, Button.tsx, buttonStyles.ts, Typography.tsx, Chip.tsx lidos]
- A página atual **repete as classes do botão à mão** (`ExtensionPage.tsx:43`); a reescrita deve usar `buttonClasses('primary')` num `<a>` (não existe `ButtonLink` para URL externa; `ButtonLink` é `react-router` `Link`). Para o aviso D-11, usar tom `amber` (`Chip tone="amber"` ou bloco com `border-ds-amber/30 bg-ds-amber/10`, mesmas classes do `Chip`).
- **Testes existentes:** 3 arquivos / **17 testes passam** (`npm --prefix frontend test`): `components/ui/buttonStyles.test.ts`, `lib/labels.test.ts`, `lib/lens.test.ts`. Todos `.test.ts` puros. Não há teste de página.
- **Limite do vitest:** `frontend/vite.config.ts` → `test: { environment: 'node', include: ['src/**/*.test.ts'] }`. Um `ExtensionPage.test.tsx` **não seria coletado** e não há DOM. Caminho prescrito (SOLID: página só compõe, lógica fora do JSX): criar `frontend/src/lib/taqcitiInstall.ts` com as constantes/dados puros (URL da release, lista de passos por sistema, texto do aviso D-11) e `frontend/src/lib/taqcitiInstall.test.ts` provando: (1) o link é `https` e termina em `/releases/latest` (ou o formato decidido); (2) nenhum texto/link contém `agente-diagnostico-extension`, `.zip`, `v1.0.0`; (3) o aviso D-11 existe; (4) nenhum passo menciona chave/`x-agente-key`/URL do backend (D-07/D-08); (5) existem passos para Windows, macOS e Linux. Estender `labels.test.ts` com uma asserção sobre `EXTENSION_URL` ausente é opcional.
- **Gate do frontend:** `npm --prefix frontend test` (17 passam hoje), `npm --prefix frontend run lint`, `npm --prefix frontend run build` (`tsc -b && vite build`). Lint e build **não** foram rodados nesta pesquisa.

## Fatos de distribuição da Taqciti para o texto da página

Fonte: `taqciti/docs/publicar-release.md`, `taqciti/INSTALL.md`, `taqciti/installer/*`, `taqciti/src/shared/config/agenteConfig.ts`. [VERIFIED: leitura]

- **Arquivos da release** (o nome carrega a versão, vem da tag): `taqciti-instalador-windows-X.Y.Z.exe`, `taqciti-instalador-linux-X.Y.Z.run`, `taqciti-instalador-mac-X.Y.Z.pkg`. Como o nome muda a cada versão, **não dá para linkar um arquivo fixo**: a página deve linkar a página da release (formato genérico `https://github.com/<dono>/<repo>/releases/latest`).
- **Canal oficial do time é a pasta do Drive** ("nem todo mundo tem acesso ao GitHub", runbook); a GitHub Release é o canal técnico. D-05 diz "linka a release". O time precisa dizer **qual** link a página usa (ou os dois). Entra na decisão da URL.
- **Windows:** duplo-clique no `.exe`; instalação silenciosa; se houver Chrome e Edge, pergunta qual usar; ao fim abre guia visual no navegador. SmartScreen avisa "Windows protegeu o seu PC" (esperado, sem assinatura): "Mais informações" → "Executar assim mesmo".
- **macOS:** Gatekeeper bloqueia na primeira vez ("desenvolvedor não identificado"): botão direito no `.pkg` → **Abrir** → **Abrir** de novo; pede a senha do usuário; abre o guia visual.
- **Linux:** `chmod +x taqciti-instalador-linux-*.run` e `./taqciti-instalador-linux-*.run`.
- **Manual (fallback):** baixar o `.zip`, extrair numa pasta fixa (não mover/apagar), `chrome://extensions` (Edge: `edge://extensions`), ligar "Modo do desenvolvedor", "Carregar sem compactação". Cuidado de redação: a página nova **não** deve voltar a parecer a página antiga ("baixe o zip"); se citar o caminho manual, deixar como alternativa e sem o nome do zip antigo.
- **Aviso do Chrome** ao carregar fora da loja ("Modo do desenvolvedor pode ser perigoso") é normal; INSTALL.md explica.
- **Atualização:** remover a versão antiga em `chrome://extensions` e instalar a nova.
- **Chrome × Edge:** `INSTALL.md` diz Chrome e Edge; o `installer/windows/README.md` (passo 0) fala em procurar "o Google Chrome especificamente". As duas docs divergem entre si. Para a página, citar **Google Chrome** (o que o time usa no Meet) e evitar prometer Edge.
- **Config embutida:** `VITE_AGENTE_BACKEND_URL` (padrão `http://localhost:8000`) e `VITE_AGENTE_STREAMING_ENABLED` (padrão `'false'`) são lidos em `agenteConfig.ts` na hora do build [VERIFIED: `agenteConfig.ts` linhas 69-76 e 80-81, lido]. A chave `x-agente-key` não tem variável de build (D-10 da Fase 7).
- **ACHADO CRÍTICO (afeta D-07):** `taqciti/.github/workflows/release.yml` define no bloco `env:` só `VITE_DOCCITI_SERVER_URL` e `VITE_DOCCITI_SHARED_KEY`. **Não há `VITE_AGENTE_*`** no workflow, e `check-release-env.sh` também não cita `AGENTE`. [VERIFIED: grep em `.github`]. Consequência: uma release cortada com o workflow atual sai apontando para `http://localhost:8000` e com streaming **desligado** (`streamingEnabled` = false → `createAssociationDestination.canUse` devolve `disabled`, `agenteStreamDestination.ts:72-73`). Para a prova SC1 funcionar "só instalando", a Taqciti original precisa: (i) ganhar `VITE_AGENTE_BACKEND_URL: ${{ vars.AGENTE_BACKEND_URL }}` e `VITE_AGENTE_STREAMING_ENABLED: 'true'` no `env:` do workflow (e idealmente validar `https://` no check); (ii) ter a Variable correta no GitHub. Alternativa se o time não quiser mexer na release: o usuário liga o streaming e digita a URL na tela "Agente Diagnóstico" da Taqciti (`?view=agente`), mas isso contradiz D-07 ("a página não ensina configurar URL"). **Pergunta para o time no checkpoint.**
- **A URL do backend de produção do Agente** (Railway) também **não está em nenhum arquivo deste repo** (só a do servidor da própria Taqciti, `taqciti-production.up.railway.app`). O time precisa informá-la para o build.
- **Verificação de bundle** (SUPERADA pela re-decisão do usuário de 2026-10-26 — "prova positiva + perfil limpo"; o runbook mandava procurar a ausência de `localhost`, o que não serve para o Agente): o literal de fallback `"http://localhost:8000"` fica no bundle SEMPRE (`AGENTE_BACKEND_URL_DEFAULT = normalizeAgenteBackendUrl(...) || 'http://localhost:8000'`), então a conferência é POSITIVA — o host de produção do Agente **tem** que aparecer nos `assets/*.js` da pasta real da instalação nova, e o trecho de argumento vazio `("")||"http://localhost:8000"` (assinatura de build sem a variável) não pode aparecer (`grep` com status 1; status 2 = pasta ausente, conferência inválida) — mais a tela do Agente num perfil LIMPO do Chrome mostrando a URL de produção e o streaming ligado. Detalhes no 09-02 Task 3.
- `gh` está instalado (2.101.0) mas **sem login** nesta máquina; não foi possível consultar o repo/release da Taqciti. Nada foi inventado.

## Padrões de arquitetura

### Diagrama do fluxo da prova SC1 (produção)

```
[Reunião Google Meet real]
        |  legendas
        v
[Taqciti instalada (release com VITE_AGENTE_*)] --(1) GET /webhook/extension/clients--> [Backend Railway]
        |                                         (2) POST /webhook/extension/sessions (cria sessão source=extension, mode discovery)
        |  falas (chunk_id)                       (3) POST /webhook/extension  (202)  --> transcript_chunks
        +--------------------------------------->      |
                                                         v
                                              pipeline_manager.push_chunk
                                                         |
                          +------------------------------+------------------------------+
                          v                              v                              v
                 coverage_snapshots              questions (lens produto|dados)     (relatório sob demanda)
                          |                              |                              |
                          +-------------> WebSocket /ws/{session_id} --> [Web app Vercel: monitoramento]
                                                                                        |
                                       página do projeto: "Gerar PRD" (prontidão >= 0.65, sessão ativa) --> reports
[Sair da sala (DA-4)] --> POST /webhook/extension/sessions/{id}/finish --> sessions.status = finished
```

### Estrutura recomendada para a página nova
```
frontend/src/
├── lib/taqcitiInstall.ts        # dados puros: URL da release, passos por SO, texto do aviso D-11
├── lib/taqcitiInstall.test.ts   # vitest em Node: valida os dados (sem DOM)
├── lib/labels.ts                # remove EXTENSION_URL (ou aponta para a constante nova)
└── pages/ExtensionPage.tsx      # só compõe: PageHeader + Card + passos + <a className={buttonClasses('primary')}>
```
Se `ExtensionPage.tsx` passar de ~120 linhas, extrair um `components/extension/InstallSteps.tsx` (regra de 200 linhas do CLAUDE.md).

### Anti-padrões a evitar
- **Renomear ou "limpar" `extension` no backend** (rota, enum, modelo, `_EXTENSION_CLIENT_SOURCE`): é D-00a/SC3. Qualquer `sed` global em `extension` quebra a Taqciti em produção.
- **Misturar os commits**: remoção, página, refator de comentário, docs e teste são commits separados (CLAUDE.md).
- **Apagar `extension/` antes da prova SC1** (D-02).
- **Apagar dados de teste por prefixo `vis%`**: `visus` (cliente real) começa com `vis`. Usar igualdade exata e ids.

## Não reinventar

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Botão-link externo estilizado | classes Tailwind copiadas à mão | `buttonClasses('primary')` de `components/ui` | A página atual já repete o estilo (dívida); o helper existe |
| Checagem de rota/contrato do FastAPI | cliente HTTP real contra o servidor | `app.openapi()` e `router.routes` | Import-only, sem DB/rede (validado: `app.openapi()` lista as 5 rotas de webhook) |
| Teste de página React | instalar jsdom | dados puros em `lib/` + vitest `node` | Sem nova dependência |
| Prova do SC1 | script próprio que injeta chunks | reunião real + SQL read-only | Injetar chunks não prova que a Taqciti é a única fonte |

## Pitfalls comuns

### 1. Release da Taqciti sai com `localhost:8000` e streaming desligado
**O que dá errado:** a prova SC1 "não gera nada" e ninguém entende por quê (mesmo sintoma da v2.0.0 da Taqciti).
**Causa:** `release.yml` não passa `VITE_AGENTE_*` (achado acima).
**Como evitar:** checkpoint humano obrigatório antes da prova: conferir que o repo de origem tem o código das Fases 7-8 (decisão B do usuário, 2026-10-27), cortar release com as variáveis e fazer a prova positiva + perfil limpo (re-decisão de 2026-10-26): host de produção presente nos `assets/*.js` da pasta real da instalação nova, trecho de argumento vazio `("")||"http://localhost:8000"` ausente (o literal de fallback sozinho é esperado e ignorado), e tela do Agente num perfil limpo do Chrome com a URL de produção e o streaming ligado.
**Sinal:** na Taqciti, tela "Agente Diagnóstico" mostra URL `localhost` ou o interruptor desligado.

### 2. Pipeline engole falha do Gemini em silêncio
**O que dá errado:** "sem cobertura/perguntas" parece bug da Taqciti, mas é `GEMINI_API_KEY` ausente no Railway. O pipeline faz `except Exception: pass` (HANDOFF §7). Projetos criados pela Taqciti não têm chave própria, então dependem da chave do servidor (D-13).
**Como evitar:** confirmar a variável no Railway antes (ação humana, nunca em conversa); na prova, olhar `coverage_snapshots` e `questions` no banco, não só a tela.

### 3. O relatório NÃO é gerado ao encerrar a sessão
**O que dá errado:** o plano de prova espera ver `reports` preenchido depois de "sair da sala", e a tabela fica vazia.
**Causa:** `ExtensionSessionService.finish_session` só marca `finished`, para o pipeline e agenda exportação ao DocuData; **não gera relatório** (`extension_session_service.py:117-155`, lido). **Correção (decisão A do usuário, 2026-10-27):** numa sessão discovery — e todo cliente criado pela Taqciti nasce `mode='discovery'` (`extension_session_service.py:26`) — o botão "Relatório" da tela ao vivo fica OCULTO (`shouldShowManualReportButton`, `frontend/src/lib/lens.ts:92-97`, D-47). O relatório de discovery sai do botão **"Gerar PRD"** da página do projeto (`PrdCard`, `ProjectDetailPage`, que chama `POST /sessions/{id}/report`), que só destrava com prontidão ≥ 0.65 (`READINESS_THRESHOLD`, `READINESS_WEIGHTS` em `session_state.py:23-29`; o número só se atualiza ao recarregar a página).
**Como evitar:** o roteiro da prova conduz a conversa até a página do projeto mostrar prontidão ≥ 65%, clica "Gerar PRD" **com a sessão ainda ativa**, confere a linha em `reports` e só **depois** sai da sala e confere `finished`. Se a prontidão não chegar a 65%, a rodada é `reuniao-falhou` — não gerar o relatório pela tela de sessão encerrada depois de sair (inverteria a ordem travada pelo D-03).

### 4. Encerrar a sessão de teste pode exportar para o DocuData real
**O que dá errado:** `finish_session` chama `agendar_exportacao`, que é no-op **sem** `DOCUDATA_URL`/chave ou fora do modo discovery. Os clientes criados pela Taqciti já nascem `mode='discovery'`. Se o Railway tiver `DOCUDATA_URL`, o teste `ZZ-TESTE` cria dados num sistema externo.
**Como evitar:** o checkpoint de deploy pergunta se `DOCUDATA_URL` está definida em produção; se estiver, decidir com o time antes (ou aceitar e limpar lá também).

### 5. Sobras e falsos positivos na limpeza
O HANDOFF registra 2 sessões da Fase 8 ainda no banco; a nota do `08-UAT.md` fala em "cliente começa com `ZZ-TESTE` ou é `vis`". Um `LIKE 'vis%'` apaga `visus`. Ver "Limpeza" abaixo.

### 6. `WR-01` aberto durante a prova
Com `EXTENSION_SHARED_KEY` vazia, `/webhook/extension*` aceita qualquer um (`webhook.py:23-30`, risco T-08-10 aceito, D-08). A página e a prova não devem sugerir que há chave.

## Exemplos de código

### Teste-semente do SC3 (a escrever na execução; padrão já usado em `test_extension_clients.py`)
```python
# Fase 9 / SC3: o contrato que a Taqciti usa continua de pé depois de apagar extension/.
from fastapi.routing import APIRoute
from app.routers.webhook import router as webhook_router, ExtensionChunk, verify_extension_key
from app.models.projects import ProjectCreate, TranscriptSource
from app.models.sessions import SessionResponse
import typing

def test_post_webhook_extension_is_still_registered_with_202_and_gate():
    routes = {(m, r.path): r for r in webhook_router.routes if isinstance(r, APIRoute) for m in r.methods}
    route = routes[("POST", "/webhook/extension")]
    assert route.status_code == 202
    assert verify_extension_key in [d.call for d in route.dependant.dependencies]

def test_app_openapi_exposes_webhook_extension_and_chunk_contract():
    from app.main import app            # import sem rede/DB (verificado)
    spec = app.openapi()
    assert "post" in spec["paths"]["/webhook/extension"]
    assert set(spec["components"]["schemas"]["ExtensionChunk"]["properties"]) == {
        "session_id", "text", "speaker", "chunk_id"}

def test_source_enum_still_accepts_extension():
    assert "extension" in typing.get_args(TranscriptSource)
    assert ProjectCreate(name="n", client="c").source == "extension"

def test_historical_extension_session_still_resolves():
    # monta um dict mínimo de SessionResponse com source="extension" e status="finished"
    ...
```
Fonte: valores confirmados nesta sessão por execução (`app.openapi()["paths"]` listou `/webhook/extension`, `/webhook/recall`, `/webhook/extension/clients`, `/webhook/extension/sessions`, `/webhook/extension/sessions/{session_id}/finish`; `ExtensionChunk.properties` = `['chunk_id','session_id','speaker','text']`; `typing.get_args(TranscriptSource)` = `('extension','recall')`). No FastAPI instalado, `app.routes` aninha os routers incluídos e **não** expõe `/webhook/extension` direto (15 entradas, rotas como `?`): por isso o teste usa `webhook_router.routes` e `app.openapi()`, nunca `app.routes`.

### Fixture para o `SessionResponse` histórico
Campos obrigatórios (de `backend/app/models/sessions.py`, lidos): `id`, `project_id`, `source`, `status`, `tokens_used`, `cost_usd`, `started_at`, `client`; o resto é `Optional`. O executor deve ler o arquivo de novo ao escrever o teste (as linhas 13 e 42 do arquivo têm `source` em `SessionCreate` e `SessionResponse`; o model tem campos repetidos como `meeting_url`).

## O que os testes do backend já cobrem × o gap do SC3

Comando verificado (rodado nesta sessão, em `backend/`): `python -m pytest -q tests/test_extension_clients.py tests/test_webhook_auth.py tests/test_webhook_idempotency.py tests/test_extension_chunk_extra_fields.py` → **61 passed** em ~1,1 s.
Suíte completa: `python -m pytest -q` → **275 passed, 4 skipped, 1 failed**. O 1 falho é `tests/test_schema.py::test_tables_exist` (`APIError PGRST205: Could not find the table 'public.information_schema.tables'`): teste ao vivo contra o Supabase, **já falhava antes** e não tem relação com a fase (registrar como baseline para o executor não achar que quebrou algo).

| Arquivo | Já cobre |
|---|---|
| `test_webhook_auth.py` (4 testes) | `verify_extension_key`: no-op sem env; 401 sem header / header errado; aceita correto |
| `test_extension_chunk_extra_fields.py` | `ExtensionChunk` com e sem `chunk_id` (dump exato dos 4 campos); `extension_webhook` grava `chunk_id` e empurra ao pipeline |
| `test_webhook_idempotency.py` | `chunk_id` opcional e limite de 200; duplicata → 202 sem push; 404 para sessão inexistente; outros erros de banco sobem; **chunk sem `chunk_id` mantém o comportamento (é o payload da extensão antiga, D-14)** |
| `test_extension_clients.py` | rotas da Fase 8 (clients/sessions/finish), gate, prefixo; `"/webhook/extension" not in paths` do **router de clientes** |

**Gap exato do SC3 (nada disto está coberto hoje):**
1. A rota `POST /webhook/extension` existe com `status_code=202` e atrás do `verify_extension_key` (os testes chamam a função `extension_webhook` direto; nenhum olha o roteador).
2. `app.main` continua incluindo o `webhook_router` (via `app.openapi()`), e o schema `ExtensionChunk` mantém exatamente `session_id/text/speaker/chunk_id`.
3. O enum `TranscriptSource` ainda contém `extension` e `ProjectCreate().source` continua `"extension"` (nenhum teste lê isso hoje).
4. Uma sessão histórica `source="extension"` ainda é lida por `SessionResponse` (leitura de histórico).
Onde pôr: o CONTEXT diz "estender `test_extension_clients.py`" (item 7), mas esse arquivo já tem mais de 400 linhas (regra de 200 linhas do CLAUDE.md). Recomendação: **estender** o arquivo como o CONTEXT pede **ou**, se o executor julgar que piora o arquivo, criar um arquivo pequeno só do contrato e justificar no commit. Decisão tática do executor, sem impacto de contrato. Quando executar: **antes** do `git rm` (rede de segurança), embora o CONTEXT liste por último; as duas ordens respeitam D-02.

## Prova SC1 no banco (evidência read-only)

Colunas confirmadas nas migrations: `sessions(id, project_id, name, source, status, started_at, finished_at, tokens_used, cost_usd)`; `transcript_chunks(id, session_id, speaker, text, timestamp, chunk_id)`; `coverage_snapshots(session_id, coverage_json, snapshot_at)`; `questions(session_id, text, block, source, status, generated_at, expires_at, lens)`; `reports(session_id, markdown_content, cost_usd, generated_at, status)`; `projects(id, name, client, mode, source)`. `lens` guarda `produto | dados` (comentário da migration `20260922000000_add_lens_tagging.sql`). Todos os filhos têm `ON DELETE CASCADE` em `session_id`; `sessions.project_id` também (`projects` → `sessions`). [VERIFIED: migrations lidas]

Substituir `:sid` pelo id da sessão SC1 (aparece no log do backend ou na URL `/sessions/<id>` do web app).

```sql
-- (1) sessão da Taqciti, em discovery, e transcrição só dela
select s.id, s.status, s.source, s.started_at, s.finished_at, p.client, p.mode, p.source as project_source
from sessions s join projects p on p.id = s.project_id where s.id = ':sid';
-- esperado: source='extension', mode='discovery', client começa com 'ZZ-TESTE'

select count(*) as falas, count(chunk_id) as com_chunk_id, count(distinct speaker) as falantes,
       min(timestamp), max(timestamp)
from transcript_chunks where session_id = ':sid';
-- esperado: falas > 0 e com_chunk_id = falas
```
**Por que `com_chunk_id = falas` prova "só Taqciti":** a extensão antiga nunca enviava `chunk_id` (`grep chunk_id extension/*.js` = vazio; o corpo era `session_id`, `text`, `speaker`, `background.js:123-126`), e a Taqciti manda `chunk_id` em cada trecho (`taqciti/src/features/agente/outbox.ts:38`, D-19). [VERIFIED: grep nos dois lados; a cobertura do caminho ao vivo é confirmada pelo próprio resultado do SQL na prova]. Se alguma fala tiver `chunk_id` nulo, investigar antes de aprovar.

```sql
-- (2) cobertura e perguntas das duas lentes
select count(*) as snapshots, min(snapshot_at), max(snapshot_at) from coverage_snapshots where session_id = ':sid';
-- esperado: snapshots >= 1

select lens, status, count(*) from questions where session_id = ':sid' group by lens, status order by lens, status;
-- esperado: linhas para lens='produto' E lens='dados' (status queued/pinned/used/dismissed; expiradas contam)
```
```sql
-- (3) relatório de discovery salvo, com sinais de precificação
select id, status, generated_at, cost_usd, length(markdown_content) as tamanho,
       markdown_content ~ '## 6\. Requisitos funcionais' as tem_sec6,
       markdown_content ~ '6\.3' as tem_backlog_6_3,
       markdown_content ~ '7\.3' as tem_volumetria_7_3,
       markdown_content ~ '## 11\. Prioriza' as tem_faseamento_11
from reports where session_id = ':sid' order by generated_at desc;
-- esperado: >= 1 linha; as quatro flags true (status = 'Rascunho' etc. no discovery)
```
**Atenção ao critério "seção de precificação":** o relatório de discovery **não tem uma seção chamada "Precificação"**. Os sinais nativos (D-29) são a subseção 6.3 (backlog + estimativas), 7.3 (volumetria) e a seção 11 ("Priorização & faseamento") do PRD de 16 seções [VERIFIED: `backend/app/services/discovery_prompt_builder.py:262-266, 313-320, 322-326, 348`]. A prova deve conferir esses três e o time deve confirmar que é isso que "com a seção de precificação" (D-03) significa. Como o LLM pode escrever "[a preencher]" nas subseções sem insumo, a checagem textual diz "a seção existe", não "tem conteúdo"; o executor lê o relatório na tela também.
```sql
-- (4) DA-4: sair da sala encerra a sessão
select status, finished_at, finished_at - (select max(timestamp) from transcript_chunks where session_id = ':sid') as depois_da_ultima_fala
from sessions where id = ':sid';
-- esperado: status='finished', finished_at preenchido, poucos segundos após sair da sala
```
Evidência complementar (fora do SQL): o log do backend com `POST /webhook/extension/sessions/<id>/finish 200`; o selo "encerrada" no web app. Os campos de `reports.status` só existem em discovery.

### Roteiro da reunião SC1 (ordem que atende D-03)
1. Pré: checkpoints (release, deploy) concluídos; web app da Vercel aberto em produção.
2. Instalar a Taqciti **a partir da release** (não do `dist/` local), abrir o Meet real, criar o cliente `ZZ-TESTE-F09 …` pela Taqciti ("Selecionar cliente" aparece depois de clicar na bolha "!": UAT 08, observação nº 4).
3. Falar o suficiente para gerar cobertura e perguntas das duas lentes (a Fase 8 já viu que o Meet junta fala contínua num só trecho: usar vários falantes/frases curtas).
4. No web app, esperar `coverage_update` e perguntas nas duas lentes; com a reunião ainda aberta, abrir a **página do projeto** e recarregar até o cartão "Gerar PRD" mostrar prontidão ≥ 65%; **clicar "Gerar PRD" com a sessão ativa** e conferir a linha em `reports` (SQL 3, só leitura) antes de sair (ver Pitfall 3; decisão A do usuário, 2026-10-27). Se não chegar a 65%: `reuniao-falhou`, sem relatório por outro caminho.
5. Só então sair da sala (digitar `https://example.com` na mesma aba, como no teste 134) e conferir `finished`.
6. Rodar os 4 SQLs e colar o resultado no `09-UAT.md`.

## Limpeza dos dados de teste (ordem e cuidados)

Só **depois** do `09-UAT.md` aprovado. Sempre `select` antes de `delete`, e conferir por **id**, não por prefixo.

```sql
-- 0) listar o que seria apagado
select s.id, s.name, s.status, p.client from sessions s join projects p on p.id = s.project_id
where s.id in ('ce75b9af-d3d9-40de-b6e5-00ae38553f91','6cd362ad-cdc1-425f-8aca-d23d6a451d03')
   or p.client like 'ZZ-TESTE%';
select id, client, name from projects where client like 'ZZ-TESTE%';
-- 1) sessões primeiro (filhos saem por ON DELETE CASCADE; pricings.session_id vira NULL, ON DELETE SET NULL)
delete from sessions where id in (...ids conferidos...);
-- 2) depois o projeto
delete from projects where id in (...ids conferidos...) and client like 'ZZ-TESTE%';
```
- **Nunca** `where client like 'vis%'`: casaria `visus` (cliente real `a86ee034`) além do projeto de teste `vis`. Para o projeto antigo `vis` (`bb3b10d7-e15a-4947-a7cc-ec86a5b278a8`), apagar por id e só se ainda existir (o HANDOFF diz que a limpeza da tarde já o removeu).
- As 2 sessões `ce75b9af-…` e `6cd362ad-…` **podem pertencer a um projeto que não é `ZZ-TESTE`**: o `select` do passo 0 mostra a qual projeto estão ligadas antes de decidir se o projeto também sai.
- Se `DOCUDATA_URL` estiver definida em produção e a sessão da prova tiver sido exportada, limpar também lá (ação externa, do time).
- Apagar dados é ação em produção: o executor **não** roda `delete`; entrega o SQL ao humano (ou executa só com confirmação explícita naquele momento).

## Riscos por passo (no espírito das 7 seções do CLAUDE.md)

Cada task do plano precisa ter as 7 seções. Insumos concretos:

| Passo | Muda comportamento? | Risco concreto | Prevenção | Rollback |
|---|---|---|---|---|
| Checkpoint: release da Taqciti com `VITE_AGENTE_*` | Fora do repo | Release sai com `localhost:8000`/streaming off; repo de origem sem o código das Fases 7-8 | Pré-condição: blobs das Fases 7-8 iguais à `main` (sincronização = DECISÃO EM ABERTO do time); mudar `release.yml` no repo original; prova positiva + perfil limpo (host de produção presente no bundle da pasta real, argumento vazio ausente, tela do Agente em perfil limpo) | Cortar nova release; não distribuir a ruim |
| Checkpoint: deploy no Railway com `GEMINI_API_KEY` | Fora do repo | Sem a chave, pipeline mudo; deploy sai da `master` (HANDOFF §2) | Time confirma variáveis; valor da chave nunca em conversa/arquivo; testar com `GET /health` | Voltar o deploy anterior no Railway |
| Teste-semente SC3 | Não (só teste) | Teste frágil (depender de `app.routes`) | Usar `router.routes` e `app.openapi()`; rodar subset e suíte completa | `git revert` |
| Prova SC1 / `09-UAT.md` | Não (só verificação) | Dado de teste em produção; export ao DocuData; falha do Gemini invisível | Cliente `ZZ-TESTE`, SQL read-only, checar `DOCUDATA_URL`, olhar o banco | Limpeza por id (acima) |
| Página nova + `labels.ts` + nav/banner | Sim (UI) | Link quebrado ou ainda apontando ao zip antigo; texto prometendo URL/chave; rota `/extension` quebrada | `taqcitiInstall.test.ts`; `npm run build`; abrir a tela no navegador e clicar no link | `git revert` do commit |
| `git rm agente-diagnostico-extension-v1.0.0.zip` | Sim (arquivo) | Alguém ainda referenciando o arquivo local | grep já feito: só `labels.ts` (resolvido no commit da página) | `git revert` |
| `git rm -r extension/` | Sim (código removido) | Perder algo que só existia lá; esquecer um consumidor | Inventário acima (nenhum consumidor); suítes backend + frontend depois | `git revert` recupera tudo |
| Refator de comentários (2 arquivos do subtree) | Não | Divergência do subtree upstream; comentário errado | Commit separado; `git diff` só com linhas de comentário | `git revert` |
| Docs (D-12 + extras) | Não | Doc dizendo que a extensão existe | `grep -rn "extension/"` nos arquivos listados após editar | `git revert` |

## Decisões que são do usuário/time (DECISÃO EM ABERTO: parar e perguntar)

1. **URL do repositório original da Taqciti e da release** (e se o link é GitHub Release, pasta do Drive, ou os dois). Não inventar. O plano carrega um `checkpoint:decision` para o novo valor (nome sugerido da constante: `TAQCITI_RELEASES_URL`).
2. **URL do backend de produção do Agente (Railway)** para o `VITE_AGENTE_BACKEND_URL` do build, e se `VITE_AGENTE_STREAMING_ENABLED` vai como `true` na release (ver achado crítico).
3. **Quem corta a release** e se a release já existe (checkpoint humano; ação no repo original).
4. **Quem faz o deploy no Railway e quando** (D-13); confirmar `GEMINI_API_KEY` presente e se `DOCUDATA_URL` está definida.
5. **Apagar ou manter a release v1.0.0 no GitHub** (zip antigo ainda baixável) e a pasta do Drive antiga, se houver.
6. **Rótulos dos formulários** ("Extensão Chrome" em `ProjectFormPage.tsx:213` e `SessionSetupPage.tsx:151`): manter ou virar "Taqciti".
7. **Bloco "ID da sessão + copiar"** em `SessionActivePage.tsx:224-239`: manter (recomendado) ou remover como mudança de comportamento separada.
8. **`.planning/codebase/*.md`**: regenerar depois ou deixar defasado.
9. **Divergência do subtree**: aceitar editar 2 comentários em `taqciti/` ou deixá-los (são só comentários).
10. **Critério "seção de precificação" (D-03)**: confirmar que os sinais 6.3 / 7.3 / seção 11 bastam.

## Pré-condição de git (CLAUDE.md)

A fase só deve ser **executada** em `feat/fase-09-cutover-extension`, cortada da `main` **depois** que a Fase 8 estiver mergeada (`code-review --fix` incluído). Hoje o repo está em `feat/fase-08-taqciti-session-association` e esta rodada só planeja. Além disso, o deploy de produção sai da `master` (HANDOFF §2): a prova SC1 só é possível quando o código das Fases 7-8 estiver no Railway.

## Disponibilidade de ambiente

| Dependência | Necessária para | Disponível | Versão | Fallback |
|---|---|---|---|---|
| Node | vitest do frontend e da Taqciti | ✓ | v24.12.0 | — |
| npm | idem | ✓ | 11.13.0 | — |
| Python | pytest do backend | ✓ | 3.13.14 (prod usa 3.11 no Dockerfile) | — |
| git | remoção e commits | ✓ | 2.51.2 | — |
| gh CLI | consultar release da Taqciti | ✓ instalado, ✗ sem login | 2.101.0 | URL informada pelo time |
| Acesso ao Supabase (SQL) | SQL da prova e limpeza | não verificado aqui | — | SQL Editor do Supabase / conector (HANDOFF §7) |
| Acesso ao Railway/Vercel | deploy e variáveis | não verificado aqui | — | ação do time |
| Repo original da Taqciti | cortar a release | ✗ fora deste repo | — | checkpoint humano |

**Sem fallback (bloqueiam a prova SC1):** release da Taqciti com URL do Agente; deploy do backend com `GEMINI_API_KEY`.

## Arquitetura de validação

Nyquist habilitado (`workflow.nyquist_validation: true` em `.planning/config.json`).

### Frameworks de teste
| Área | Framework | Config | Comando rápido | Comando completo |
|---|---|---|---|---|
| Backend | pytest 9.1.1 (`asyncio_mode=auto`) | `backend/pytest.ini` | `cd backend && python -m pytest -q tests/test_extension_clients.py tests/test_webhook_auth.py tests/test_webhook_idempotency.py tests/test_extension_chunk_extra_fields.py` → 61 passam hoje | `cd backend && python -m pytest -q` → 275 passam, 4 skip, 1 falha preexistente (`test_schema.py::test_tables_exist`, ao vivo) |
| Frontend | vitest 4.1.7, ambiente `node`, só `src/**/*.test.ts` | `frontend/vite.config.ts` | `npm --prefix frontend test` → 3 arquivos / 17 testes | `npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build` |
| Taqciti (só se tocar comentários) | vitest | `taqciti/vitest.config.ts` | — | `cd taqciti && npx vitest run` → 89 arquivos / 1393 testes passam, ~84 s |
| Extensão antiga | `node --test` (manual) | `extension/package.json` | — | **sai com a pasta**; não rodar depois da remoção |

### Requisitos / critérios → testes
| Critério | Comportamento | Tipo | Comando automatizado | Existe? |
|---|---|---|---|---|
| SC1 / TAQ-04 | Sessão discovery ponta a ponta só com a Taqciti | **manual-only** (reunião real em produção, depende de pessoa, Meet e deploy) + SQL read-only | SQLs da seção "Prova SC1" colados em `09-UAT.md` | ❌ criar `09-UAT.md` |
| SC2 | `extension/` e zip fora do repo | automatizado (shell) | `test ! -e extension && test ! -e agente-diagnostico-extension-v1.0.0.zip && git ls-files extension '*.zip' \| wc -l` = 0 | ✅ comando, sem arquivo |
| SC2 (sem resíduo) | nenhuma referência viva ao caminho apagado | automatizado | `grep -rIn "extension/\|agente-diagnostico-extension" --exclude-dir=node_modules --exclude-dir=worktrees --exclude-dir=.next --exclude-dir=dist --exclude-dir=.git --exclude-dir=phases --exclude-dir=debug .` só pode sobrar o `09-*`, `HANDOFF-FASE-09-10.md` e rotas `/webhook/extension/*` | ✅ comando |
| SC3 | rota, `ExtensionChunk` e `source=extension` intactos | automatizado | testes novos de contrato (acima) + subset de 61 | ❌ Wave 0 |
| D-06 / D-07 / D-08 / D-11 | Página nova: link novo, sem zip antigo, sem chave/URL de backend, aviso presente | automatizado (dados puros) | `npm --prefix frontend test` | ❌ `taqcitiInstall.test.ts` (Wave 0) |
| D-06 | Página renderiza no navegador | manual-only (sem DOM no vitest) | abrir `/extension` no `npm --prefix frontend run dev` | n/a |
| D-10 | Comentários limpos sem mudar comportamento | automatizado | `git diff` só com linhas `*`; `npx vitest run` em `taqciti/` (opcional) | ✅ |
| D-14 | Chunk da extensão antiga continua aceito | automatizado | já coberto por `test_webhook_idempotency.py::test_webhook_without_chunk_id_keeps_current_behavior` | ✅ |

### Taxa de amostragem
- **Por commit:** o comando rápido da área tocada.
- **Por onda:** backend completo + frontend `test`+`lint`+`build`.
- **Gate da fase:** tudo verde (com a falha preexistente documentada) e `09-UAT.md` aprovado antes de `/gsd-verify-work`.

### Lacunas da Wave 0
- [ ] `backend/tests/` — testes de contrato SC3 (4 casos acima).
- [ ] `frontend/src/lib/taqcitiInstall.test.ts` (+ `taqcitiInstall.ts`).
- [ ] `.planning/phases/09-cutover-retire-custom-extension/09-UAT.md` (roteiro SC1 + espaço para evidência).
- Nenhuma instalação de framework é necessária.

## Domínio de segurança

`security_enforcement` não aparece em `.planning/config.json`, então vale como habilitado.

| Categoria ASVS | Aplica | Controle |
|---|---|---|
| V2 Autenticação | parcial | `x-agente-key` opt-in (`verify_extension_key`); **sem chave por decisão (D-08)**; WR-01/T-08-10 aceito |
| V3 Sessão | não | — |
| V4 Controle de acesso | sim | rotas `/webhook/extension*` abertas enquanto a chave estiver vazia; **não piorar** (a fase não muda isso) |
| V5 Validação de entrada | sim | `ExtensionChunk` (Pydantic) permanece; teste-semente o protege |
| V6 Criptografia | não | nenhuma chave nova; a chave nunca vai no bundle (D-10 Fase 7) |
| V10 Código malicioso / cadeia de suprimentos | sim | nenhum pacote novo; o link da release é um `https` externo informado pelo time: validar que é o repo oficial |

| Ameaça | STRIDE | Mitigação |
|---|---|---|
| Link de download apontando para repo/arquivo errado (phishing por link) | Tampering / Spoofing | URL só vem do time (checkpoint); teste de `https` e host esperado em `taqcitiInstall.test.ts`; sem copiar link de fonte não confirmada |
| Segredo vazar na documentação/UAT | Information disclosure | Não colar chaves em `09-UAT.md`; não ler `.env`/`taqciti/server/.env.local` |
| Injeção de transcrição falsa (WR-01 aberto) | Tampering | Risco aceito até o login do AGM (D-08); registrar no `09-UAT.md` que continua aberto |
| Apagar dado real na limpeza | Tampering / DoS de dados | `delete` por id, nunca por `vis%`; confirmar com `select` |

## Pergunta aberta para o planner (RESOLVED)

1. **RESOLVED** — **Onde o teste SC3 mora** (estender `test_extension_clients.py` ou arquivo pequeno)? Resolvido no plano 09-01: semente SC3 em `backend/tests/test_extension_chunk_extra_fields.py` (rodada com `-k sc3` também no 09-05).
2. **RESOLVED** — **O texto do aviso de D-11** pode citar "antiga" sem dizer onde baixá-la; resolvido no plano 09-04 (`TAQCITI_OLD_EXTENSION_WARNING`): "Se você tem a extensão antiga do Agente Diagnóstico instalada, remova-a em `chrome://extensions` antes de instalar a Taqciti."

## Log de suposições

| # | Afirmação | Seção | Risco se errada |
|---|---|---|---|
| A1 | O live streaming da Taqciti manda `chunk_id` em **todo** trecho (só confirmei a doc de `outbox.ts:38` e o caminho de bulk); se alguma fala ao vivo vier sem `chunk_id`, `com_chunk_id = falas` falha sem que isso signifique extensão antiga | Prova SC1 | Falso negativo na prova; o executor investiga a fala sem `chunk_id` |
| A2 | Um `ExtensionPage` com `buttonClasses('primary')` num `<a>` externo é suficiente para o visual (não visto no navegador) | Frontend | Ajuste visual na revisão de UI |
| A3 | A release do GitHub terá o formato `https://github.com/<dono>/<repo>/releases/latest` | Distribuição | Link a ajustar quando a URL real chegar |
| A4 | O Railway de produção hoje não tem `DOCUDATA_URL` definida | Pitfall 4 | Teste de produção exporta ao DocuData real |
| A5 | `npm --prefix frontend run lint` e `run build` passam hoje (não rodados nesta pesquisa; `tsc -b --noEmit` não deu saída) | Frontend | Baseline errado para o executor |
| A6 | As 2 sessões `ce75b9af-…`/`6cd362ad-…` ainda existem no banco (info do HANDOFF; não consultei o banco) | Limpeza | `select` do passo 0 mostra 0 linhas; sem dano |

## Fontes

### Primárias (confiança ALTA: lidas ou executadas nesta sessão)
- Arquivos do repo: `backend/app/routers/webhook.py`, `extension_clients.py`, `models/projects.py`, `models/sessions.py`, `services/extension_session_service.py`, `services/discovery_prompt_builder.py`, `main.py`, `tests/*` citados, `supabase/migrations/*`, `Dockerfile`, `railway.toml`, `vercel.json` (raiz e `frontend/`), `frontend/package.json`, `vite.config.ts`, `src/**` citados, `taqciti/docs/publicar-release.md`, `INSTALL.md`, `installer/*`, `src/shared/config/agenteConfig.ts`, `src/background/agenteStreamDestination.ts`, `.github/workflows/release.yml`, `.github/scripts/check-release-env.sh`, `extension/package.json`, `extension/background.js` (grep), `CLAUDE.md`, `09-CONTEXT.md`, `HANDOFF-FASE-09-10.md`, `08-UAT.md`.
- Execuções: pytest (subset 61 passam; completo 275/4/1), `npm test` do frontend (17), `npx vitest run` na Taqciti (1393), `app.openapi()` e `typing.get_args(TranscriptSource)`.

### Terciárias (LOW)
- Nenhuma pesquisa web foi necessária; sem fonte externa. Nenhum fetch por provedor MCP (a pesquisa é 100% interna ao repositório).

## Metadados

**Confiança:**
- Inventário de referências e impacto da remoção: ALTA (grep + leitura de configs).
- Testes e comandos: ALTA (executados).
- Distribuição da Taqciti: MÉDIA (docs lidos; repo/release real inacessíveis, `gh` sem login).
- Prova SC1 em produção: MÉDIA (SQL derivado das migrations; não executado contra o banco).

**Data da pesquisa:** 2026-10-26
**Válido até:** 2026-11-26 (o repo muda pouco; revalidar se a Fase 8 for mergeada com mudanças, ou se o `release.yml` da Taqciti for alterado)
