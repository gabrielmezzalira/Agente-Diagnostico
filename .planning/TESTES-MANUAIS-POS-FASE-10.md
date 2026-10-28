# Testes manuais — só depois que a chave do Gemini voltar E a Fase 10 terminar

**Escrito em:** 2026-10-28
**Por que estão separados:** todos dependem de IA funcionando (chave do Gemini com crédito) ou da aba AGP da Taqciti (Fase 10). Nenhum deve ser feito antes.
**Regras gerais (valem para todos):**
- O backend local grava no Supabase de **produção**. Use só clientes `ZZ-TESTE-<assunto> <data>` e apague no fim, por id.
- Não abra nem cole `.env`. Se precisar de um valor de chave, peça a quem tem.
- Python no Windows: use `127.0.0.1`, não `localhost`.
- Backend: `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (sem `--reload` durante uma reunião).
- Web app: `npm --prefix frontend run dev` (porta 5173).
- Depois de qualquer rebuild da Taqciti: ↻ em `chrome://extensions`.

## Pré-requisitos de todos os testes

- [ ] Chave do Gemini com crédito. Confirme antes de entrar no Meet: abra `http://127.0.0.1:8000/health` (ok) e, depois de 1 minuto de reunião, confira que o log do backend **não** mostra `402 RESOURCE_EXHAUSTED`.
- [ ] Taqciti carregada de `taqciti/dist` (build local) com a URL `http://127.0.0.1:8000` e o envio ligado.
- [ ] Extensão antiga desativada ou removida (depois do 09-05 ela nem existe mais no repo).

---

## M1 — Cobertura e perguntas das duas lentes (repete o teste 4 da Fase 9)

**Prova:** a IA entende a conversa e gera cobertura e perguntas de Produto **e** de Dados com a sessão vinda da Taqciti.
**Como fazer:**
1. Entre num Meet com **pelo menos duas pessoas**. Na bolha "!", clique "Selecionar cliente" e crie `ZZ-TESTE-M1 <data>`.
2. Fale em frases curtas, alternando entre pessoas, sobre as duas lentes. Produto: dor/gargalo, fluxo do processo, desenho da solução, expectativa. Dados: fontes e qualidade, métricas, LGPD, automações, nuvem.
3. Cite um risco concreto (ex.: "os dados estão só em planilhas manuais") para sair um alerta.
4. Com a reunião aberta, em outra aba, abra `http://localhost:5173`, o projeto e a sessão ativa.
5. Espere cerca de 30s e clique em **Gerar perguntas**.
**Esperado:** a tela mostra cobertura por área, pelo menos 1 alerta, e perguntas das lentes Produto e Dados.
**SQL de conferência (só leitura, com o id da sessão):**
```sql
select count(*) as snapshots from coverage_snapshots where session_id = ':sid';
select lens, status, count(*) from questions where session_id = ':sid' group by lens, status order by lens, status;
select count(*) as alertas from red_flags where session_id = ':sid';
```
Esperado: `snapshots >= 1`, linhas para `lens='produto'` e `lens='dados'`, `alertas >= 1`.

## M2 — Falha do Gemini fica visível (só depois da decisão Q1)

**Prova:** quando a IA falha, a pessoa percebe.
**Como fazer:** com a chave sem crédito, ou com um valor inválido colocado **por você** no `backend/.env` (restaure depois), abra uma sessão e clique em **Gerar perguntas**.
**Esperado:** uma mensagem de erro na tela (ou evento `error`); nunca um silêncio.
**Atenção:** só execute se o time decidir implementar a Q1. Hoje o comportamento é silencioso, e é isso que o item pede para mudar.

## M3 — Vários falantes e nomes na transcrição

**Prova:** na prova da Fase 9 a sessão tinha `falantes=1`.
**Como fazer:** no M1, com duas ou mais pessoas falando, confira:
```sql
select count(distinct speaker) as falantes, count(*) as falas from transcript_chunks where session_id = ':sid';
```
**Esperado:** `falantes >= 2`. Se continuar 1, o Meet está juntando as falas (a Taqciti junta fala contínua da mesma pessoa), ou o nome do falante não está sendo capturado: abra um achado.

## M4 — Encerrar a sessão logo ao sair da sala

**Prova:** na Fase 9, `finished_at` ficou 6min41s depois da última fala; não dá para saber se foi a pessoa parada ou um atraso.
**Como fazer:** no fim do M1, anote o horário, fale uma última frase, e **saia da sala na hora** digitando `https://example.com` na aba do Meet.
**Esperado:** `finished_at` poucos segundos depois da última fala, e o log do backend com `POST /webhook/extension/sessions/<id>/finish 200`.
```sql
select status, finished_at - (select max(timestamp) from transcript_chunks where session_id = ':sid') as depois_da_ultima_fala from sessions where id = ':sid';
```

## M5 — Aba de perguntas dentro da Taqciti (Fase 10, TAQ-05)

**Prova:** as perguntas aparecem na aba "AGP" da Taqciti, sem sair do Meet.
**Como fazer:**
1. Faça o M1 até a sessão ter perguntas.
2. Na Taqciti, abra a aba **AGP** (a reunião precisa estar **vinculada** a um cliente; sem vínculo, a aba deve mostrar um convite para vincular, nunca perguntas de outra sessão).
3. Aguarde perguntas novas ou clique em gerar (se a decisão 10-B incluir ação).
**Esperado:**
- cada card mostra a lente (Produto/Dados);
- novas perguntas aparecem em segundos;
- quando uma pergunta expira (`question_expired`), ela some;
- ao sair da sala, a aba mostra "reunião encerrada" e não um erro.
4. Confira que a captura e o envio continuam funcionando enquanto a aba está aberta (as falas continuam chegando ao backend).

## M6 — Retirada do PRD (só depois da decisão esconder/remover)

**Como fazer:** abra a página de um projeto e a de uma sessão encerrada.
**Esperado:** nenhum botão "Gerar PRD", nenhum cartão de prontidão, e nenhuma pessoa consegue gerar relatório de discovery pela interface. Se a decisão foi **esconder**, as rotas continuam existindo mas sem botão que as chame.

## M7 — Página `/extension` com o link final (depois da release da Taqciti)

**Como fazer:** abra `http://localhost:5173/extension` (ou a URL de produção) e clique no link de download.
**Esperado:** baixa a versão atual da Taqciti; os passos de instalação estão claros; o aviso de remover a extensão antiga aparece.
**Pré-requisito:** a release da Taqciti publicada e a URL definida (decisão do 09-04).

## M8 — Teste rápido em produção (depois do deploy)

Lista no `09-UAT.md`, seção "Depois do deploy", item 7. Resumo: reunião curta com `ZZ-TESTE-PROD <data>`, confirmar no banco de produção uma sessão `source='extension'` com falas e `chunk_id` em todas, e apagar a sessão e o projeto por id.

## M9 — Limpeza final dos dados de teste

**Como fazer:** para cada cliente `ZZ-TESTE-*` criado, liste (só leitura), confira que o cliente real `visus` não está na lista, e apague por id, sessões primeiro e projeto depois.
**Já limpo (2026-10-28, autorizado pelo usuário):** o projeto `visus` e as suas 10 sessões foram apagados.
**Ainda a apagar, adiado de propósito até o fim da Fase 10:** o projeto `ZZ-TESTE-D20…` (id `6411a126-0be7-4c17-93a4-0ab6ae798eb4`) e a sessão da prova SC1 (id `5e67b872-b5c1-4751-91bf-7d7157b15b9c`). Sessões primeiro, depois o projeto com a trava `client like 'ZZ-TESTE%'`.
