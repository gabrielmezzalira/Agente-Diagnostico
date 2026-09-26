---
phase: "7"
slug: "taqciti-config-background-streamer"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-26"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Repositório externo `gabrielmezzalira/taqciti` → este repositório | 284 arquivos e 105 commits entram de uma vez pelo `git subtree add`; qualquer segredo no histórico importado viajaria junto. | Código-fonte + histórico completo de commits |
| Service worker da Taqciti → backend do Agente (`POST /webhook/extension`) | Transcrição ao vivo sai da máquina do usuário pela rede, opcionalmente com header `x-agente-key`. | `ExtensionChunk` (session_id, text, speaker) |
| Bundle da extensão (`import.meta.env` na build) → qualquer pessoa com o `.crx` | Tudo que é padrão de build é público; a chave nunca é uma variável de build. | Padrões `VITE_AGENTE_*` (não-segredo) |
| `chrome.storage.local` → service worker e telas da extensão | A config do Agente (URL, toggle, session_id, chave) é lida por vários contextos da própria extensão. | `taq:agenteConfig` (inclui a chave em texto plano) |
| Tela "Agente Diagnóstico" → pessoa usuária | Campo de chave renderizado na UI. | Entrada livre de URL, ID de sessão e chave |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Tampering | Task 1 — importação via `git subtree add` | high | mitigate | `git fetch` + conferência de `FETCH_HEAD` = `c41309a1c58f3fa06095db877e6dc8f1dbd65635` antes do add; merge isolado só sob `taqciti/`. Confirmado: merge `9a26937` com 2 pais, 105 commits em `HEAD^2`, diff contra o 1º pai com 0 arquivos fora de `taqciti/`. | closed |
| T-07-02 | Information Disclosure | Histórico importado (105 commits) | high | mitigate | Varredura de nomes de arquivo de segredo e de padrões de chave no histórico `HEAD^2` (só contagem, nunca valor) — confirmado 0 nas 3 varreduras (Task 1 do plano 01). | closed |
| T-07-03 | Information Disclosure | `x-agente-key` no bundle | high | mitigate | `DEFAULT_AGENTE_CONFIG.agenteApiKey = ''` e nenhuma variável de build para a chave. Confirmado por grep: `agenteApiKey: ''` presente em `agenteConfig.ts`, nenhuma leitura de `import.meta.env` para a chave. | closed |
| T-07-04 | Information Disclosure | Logs do service worker | medium | mitigate | Só `logger` (allowlist `SAFE_LOG_KEYS`), nunca console direto. Confirmado por grep negativo: 0 ocorrências de `console.` fora de comentário nos 4 arquivos novos (`agenteStreamer.ts`, `wordDelta.ts`, `agenteConfig.ts`, `agenteConfigStore.ts`). | closed |
| T-07-05 | Denial of Service | `fetch` disparado de `flushState()` | medium | mitigate | `void … .catch(logger.error)` depois de `broadcast()`, `AbortSignal.timeout(10_000)`. Confirmado pelo teste "não bloqueante em erro de rede" (`agenteStreamer.test.ts`, verde). | closed |
| T-07-06 | Information Disclosure | Envio sem opt-in / backfill | high | mitigate | Padrão desligado (D-09); `planStreamStep` faz prime ao ligar (só dali para frente). Confirmado por testes das Tasks 2/3 do plano 01 e Task 2 do plano 02 (religar não reenvia o que foi falado desligado). | closed |
| T-07-07 | Repudiation | Atribuição à sessão errada | medium | mitigate | `session_id` obrigatório em formato UUID; regra de espera em reunião nova com o mesmo session_id. Confirmado pelos testes de `wordDelta.test.ts` (prime/reunião nova/troca de sessão). | closed |
| T-07-SC | Tampering (supply chain) | `npm ci` em `taqciti/` | medium | mitigate | `npm ci` estrito do `package-lock.json` importado (integridade por hash), nenhum pacote novo instalado nesta fase. Confirmado: `npm ci` rodou limpo nas 3 execuções, `package.json`/`package-lock.json` sem diff desde o merge do subtree. | closed |
| T-07-08 | Information Disclosure | `x-agente-key` em `chrome.storage.local` | low | accept | Texto plano no storage local da extensão, mesmo nível de exposição do campo equivalente da Fase 6 (AR-06-01); só `chrome.storage.local`, nunca `.sync`. Confirmado por grep: 0 ocorrências de `storage.sync` em `agenteConfigStore.ts`. | closed |
| T-07-09 | Tampering | Valor corrompido/antigo em `taq:agenteConfig` | low | mitigate | `normalizeAgenteConfig` na leitura, na escrita e em cada `onChanged`. Confirmado pelo teste "lixo não entra no storage" (`agenteConfigStore.test.ts`, 11/11 verde). | closed |
| T-07-10 | Information Disclosure | Religar o streaming | high | mitigate | Regra de prime de `planStreamStep` (plano 01) + teste ponta a ponta com o storage real (plano 02) provando que nada do período desligado é enviado. Confirmado: bloco "configuração vinda do storage (D-08)" verde em `agenteStreamer.test.ts` (10/10). | closed |
| T-07-11 | Denial of Service | Leitura do storage a cada flush | low | mitigate | `createAgenteConfigReader` lê uma vez e atualiza por `onChanged`; teste conta 1 leitura em vários flushes. Confirmado por grep: 0 ocorrências de `storage.sync`, leitor com cache implementado e testado. | closed |
| T-07-12 | Information Disclosure | Campo da chave na tela | medium | mitigate | `TextField` com `type="password"` e `autoComplete="off"`; a chave nunca é renderizada como texto. Confirmado por grep: 1 ocorrência de `type="password"` em `AgenteConfigScreen.tsx`, e pelo teste de componente (caso 4). | closed |
| T-07-13 | Tampering | URL/ID digitados | low | mitigate | `patchAgenteConfig` normaliza; `getStreamingReadiness` impede envio com URL inválida ou ID fora do formato UUID; status explica o motivo. Confirmado por `agenteConfigStore.test.ts` e pelo teste de componente (caso 6, "Falta o ID da sessão"). | closed |
| T-07-14 | Repudiation | ID da sessão pré-preenchido/adivinhado | medium | mitigate | Rascunho inicial é só o valor salvo (vazio por padrão), sem sugestão. Confirmado por grep: `agenteSessionId: ''` em `DEFAULT_AGENTE_CONFIG`, e pelo teste de componente (caso 1, campo vazio sem nada salvo). | closed |
| T-07-15 | Elevation of Privilege | Manifesto / superfície do ícone | low | mitigate | `manifest.config.ts` e `PanelApp.tsx` intocados — sem `default_popup` novo. Confirmado por diff desde o merge do subtree: 0 arquivos alterados em `taqciti/manifest.config.ts` e `taqciti/src/content/ui/PanelApp.tsx`. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-08 | Chave do Agente em texto plano no `chrome.storage.local` — mesmo padrão já aceito na Fase 6 (AR-06-01) para o campo equivalente da extensão; ativação real de `EXTENSION_SHARED_KEY` em produção continua decisão em aberto do time (herdada da Fase 6, D-03), fora do escopo desta fase. | 07-02-PLAN.md (seção 6) | 2026-09-26 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-26 | 16 | 16 | 0 | orchestrator (register_authored_at_plan_time=true, ASVS L1 short-circuit — grep-depth verification, no auditor agent spawn needed) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-26
