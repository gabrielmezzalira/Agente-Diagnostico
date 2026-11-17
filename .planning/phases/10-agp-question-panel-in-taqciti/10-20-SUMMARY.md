---
phase: 10-agp-question-panel-in-taqciti
plan: 20
subsystem: taqciti (nome e textos públicos) e CLAUDE.md
tags: [typescript, vitest, chrome-extension, taqciti, review-fix, texto-publico, lgpd, d-07]
status: complete
review_findings: [IN-05]
commits: 4
key-files:
  modified:
    - taqciti/manifest.config.ts
    - taqciti/src/manifest.test.ts
    - taqciti/package.json
    - taqciti/README.md
    - taqciti/INSTALL.md
    - CLAUDE.md
---

# 10-20 — D-07 mantido, IN-05 e nome "TaqCITi"

**Decisões do usuário (2026-11-17):** "D-07 pode fazer o recomendado" (manter a frase e corrigir o IN-05) e "Renomeia para TaqCITi".

## O que foi feito

| Commit | O que |
|--------|-------|
| `f3c1bb7` | `test(10-20)`: plano + teste do nome. Antes do conserto: 1 falha (`TaqCITi Standalone`), 5 passam. |
| `2c26f38` | `fix(10-20)`: `name: 'TaqCITi'` no `manifest.config.ts`. O ID da extensão não muda (vem da `key`). |
| `068c520` | `docs(10-20)`: README, INSTALL e a descrição do `package.json` deixam de dizer "100% local", "sem backend" e "nada sai do seu computador". |
| `2e802fc` | `docs(10-20)`: a seção 10 do `CLAUDE.md` deixa de dizer que a Taqciti "fala apenas com o backend v2" (IN-05). A frase do D-07 ficou como estava. |

Mais os registros: ROADMAP, STATE, VERIFICATION (11/12), SECURITY (T-10-21 fechada), REVIEW-DISPOSITION (WR-01, WR-02, IN-05 e IN-08 como `fixed`) e o ledger `WINDOWS.md` (entrada 5 resolvida).

## Verificação

- `manifest.test.ts`: 6 passaram.
- Suíte inteira da Taqciti: 104 arquivos passaram e 1 foi pulado; 1792 testes passaram e 3 foram pulados (a fumaça AGP opt-in).
- `tsc --noEmit` e `eslint` limpos; `npm run build` ok: o `dist/manifest.json` saiu com `name: TaqCITi`, versão `2.2.0` e a descrição do 10-19.

## Descoberta durante o plano

O guia `INSTALL.md` (o que a pessoa lê antes de dar a permissão) dizia "nada sai do seu computador … sem backend nenhum". Isso era falso por **dois** motivos: o envio ao Agente ao vincular um cliente e o botão "Gerar documento", que manda a transcrição ao servidor de geração de documento (`taqciti/src/document/generateDocument.ts:163-170`). O texto novo cita os dois, sempre por ação da pessoa.

## Em aberto (não bloqueia)

- **Renomear o pacote npm `taqciti-standalone` e o `standalone.tsx`:** não aparecem para o usuário e exigem mexer no `package-lock.json`, que já está fora de sincronia. Recomendação: não agora.
- **Descrição do manifesto:** cita só o envio ao Agente (131 caracteres, limite de 132) e não o "Gerar documento". Não nega nada, mas se o time quiser ser exaustivo ali, precisa encurtar outra parte.
- **Verificação manual pendente (testes do fim):** recarregar a extensão em `chrome://extensions` e ver o nome "TaqCITi", a versão 2.2.0 e o mesmo ID de antes.
