---
phase: 10-agp-question-panel-in-taqciti
plan: 19
subsystem: taqciti (manifesto e versão)
tags: [typescript, vitest, chrome-extension, taqciti, review-fix, texto-publico, lgpd]
status: complete
review_findings: [WR-02, IN-08]
commits: 4
key-files:
  modified:
    - taqciti/manifest.config.ts
    - taqciti/package.json
    - taqciti/src/background/index.ts
    - taqciti/src/manifest.test.ts
---

# 10-19 — Texto do manifesto e versão 2.2.0 (WR-02 + IN-08)

**Decisão do usuário (2026-11-17):** corrigir, antes de distribuir a Taqciti pelo link do Google Drive.

## O que foi feito

| Commit | O que |
|--------|-------|
| `527aac3` | `test(10-19)`: plano + dois testes no manifesto. Antes do conserto: 1 falha (descrição), 4 passam. |
| `6251b94` | `fix(10-19)`: a descrição mudou de "histórico 100% local, sem integração com nenhum backend" para "Transcreve reuniões do Google Meet. O histórico fica no navegador; ao vincular um cliente, a transcrição vai ao Agente Diagnóstico." (131 caracteres). |
| `5aa07b6` | `docs(10-19)`: o cabeçalho do `background/index.ts` passou a descrever o envio ao Agente, a leitura do `/ws` e a ata no Drive. Só comentário. |
| `d7d9072` | `chore(10-19)`: versão 2.1.2 → 2.2.0 no `manifest.config.ts` e no `package.json`. |

## Verificação

- `manifest.test.ts`: 5 passaram.
- Suíte inteira da Taqciti: 1791 passaram e 3 foram pulados.
- `tsc` e `eslint` limpos.
- `npm run build`: o `dist/manifest.json` saiu com a versão `2.2.0` e a descrição nova.

## Desvio

O primeiro commit da versão reescreveu as quebras de linha do arquivo inteiro (o `sed` do Git Bash tirou os CR). Ele foi
desfeito antes de qualquer push e refeito só com as 2 linhas da versão (`d7d9072`).

## Em aberto (não bloqueia)

- **Nome "TaqCITi Standalone":** "standalone" sugere "não ligada a nada". Recomendação: "TaqCITi". Trocar o nome não muda o ID, que vem da `key`. Decisão do time.
- **`package-lock.json` da Taqciti:** diz 1.5.1 desde antes desta fase. Não foi mexido.
- **Permissão nova:** quem já tem uma build antiga instalada vai ver o Chrome pedir a permissão `tabs` ao receber a 2.2.0. Vale avisar no e-mail de distribuição.
