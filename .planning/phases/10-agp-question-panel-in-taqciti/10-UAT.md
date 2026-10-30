---
status: testing
phase: 10-agp-question-panel-in-taqciti
source: 10-PLAN.md do Gabriel (seção 7, os 7 testes de base), 10-CONTEXT.md (D-13, D-15, D-16, D-18, D-19), 10-RESEARCH.md (UAT de 7 para 12 testes), 10-UI-SPEC.md (contrato de copy)
started: 2026-10-30T14:28:03Z
updated: 2026-10-30T14:28:03Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Aba AGP sem cliente vinculado
expected: |
  Entre numa reunião do Meet com o TaqCITi ligado, SEM vincular cliente. No painel aparecem as abas "Transcrição" e "AGP",
  com "Transcrição" selecionada. Ao clicar em "AGP" aparece só o aviso "Vincule esta reunião a um cliente para ver aqui as
  perguntas do Agente." e nenhuma pergunta; nenhum número aparece ao lado de "AGP".
awaiting: user response

## Preparo comum

Faça isto uma vez, antes do primeiro teste. Vale para os 12 testes.

**O que é o quê (para ler o resto do roteiro):**
- **Painel do Meet:** o painel pequeno do TaqCITi que aparece dentro da página do Meet. Se ele não estiver aberto, clique no ícone da extensão na barra do Chrome (ou na cápsula do TaqCITi na página).
- **Aba AGP:** a aba "AGP", ao lado da aba "Transcrição", dentro do painel. É onde aparecem as perguntas do Agente. Ela só mostra: não tem botão de gerar, fixar nem descartar (isso fica para a Fase 10.1).
- **Tela larga:** a mesma tela do TaqCITi, numa aba inteira do Chrome. Para abrir: em `chrome://extensions`, ligue o "Modo do desenvolvedor", copie o "ID" do TaqCITi e abra uma aba nova com o endereço `chrome-extension://<ID>/src/sidepanel/index.html` (troque `<ID>` pelo ID copiado). Com uma reunião ao vivo, essa tela mostra a transcrição ao vivo.
- **Site do Agente:** o web app em `http://localhost:5173`. É onde se clica em "Gerar" (coluna "Perguntas" da sessão) para o Agente gerar perguntas.
- **Vincular:** ligar a reunião a um cliente do Agente. No painel: botão "Selecionar cliente agora" (ou "Selecionar cliente", na barra "Sem cliente") → tela "Escolher cliente" → escolher ou "Criar cliente novo" → botão "Vincular reunião". Pronto quando a barra mostrar "Enviando ao vivo para <cliente>".
- **Terminal do backend:** a janela de terminal onde o backend roda; os testes pedem para olhar as linhas que ele imprime.

**Preparo, passo a passo:**
1. **Backend local.** Abra um terminal na pasta do projeto e rode `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (sem `--reload` durante uma reunião). No Windows use `127.0.0.1`, não `localhost`. Confira abrindo `http://127.0.0.1:8000/health` no navegador: tem que responder ok. Deixe esse terminal visível; vários testes pedem para olhar nele.
2. **Site do Agente.** Em outro terminal, rode `npm --prefix frontend run dev` e abra `http://localhost:5173`.
3. **TaqCITi com o build certo.** A Taqciti já foi reconstruída pelo executor (plano 10-10) para falar com `127.0.0.1:8000` e com o envio ligado: falta só abrir `chrome://extensions` e clicar no ↻ (Recarregar) do TaqCITi. Se ela ainda não estiver carregada: "Modo do desenvolvedor" ligado → "Carregar sem compactação" → escolha a pasta `taqciti/dist` do projeto. Para conferir: abra `chrome-extension://<ID>/src/sidepanel/index.html?view=agente`; o interruptor "Enviar a transcrição ao vivo para o Agente" tem que estar ligado e o campo "URL do backend do Agente" tem que mostrar `http://127.0.0.1:8000`.
4. **Extensão antiga desativada ou removida** (para não duplicar a captura).
5. **Dados de teste.** O backend local grava no Supabase de **produção**. Use só clientes com o nome `ZZ-TESTE-<assunto> <data>` (por exemplo `ZZ-TESTE-AGP 2026-10-30`). Nunca use cliente real. No fim, os clientes e sessões de teste são apagados por id (passo "Limpeza" em `.planning/TESTES-MANUAIS-POS-FASE-10.md`, item M9, com sessões primeiro e cliente depois).
6. **Gemini (só para os testes marcados "depende_de_ia: sim" ou "parte B").** Eles precisam de IA de verdade, com a chave do Gemini com crédito. Recarregar ou trocar a chave é ação de quem tem acesso a ela: o assistente nunca faz isso, e ninguém abre nem cola o conteúdo de arquivos de segredo (os arquivos de configuração com chaves) durante este roteiro. Para saber se há crédito: depois de 1 minuto de reunião vinculada, o terminal do backend não pode mostrar `402 RESOURCE_EXHAUSTED`. O backend falso (`taqciti/scripts/agp-fake-backend.py`) só serve aos testes automáticos; nunca vale como prova aqui (D-13, D-19).
7. **Pessoas e Meet.** Os testes usam uma reunião do Meet de verdade (pode ser uma "Nova reunião" só com você falando; o TaqCITi liga as legendas sozinho). Onde o teste pedir uma segunda aba, o Meet pode mostrar "Participar também".
8. **Console do DevTools (testes 8 e 10).** Se o Chrome avisar para não colar código no console, digite `allow pasting` e Enter antes de colar.

## Tests

### 1. Aba AGP sem cliente vinculado
depende_de_ia: não
origem: Gabriel (teste 1), ampliado com a 2ª frase da saída larga (M-5) e o contador oculto
expected: Sem cliente vinculado a aba AGP mostra só o aviso de vincular (sem pergunta) e não mostra número; na tela larga o aviso ganha uma 2ª frase.
como fazer:
  1. Entre numa reunião do Meet (abra `https://meet.google.com` → "Nova reunião" → "Iniciar uma reunião instantânea"). Espere o painel do TaqCITi passar de "Preparando a transcrição" para "Gravando" (alguns segundos) e fale uma frase.
  2. Se aparecer o cartão "Selecionar cliente agora", clique em "Depois". NÃO vincule nenhum cliente neste teste.
  3. No painel, procure as duas abas "Transcrição" e "AGP". Confira que "Transcrição" está selecionada e que não há número ao lado de "AGP".
  4. Fale outra frase e confira que ela aparece na transcrição, que rola normalmente.
  5. Clique em "AGP". Leia o aviso do painel e confira que não há nenhuma pergunta.
  6. Abra a tela larga (ver "Preparo comum"), clique em "AGP" e leia o aviso de lá.
esperado: |
  - No painel do Meet: abas "Transcrição" e "AGP"; "Transcrição" selecionada por padrão; nenhum número ao lado de "AGP" (o contador nunca mostra "0").
  - Ao clicar em "AGP" no painel do Meet, aparece exatamente: "Vincule esta reunião a um cliente para ver aqui as perguntas do Agente." Nenhuma pergunta, nem de outra sessão.
  - Na tela larga, o mesmo aviso ganha uma segunda frase: "O vínculo é feito no painel do TaqCITi dentro do Meet."
  - A transcrição rola normalmente nas duas telas.
result: [pending]

### 2. Perguntas reais do Agente aparecem na AGP com a lente
depende_de_ia: sim
origem: Gabriel (teste 2), com a prova de IA real exigida pelo D-13 e o contador da aba (M-4)
expected: Uma pergunta gerada pelo Agente aparece na aba AGP com o emblema da lente certa (Produto ou Dados) e o número ao lado de "AGP" sobe.
como fazer:
  1. Confirme o crédito do Gemini (item 6 do "Preparo comum"). Entre numa reunião do Meet e espere o painel mostrar "Gravando".
  2. Vincule: clique em "Selecionar cliente agora" → "Criar cliente novo" → nome `ZZ-TESTE-AGP <data>` → confirme → "Vincular reunião". Espere a barra mostrar "Enviando ao vivo para ZZ-TESTE-AGP <data>".
  3. Fale por 1 a 2 minutos, em frases curtas, misturando dois assuntos. Produto: a dor ou gargalo do cliente, como o processo funciona hoje, o que a solução precisa fazer. Dados: de onde vêm os dados, qualidade, planilhas, sistemas, LGPD. Se estiver sozinho, fale os dois lados da conversa.
  4. Em outra aba, abra o site do Agente (`http://localhost:5173`), entre no projeto `ZZ-TESTE-AGP <data>` e abra a sessão ativa.
  5. Espere cerca de 30 segundos e clique em "Gerar" (no alto da coluna "Perguntas").
  6. Volte à aba do Meet, deixe "Transcrição" selecionada e olhe o número ao lado de "AGP": ele deve subir sozinho, sem você clicar.
  7. Clique em "AGP" e leia os cartões. Se faltar uma das lentes, fale mais sobre o outro assunto e clique em "Gerar" de novo no site.
  8. Opcional, com leitor de tela (NVDA, por exemplo): ao focar o botão "AGP", ele deve ler "AGP, N perguntas" (ou "AGP, 1 pergunta").
esperado: |
  - Em poucos segundos depois do "Gerar" aparecem cartões de pergunta na aba AGP (se passar de 1 minuto sem nenhum, anote em "evidence:").
  - Cada cartão traz o emblema "Produto" (verde) ou "Dados" (cinza) e o texto da pergunta; não tem botão nenhum no cartão.
  - O número ao lado de "AGP" conta as perguntas e sobe mesmo com a aba "Transcrição" selecionada.
  - Pelo menos uma pergunta de cada lente apareceu ao longo do teste.
  - A pergunta nova entra no fim da lista. Anote em "evidence:" se, com a lista cheia, ela fica fora da vista e exige rolar (observação A-3 do UI-SPEC).
evidence:
result: [pending]

### 3. A pergunta na fila some quando o tempo dela acaba
depende_de_ia: sim
origem: Gabriel (teste 3), com o texto do D-09 corrigido (Armadilha 7)
expected: Sem fazer nada, a pergunta que estava na fila some da aba AGP quando o tempo dela acaba (30 s por padrão); uma pergunta fixada no site não some por tempo.
como fazer:
  1. Use a reunião vinculada do teste 2 (ou vincule uma nova a `ZZ-TESTE-AGP-3 <data>`). No site do Agente, clique em "Gerar" e volte ao Meet.
  2. Abra a aba AGP e anote a hora em que a pergunta apareceu. Agora NÃO faça nada: nem no site, nem no painel.
  3. Conte 40 segundos olhando a aba AGP. (O tempo padrão da fila é 30 s. Se o projeto tiver outro valor configurado, use esse.)
  4. Contra-prova: clique em "Gerar" de novo no site. Antes de 30 s, ainda no site, clique no alfinete ("Fixar") em uma dessas perguntas. Espere 60 segundos.
esperado: |
  - Passados os 30 s, a pergunta que ninguém tocou some da aba AGP de uma vez, sem animação de saída e sem barra de tempo (a Taqciti não tem relógio próprio: só obedece ao aviso do backend). O número ao lado de "AGP" desce junto. Se era a única, a aba mostra "Nenhuma pergunta por enquanto. Elas aparecem aqui conforme o Agente gera."
  - A pergunta fixada no site continua na aba AGP depois de 60 s: o backend só avisa a expiração de pergunta que ainda está na fila. (O selo "Fixada" ainda não aparece na Taqciti; isso é o teste 12.)
result: [pending]

### 4. Backend cai e volta
depende_de_ia: parte B
origem: Gabriel (teste 4), com a faixa fixa no topo (M-2); parte A não precisa de IA, parte B sim (D-13, D-19)
expected: Com o backend parado aparece "Reconectando ao Agente…" fixa no topo da aba e as perguntas já recebidas continuam; ao voltar o backend a faixa some sozinha, sem recarregar nada.
como fazer:
  Parte A (sem IA):
  1. Em uma reunião do Meet gravando, vincule a `ZZ-TESTE-AGP-4 <data>` e abra a aba AGP. Ela deve mostrar "Nenhuma pergunta por enquanto. Elas aparecem aqui conforme o Agente gera." e nenhuma faixa no topo.
  2. Pare o backend: clique na janela do terminal onde ele roda e aperte Ctrl+C. Confirme que o terminal voltou ao prompt.
  3. Em poucos segundos, olhe o topo da aba AGP: tem que aparecer a faixa "Reconectando ao Agente…". Deixe uns 20 segundos assim. (Se aparecer algum aviso sobre o envio ao Agente em outra parte do painel enquanto o backend está parado, é esperado e deve voltar ao normal junto.)
  4. Suba o backend de novo, com o mesmo comando do "Preparo comum". Espere até 40 segundos (a Taqciti tenta de novo com espera crescente: 1 s, 2 s, 4 s, até 30 s).
  5. Não clique em nada e não recarregue a página. Olhe o topo da aba AGP.
  Parte B (com IA):
  6. Com a reunião vinculada, gere pelo menos uma pergunta pelo site (como no teste 2) e confirme que ela aparece na aba AGP.
  7. Pare o backend (Ctrl+C) e, em seguida, olhe a aba AGP durante 20 segundos.
  8. Suba o backend de novo e espere até 40 segundos.
esperado: |
  - Parte A: sem backend aparece "Reconectando ao Agente…" fixa no topo da aba (não rola junto com a lista); sem botão e sem aviso sonoro. Com o backend de volta a faixa some sozinha, sem recarregar.
  - Parte B: durante a queda a pergunta já recebida continua na tela (a lista não esvazia) e a faixa "Reconectando ao Agente…" está no topo. Quando o backend volta a faixa some. A lista passa a ser a que o backend tem agora: uma pergunta da fila que passou do tempo nesse intervalo pode sumir, e isso é normal.
result: [pending]

### 5. Fim da call fecha a conexão
depende_de_ia: não
origem: Gabriel (teste 5)
expected: Ao sair da chamada o painel mostra o fim da reunião, a conexão com o Agente fecha e nunca fica "Reconectando…" nem reabre sozinha.
como fazer:
  1. Feche a página da sessão no site do Agente (`:5173`), se estiver aberta: ela também abre conexões `/ws` e atrapalharia a contagem abaixo.
  2. Em uma reunião gravando e vinculada a `ZZ-TESTE-AGP-5 <data>`, abra a aba AGP. Olhe o terminal do backend: deve ter uma linha parecida com `WebSocket /ws/<id da sessão>` com `[accepted]`. Aperte Enter umas 3 vezes no terminal só para marcar um "antes" visível.
  3. No Meet, clique no botão vermelho "Sair da chamada".
  4. Olhe o painel do TaqCITi: ele mostra a tela de fim da reunião (as abas "Transcrição" e "AGP" não existem nessa tela).
  5. Olhe o terminal do backend por 1 minuto. Anote o que apareceu depois do "antes".
esperado: |
  - Nunca aparece "Reconectando ao Agente…" depois do fim da chamada.
  - No terminal: uma linha parecida com `connection closed` e, em até cerca de 30 segundos, `POST /webhook/extension/sessions/<id>/finish` com 200.
  - Depois disso, nenhuma linha nova com `WebSocket /ws/` aparece (nenhuma reconexão depois do fim).
result: [pending]

### 6. Navegar para outro site no meio da call encerra a reunião (DA-4)
depende_de_ia: não
origem: Gabriel (teste 6), com as contra-provas
expected: Com a reunião gravando, ir com a MESMA aba para outro site encerra a reunião e fecha a sessão no Agente; recarregar a sala não encerra.
como fazer:
  1. Em uma reunião gravando e vinculada a `ZZ-TESTE-AGP-6 <data>`, fale uma frase e confirme que o painel mostra "Gravando". Abra a tela larga numa outra aba (ver "Preparo comum") para acompanhar.
  2. Contra-prova primeiro: na aba do Meet aperte F5 (recarregar). Se o Chrome perguntar "Recarregar o site?", clique em "Recarregar". Se o Meet pedir para entrar de novo, clique em "Participar agora". Olhe o painel e a tela larga: a reunião não pode virar "Transcrição salva".
  3. Prova: na MESMA aba do Meet, clique na barra de endereço, digite `example.com` e aperte Enter. Se o Chrome perguntar "Sair do site?", clique em "Sair".
  4. Em alguns segundos olhe a tela larga (se ela não mudou, recarregue só essa aba com F5) e olhe o terminal do backend por até 30 segundos.
esperado: |
  - Contra-prova: recarregar a sala NÃO encerra a reunião (nada de "Transcrição salva"; a mesma reunião continua, voltando a gravar quando você entra de novo).
  - Prova: depois de ir para `example.com` a tela larga mostra a reunião como encerrada ("Transcrição salva", com as falas no histórico) e o terminal mostra `POST /webhook/extension/sessions/<id>/finish` com 200.
result: [pending]

### 7. As duas telas ao vivo têm a aba AGP, e o visual está bom
depende_de_ia: parte B
origem: Gabriel (teste 7), ampliado com a conferência visual do UI-SPEC (degraus compact e regular, faixa fixa, quebra de linha, teclado); partes A sem IA, parte B com IA
expected: A aba AGP existe no painel do Meet e na tela larga; as abas funcionam com o teclado; nenhum degrau do painel corta a barra de abas; a faixa de status fica fixa ao rolar a lista; texto comprido sem espaços não cria rolagem para o lado.
como fazer:
  Parte A (sem IA):
  1. Em uma reunião gravando, olhe o painel do Meet: devem existir as abas "Transcrição" e "AGP". Clique nas duas e volte para "Transcrição".
  2. Teclado: clique na aba "Transcrição" e aperte a seta → do teclado; depois a seta ←. O foco e a seleção devem andar entre as duas abas (as outras teclas do Meet não podem ser roubadas).
  3. Degraus do painel: no cabeçalho do painel use os botões "Comprimir" e "Expandir" para passar pelos três tamanhos (compacto, médio e alto). Em cada tamanho confira que a barra de abas aparece inteira, sem corte, e que a transcrição continua rolando.
  4. Abra a tela larga numa aba (ver "Preparo comum") e confira que lá também existem as abas "Transcrição" e "AGP" e que a transcrição rola.
  Parte B (com IA, com a reunião vinculada):
  5. Gere 3 a 5 perguntas pelo site (pode ser em duas vezes). No tamanho compacto do painel, role a lista da aba AGP.
  6. Faixa fixa: com a lista rolando, pare o backend (Ctrl+C) para a faixa "Reconectando ao Agente…" aparecer e role a lista de novo. Depois suba o backend.
  7. Texto comprido: se alguma pergunta real trouxer um trecho longo sem espaços (um endereço de site, por exemplo), confira que ele quebra dentro do cartão. Se nenhuma trouxer, peça a quem conduz o teste este procedimento assistido: clique com o botão direito num cartão do painel → "Inspecionar", dê duplo clique no texto da pergunta e cole uma sequência de 120 letras "a" sem espaços.
  8. Opcional, com leitor de tela: confira que o botão "AGP" é lido como "AGP, N perguntas".
esperado: |
  - A aba AGP existe no painel do Meet e na tela larga, e a transcrição continua rolando nas duas.
  - As setas ← e → movem entre as duas abas, sem atrapalhar o teclado do Meet.
  - Nos três tamanhos do painel a barra de abas aparece inteira; nos compactos, uma pergunta ou duas já ocupam a lista, e ela rola.
  - A faixa "Reconectando ao Agente…" fica parada no topo da aba enquanto a lista rola por baixo.
  - O texto sem espaços quebra dentro do cartão e não aparece rolagem horizontal em nenhum tamanho do painel.
evidence:
result: [pending]

### 8. "Continuar envio" durante o encerramento da sessão é ignorado (procedimento assistido)
depende_de_ia: não
origem: D-02 / WR-05 (plano 10-01); recusa silenciosa decidida no D-18
expected: Clicar em "Continuar envio" enquanto a Taqciti está encerrando a sessão no Agente não faz nada (recusa silenciosa) e o encerramento termina; depois dele o botão volta a funcionar.
como fazer:
  Este é o único teste que exige um truque no DevTools. Faça-o junto com quem conhece o Chrome DevTools; se o truque não funcionar do jeito descrito, anote o que viu em "evidence:" em vez de forçar.
  1. Faça uma reunião curta SEM vincular cliente (fale umas frases) e saia da chamada. O painel deve perguntar "Enviar esta reunião ao Agente?".
  2. Preparar o envio que vai parar no meio: em `chrome://extensions`, no cartão do TaqCITi, clique em "service worker" (abre uma janela do DevTools). Abra a aba "Network" (Rede). Aperte Ctrl+Shift+P, digite "Show Network request blocking", Enter, clique em "Add pattern" (adicionar padrão), escreva `*/webhook/extension` e aperte Enter. Isso bloqueia só o envio das falas e deixa a criação da sessão passar.
  3. No painel, clique em "Selecionar cliente" → crie `ZZ-TESTE-WR05 <data>` → "Enviar reunião". Espere aparecer "O envio parou na parte X de Y. O que já chegou continua no Agente." com o botão "Continuar envio". Anote a hora: a Taqciti agora tem 5 minutos para encerrar a sessão sozinha.
  4. Antes de passar 5 minutos, no DevTools do service worker, na aba "Network", abra o menu de limitação de rede (Throttling), escolha "Add..." e crie um perfil com latência de 6000 ms (e velocidades de 500 kb/s); selecione esse perfil. Assim cada pedido da Taqciti demora uns 6 s (menos que o limite de 10 s).
  5. Espere. Entre 5:00 e cerca de 5:30 depois da falha vai aparecer na lista do Network um pedido chamado `finish`, ainda pendente. Assim que ele aparecer, volte rápido ao painel e clique UMA vez em "Continuar envio" (você tem uns 6 segundos).
  6. Olhe o cartão do painel enquanto o `finish` termina.
  7. Depois do `finish`, desmarque o padrão em "Network request blocking", volte a limitação para "No throttling" e clique em "Continuar envio" de novo.
  8. Opcional, para quem conduz: logo depois do clique do passo 5, no Console do DevTools do service worker, rode `chrome.storage.local.get('taq:agenteAssociations').then(console.log)` e confirme que a reunião ainda está com `state: "send-failed"` e com o prazo `finishBy` preenchido.
esperado: |
  - Passo 5: o clique em "Continuar envio" não faz nada visível: o cartão continua "O envio parou na parte X de Y..." com o botão (não vira "Enviando para…", não aparece barra de progresso). A recusa é silenciosa de propósito (D-18).
  - Passo 6: quando o `finish` termina com sucesso (status 200), o cartão ganha o aviso "A sessão no Agente já foi encerrada. O restante entra na transcrição, mas o relatório precisa ser gerado de novo."
  - Passo 7: agora "Continuar envio" funciona: o cartão passa a "Enviando para ZZ-TESTE-WR05 <data>…" com a barra e termina em "Reunião enviada para ZZ-TESTE-WR05 <data>."
evidence:
result: [pending]

### 9. A mesma reunião em duas abas não encerra quando uma aba sai
depende_de_ia: não
origem: D-03 e D-16 (planos 10-02 e 10-06); confirma as suposições A3 e A4 da pesquisa (a Taqciti consegue ler a aba e a 2ª aba também avisa que entrou na call)
expected: Com a mesma call aberta em duas abas, fechar a 2ª aba, sair da call na 2ª aba ou levar a 2ª aba para outro site não encerra a reunião da 1ª; só encerra, uma única vez, quando a última aba sai.
como fazer:
  Rodada A (uma reunião vinculada a `ZZ-TESTE-AGP-9 <data>`; sem IA):
  1. Entre na call na aba 1 e espere o painel mostrar "Gravando". Vincule o cliente `ZZ-TESTE-AGP-9 <data>`.
  2. Abra o mesmo link da reunião numa aba nova (aba 2) e, se o Meet perguntar, escolha "Participar também". Entre na call, espere o painel da aba 2 mostrar "Gravando" e fale uma frase.
  3. Feche a aba 2 (X da aba). Volte à aba 1 e fale outra frase.
  4. Abra o link numa aba 2 de novo, entre na call e, nela, saia da chamada (botão vermelho). Volte à aba 1 e fale outra frase.
  5. Abra o link numa aba 2 de novo, entre na call e, nela, digite `example.com` na barra de endereço (se o Chrome perguntar "Sair do site?", clique "Sair"). Volte à aba 1 e fale outra frase.
  6. Por fim abra uma aba 2 de novo, entre na call, saia da chamada na aba 2 e, depois, saia da chamada na aba 1. Olhe o terminal do backend por 30 segundos.
  Rodada B (reunião nova, curta):
  7. Entre na call na aba 1, vincule `ZZ-TESTE-AGP-9B <data>` e espere "Gravando". Abra o mesmo link numa aba 2, mas NÃO entre na call: deixe a aba 2 parada na tela de pré-entrada ("Participar agora"). Na aba 1 saia da chamada e olhe a tela larga e o terminal do backend por 30 segundos.
esperado: |
  - Passos 3, 4 e 5: a aba 1 continua "Gravando" e as falas novas continuam entrando na transcrição; a reunião não vira "Transcrição salva".
  - Passo 6: a reunião encerra uma única vez, só depois de sair nas duas abas: o terminal mostra exatamente UMA linha `POST /webhook/extension/sessions/<id>/finish` com 200.
  - Passo 7: a aba parada na pré-entrada não segura a reunião: ao sair da chamada na aba 1 a reunião encerra normalmente.
  - Se algum passo 3 a 5 encerrar a reunião da aba 1, anote qual passo foi e se a aba 2 estava com as legendas ligadas (se a Taqciti não "enxerga" a outra aba, ela encerra de propósito; é o comportamento seguro, D-17).
result: [pending]

### 10. Ir para a Nova Guia (`chrome://`) encerra a reunião, e o aviso de instalação não muda (D-04)
depende_de_ia: não
origem: D-04 / WR-06 (plano 10-04, permissão "tabs"); mede as suposições A1 e A2 da pesquisa
expected: Com a permissão "tabs", levar a aba da reunião para a Nova Guia encerra a reunião (A1); a lista de avisos de instalação é igual com e sem "tabs" (A2).
como fazer:
  Parte A (DA-4 com `chrome://`):
  1. Com a permissão nova já carregada (↻ no TaqCITi), entre em uma reunião e espere o painel mostrar "Gravando". Fale uma frase.
  2. Na MESMA aba do Meet, clique na barra de endereço, digite `chrome://newtab` e aperte Enter. (Se a aba nasceu de uma Nova Guia, também vale apertar Alt+← até chegar nela.) Se o Chrome perguntar "Sair do site?", clique em "Sair".
  3. Em alguns segundos abra a tela larga (ver "Preparo comum") e olhe a reunião.
  Parte B (medir os avisos, sem instalar nada):
  4. Com a tela larga aberta, aperte F12 e abra a aba "Console".
  5. Cole este comando e aperte Enter (manifesto atual, com "tabs"), e anote a saída em "evidence:":
     `(async () => { const t = await (await fetch(chrome.runtime.getURL('manifest.json'))).text(); console.log('COM tabs:', JSON.stringify(await chrome.management.getPermissionWarningsByManifest(t))); })()`
  6. Cole este segundo comando e aperte Enter (mesmo manifesto sem "tabs"), e anote a saída em "evidence:":
     `(async () => { const m = JSON.parse(await (await fetch(chrome.runtime.getURL('manifest.json'))).text()); m.permissions = m.permissions.filter((p) => p !== 'tabs'); console.log('SEM tabs:', JSON.stringify(await chrome.management.getPermissionWarningsByManifest(JSON.stringify(m)))); })()`
  7. Compare as duas linhas.
esperado: |
  - Parte A: em poucos segundos a reunião aparece como encerrada ("Transcrição salva"). Isso confirma A1: com "tabs", o Chrome avisa a Taqciti que a aba foi para `chrome://`.
  - Parte B: as duas listas de avisos são iguais, sem um aviso a mais sobre "histórico de navegação" no manifesto com "tabs". Isso confirma A2: como a Taqciti já pede acesso a todos os sites, "tabs" não acrescenta aviso (e então, em tese, não desativa a extensão de quem já a tem).
  - Se as listas forem diferentes, anote as duas em "evidence:": não é defeito do código, é o custo do D-04 (o Chrome desativa a extensão até a pessoa aceitar a permissão), e o time precisa decidir como comunicar quando houver distribuição.
  - Limite: carregar a pasta e dar ↻ não exercita o diálogo de nova permissão (isso só acontece numa atualização de pacote instalado); a prova definitiva só vem na distribuição.
evidence:
result: [pending]

### 11. O feed fecha em pausa ou com o envio desligado e mantém as perguntas
depende_de_ia: sim
origem: D-11 / WR-04 (plano 10-03, faixa "Pausado" do plano 10-07)
expected: Em pausa, ou com o envio ao Agente desligado, a aba AGP mantém as perguntas com a faixa "Pausado · mostrando as últimas perguntas" e o backend não recebe conexão nova; ao voltar, reconecta mantendo a lista.
como fazer:
  1. Em uma reunião gravando e vinculada a `ZZ-TESTE-AGP-11 <data>`, gere perguntas pelo site até aparecer pelo menos uma na aba AGP. No site, clique em "Fixar" (alfinete) em uma delas: assim ela continua existindo no backend durante a pausa.
  2. Feche a página da sessão no site do Agente (`:5173`): ela também abre conexões `/ws` e atrapalharia a conferência do terminal. No terminal do backend aperte Enter umas 3 vezes para marcar um "antes" visível.
  3. No painel clique em "Pausar". Olhe a aba AGP.
  4. Passe o mouse sobre a faixa "Pausado" e leia a dica. Olhe o terminal do backend por 60 segundos.
  5. Depois de mais de 60 segundos (tempo de sobra para o service worker dormir), clique em "Retomar" e olhe a aba AGP e o terminal.
  6. Repetir com o envio desligado: abra `chrome-extension://<ID>/src/sidepanel/index.html?view=agente` e desligue o interruptor "Enviar a transcrição ao vivo para o Agente". Volte à aba do Meet e olhe a aba AGP e o terminal por 60 segundos. Ligue o interruptor de novo e olhe de novo.
  7. Em `evidence:` cole o trecho do terminal do backend (só as linhas com `WebSocket /ws/` e `connection`), sem nada além disso.
esperado: |
  - Passo 3: a aba AGP mostra a faixa "Pausado · mostrando as últimas perguntas" com um ícone de pausa, e as perguntas continuam na tela. O número ao lado de "AGP" continua.
  - Passo 4: a dica diz "A atualização volta sozinha quando a captura estiver gravando e o envio ao Agente estiver ligado." No terminal não aparece nenhuma linha nova `WebSocket /ws/` durante a pausa (a linha `connection closed` do instante da pausa é normal).
  - Passo 5: ao retomar passa por "Conectando ao Agente…" mantendo a lista, e depois por um estado normal, com a lista do backend (a pergunta fixada continua; perguntas da fila podem ter expirado). O terminal mostra UMA conexão nova.
  - Passo 6: com o envio desligado a aba AGP mostra a faixa "Pausado" e o terminal não mostra conexão nova; ao religar, volta a conectar.
evidence:
result: [pending]

### 12. Fixar ou descartar no site não muda a aba AGP até reconectar (D-09 corrigido)
depende_de_ia: sim
origem: D-09 corrigido em 2026-10-28 (Armadilha 7 da pesquisa)
expected: Fixar ou descartar uma pergunta no site não altera a aba AGP na hora; depois de a Taqciti reconectar a aba mostra o estado real.
como fazer:
  1. Em uma reunião gravando e vinculada a `ZZ-TESTE-AGP-12 <data>`, gere perguntas pelo site (botão "Gerar") até a aba AGP ter pelo menos duas.
  2. Depressa, antes de 30 s (depois a fila expira sozinha), no site: clique em "Fixar" (alfinete) numa pergunta e em "Descartar" (X) em outra.
  3. Volte à aba AGP e olhe os dois cartões. Espere 1 minuto e olhe de novo.
  4. Faça a Taqciti reconectar: pare o backend (Ctrl+C), espere uns 15 segundos e suba de novo; espere até 40 segundos. (Alternativa mais rápida: clique em "Pausar", espere 10 segundos e clique em "Retomar".)
  5. Olhe a aba AGP de novo.
esperado: |
  - Passo 3: a pergunta fixada e a pergunta descartada no site continuam na aba AGP, e a fixada não mostra o selo "Fixada". O backend não avisa fixar nem descartar por WebSocket: fixar ou descartar no site não tira nada da aba AGP, o cartão continua na aba AGP até a Taqciti reconectar. Isso é o combinado da fase (D-09) e a Fase 10.1 resolve.
  - Passo 5: depois da reconexão a aba mostra o estado real: a pergunta fixada aparece com o selo "Fixada" e a descartada sumiu.
evidence:
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

[none yet]

## Ordem sugerida

Os testes se dividem pelo que dependem (D-13, D-19):
- **Sem crédito do Gemini (sem IA):** 1, 4 (parte A), 5, 6, 7 (parte A), 8, 9 e 10. Rode estes primeiro.
- **Com crédito do Gemini (precisam de pergunta de verdade):** 2, 3, 4 (parte B), 7 (parte B), 11 e 12. Só rode depois de confirmar o crédito (item 6 do "Preparo comum"). Enquanto não houver crédito, deixe-os "blocked" com o motivo "Gemini sem crédito (D-13)"; o backend falso nunca conta como prova final.

Dicas para juntar chamadas (menos reuniões para fazer):
- Uma chamada só pode cobrir 1, 7 (parte A) e 4 (parte A) e terminar com o 5 (sair da chamada).
- Os testes 6 e 10 encerram a reunião de propósito, então cada um pede uma chamada própria.
- Uma única chamada vinculada e com IA pode cobrir 2, 3, 4 (parte B), 7 (parte B), 11 e 12, nessa ordem.
- O teste 9 pede duas rodadas (A e B), e o 8 acontece depois de uma chamada já encerrada.
