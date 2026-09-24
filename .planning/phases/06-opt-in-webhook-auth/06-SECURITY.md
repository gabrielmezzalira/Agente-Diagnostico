---
phase: "6"
slug: "opt-in-webhook-auth"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Internet → `POST /webhook/extension` | URL pública (Railway); hoje qualquer chamador é aceito sem checagem — é aqui que o gate opt-in entra. | Chunks de transcrição (`ExtensionChunk`) |
| `chrome.storage.local` → `background.js` | Segredo (chave) e URL do backend ficam em texto plano no storage local da extensão, lidos pelo service worker a cada requisição. | Shared-secret key (texto plano) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Spoofing / Tampering | `verify_extension_key` em `extension_webhook` | high | mitigate | Shared-secret header (`x-agente-key`) comparado com `secrets.compare_digest`; opt-in — só passa a valer quando `EXTENSION_SHARED_KEY` é configurada. Confirmado: 4 testes automatizados verdes cobrindo as 3 SCs. | closed |
| T-06-02 | Information Disclosure | Comparação da chave em `verify_extension_key` | low | mitigate | `secrets.compare_digest` em vez de `==` elimina o canal de tempo. Confirmado por grep: `secrets.compare_digest` presente na linha 26 de `webhook.py`, zero ocorrências de `x_agente_key ==`. | closed |
| T-06-03 | Information Disclosure | `chrome.storage.local` (extensão) | low | accept | Armazenamento em texto plano, mesmo nível de exposição do campo `backendUrl` já existente (decisão explícita D-02); `chrome.storage.local` (nunca `.sync`) evita sincronizar o segredo entre perfis Chrome. Confirmado por grep: zero ocorrências de `chrome.storage.sync` nos 3 arquivos da extensão. | closed |
| T-06-04 | Elevation of Privilege | Escopo do `Depends()` em `webhook.py` | high | mitigate | `Depends(verify_extension_key)` conectado exclusivamente ao parâmetro de `extension_webhook()` — nunca ao `APIRouter(...)` nem a `recall_webhook()`. Confirmado por grep: exatamente 1 ocorrência no arquivo, 0 dentro do corpo de `recall_webhook`. | closed |
| T-06-SC | Tampering (supply chain) | Dependências pip/npm | low | accept | Nenhum pacote novo instalado (backend usa só stdlib `secrets`/`os` + `fastapi` já instalado; extensão não tem `package.json`) — sem task de install, gate de legitimidade de pacote não se aplica. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-03 | Chave da extensão em texto plano no `chrome.storage.local` — mesmo padrão já usado para `backendUrl`; ativação real da chave em produção (D-03) é decisão em aberto do time, fora deste plano. | 06-01-PLAN.md (CONTEXT) | 2026-09-24 |
| AR-06-02 | T-06-SC | Nenhuma dependência nova instalada nesta fase — gate de supply chain não se aplica. | 06-01-PLAN.md (CONTEXT) | 2026-09-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-24 | 5 | 5 | 0 | orchestrator (register_authored_at_plan_time=true, ASVS L1 short-circuit — grep-depth verification, no auditor agent spawn needed) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-24
