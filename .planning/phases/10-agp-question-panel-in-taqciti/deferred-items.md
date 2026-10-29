# Fase 10 — itens adiados (fora do escopo dos planos)

## Teste de temporização instável sob carga (descoberto no plano 10-02)

- **Arquivo:** `taqciti/src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx`
- **Sintoma:** na suíte completa (`cd taqciti && npx vitest run`, ~150 s, máquina carregada) 9 testes falham com
  `flushUntil: predicado não ficou verdadeiro a tempo`; rodando o arquivo sozinho passa 10/10.
- **Causa provável:** o helper `flushUntil` tem prazo curto e a renderização do jsdom estoura sob carga.
- **Não relacionado a:** mudanças do plano 10-02 (background/máquina da reunião). Nenhum import em comum.
- **Decisão:** não corrigido aqui (fora do escopo); candidato a ajuste do prazo do `flushUntil` num plano de testes.
