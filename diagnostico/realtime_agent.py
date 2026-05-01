# =============================================================================
# realtime_agent.py
#
# RealtimeOrchestrator: o coordenador central do modo tempo real.
#
# É quem cria e gerencia todas as "tasks" (tarefas paralelas) do asyncio,
# conecta os componentes e controla o ciclo de vida da sessão.
#
# Como o asyncio funciona aqui?
# O asyncio é um modelo de concorrência cooperativa (não paralela):
# há apenas UMA thread rodando, mas várias corrotinas podem estar "em andamento"
# ao mesmo tempo. A chave é o "await": quando uma corrotina faz await, ela
# CEDE o controle de volta ao event loop, que pode então rodar outra corrotina.
#
# Neste arquivo, temos 5 corrotinas rodando "ao mesmo tempo":
#   - _ingestion_task    → recebe chunks do Taqtic/stdin
#   - _coverage_task     → classifica áreas de risco a cada 30s
#   - _watchdog_task     → verifica se o stream pausou
#   - _render_task       → atualiza o painel a cada 250ms
#   - _commands.run()    → captura teclas do teclado
#
# Elas não disputam por CPU — cada uma faz seu trabalho e cede o controle
# para as outras via await.
#
# Por que o classificador roda em asyncio.to_thread()?
# O GeminiClient.generate() é uma chamada síncrona bloqueante — enquanto
# espera a resposta do Gemini, NADA mais roda (o event loop fica travado).
# asyncio.to_thread() executa a chamada em uma thread separada do pool, de
# forma que o event loop continua rodando as outras tasks normalmente.
# =============================================================================

import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from agent import _build_coverage_summary
from analysis.question_planner import QuestionPlanner
from analysis.red_flag import RedFlagDetector
from conversation import ConversationManager
from coverage.classifier import CoverageClassifier
from coverage.tracker import CoverageTracker
from llm.base import LLMClient, Message
from prompts import SYSTEM_PROMPT, REPORT_PROMPT
from report import ReportGenerator
from transcription.base import TranscriptionSource
from transcription.buffer import TranscriptBuffer
from ui.base import BaseRenderer
from ui.renderer import CLIRenderer
from ui.commands import CommandHandler


class RealtimeOrchestrator:
    """Coordena todos os componentes do modo tempo real.

    Recebe uma TranscriptionSource e orquestra:
    - Ingestão de chunks → buffer → (futuro: classificação)
    - Renderização contínua do painel
    - Watchdog para detectar pausa no stream
    - Captura de comandos do teclado

    Como funciona o encerramento?
    Usamos um asyncio.Event chamado _shutdown. Quando alguém quer encerrar
    (tecla Q, fim do stream, erro), chama _shutdown.set(). Todas as tasks
    monitoram esse evento e encerram quando ele é disparado.
    Por que Event em vez de um bool simples? O Event permite que tasks façam
    await nele — ficam suspensas até o evento ser disparado, sem ficar
    verificando em loop ocupado (busy-wait).
    """

    # Constantes de configuração das tasks
    STREAM_PAUSE_TIMEOUT_SECS = 60   # após 60s sem chunk → mostra "stream pausado"
    RENDER_INTERVAL_SECS = 0.25      # re-renderiza o painel a cada 250ms
    WATCHDOG_INTERVAL_SECS = 10      # verifica pause a cada 10s

    # Intervalos do classificador de cobertura:
    # COVERAGE_INTERVAL_SECS: tempo base entre classificações (timer de 30s).
    # EARLY_TRIGGER_TOKENS: se o buffer acumular essa qtde de tokens novos antes
    # dos 30s, a classificação é disparada antecipadamente — evita perder red flags
    # críticos mencionados em rajadas de fala.
    COVERAGE_INTERVAL_SECS = 30
    EARLY_TRIGGER_TOKENS = 250

    # Intervalo do detector de red flags (timer de 15s).
    # Menor que o classificador porque red flags precisam aparecer rápido —
    # o comercial não pode esperar 30s para saber que o cliente acabou de dizer
    # "temos que entregar em 2 semanas" ou "nunca testamos OAuth".
    RED_FLAG_INTERVAL_SECS = 15

    def __init__(
        self,
        source: TranscriptionSource,
        llm: LLMClient | None = None,
        tracker: CoverageTracker | None = None,
        renderer: BaseRenderer | None = None,
        saturation_threshold: float = 0.85,
        reports_dir: str = "reports",
    ) -> None:
        self._source = source
        self._llm = llm  # None = sem classificação real (modo sem API key)
        self._reports_dir = reports_dir
        # Se não passar um tracker customizado, cria um novo com as 8 áreas universais
        self._tracker = tracker or CoverageTracker()
        self._buffer = TranscriptBuffer()
        # Renderer injetado: CLIRenderer (padrão) ou WebRenderer (modo web).
        # Se veio um renderer externo já instanciado (ex: WebRenderer com tracker
        # compartilhado), usa-o. Caso contrário cria o CLIRenderer padrão.
        self._renderer: BaseRenderer = renderer if renderer is not None else CLIRenderer(self._tracker)
        self._commands = CommandHandler()
        # Handlers de comando compartilhados entre teclado (CLI) e WebSocket (web).
        # Preenchido em _setup_commands() e consultado por _web_command_task().
        self._handlers: dict[str, Any] = {}

        # asyncio.Event: começa não-disparado (is_set() == False).
        # Quando alguém chama _shutdown.set(), todas as tasks que fazem
        # "await _shutdown.wait()" acordam e podem encerrar.
        self._shutdown = asyncio.Event()

        # ConversationManager acumula os chunks de transcrição como histórico.
        # É passado ao agente de relatório para que o LLM tenha contexto
        # da reunião além do mapa de cobertura.
        self._conversation = ConversationManager()
        # Injeta o SYSTEM_PROMPT para o LLM manter o perfil de tech lead
        # mesmo no relatório gerado a partir da transcrição.
        self._conversation.add_message("system", SYSTEM_PROMPT)

        self._saturation_threshold = saturation_threshold
        self._suggested_questions: list[dict] = []
        # Quantidade de chunks no buffer quando as perguntas foram geradas pela
        # última vez. Evita replanejar quando não chegou conteúdo novo do cliente.
        self._last_planned_chunk_count: int = 0

        # O classificador e o detector são criados só se houver um LLM disponível.
        # Isso permite rodar o modo realtime sem API key — útil para testar
        # o painel visual e a ingestão de chunks sem gastar tokens.
        self._classifier: CoverageClassifier | None = (
            CoverageClassifier(llm=llm, tracker=self._tracker, buffer=self._buffer)
            if llm is not None
            else None
        )

        # O RedFlagDetector usa o mesmo LLM e buffer, mas é independente do
        # classificador — roda num timer menor (15s) e analisa uma janela
        # fixa recente (não deltas), focado só em emitir alertas pontuais.
        self._red_flag_detector: RedFlagDetector | None = (
            RedFlagDetector(llm=llm, buffer=self._buffer)
            if llm is not None
            else None
        )

        # O QuestionPlanner é usado quando o comercial pressiona P.
        # Ao contrário dos outros componentes, não roda em timer — é puramente
        # sob demanda. Mantém internamente o histórico de sugestões anteriores
        # para não repetir as mesmas perguntas a cada pressão de P.
        self._planner: QuestionPlanner | None = (
            QuestionPlanner(llm=llm, tracker=self._tracker, buffer=self._buffer)
            if llm is not None
            else None
        )

    # ── Wiring dos comandos de teclado ───────────────────────────────────────

    def _setup_commands(self) -> None:
        """Conecta cada tecla a sua ação correspondente.

        As funções on_p, on_r, on_s, on_q são closures: capturam self por
        referência e podem acessar todos os atributos do orchestrator.

        Por enquanto (passos 1-4), P/R/S mostram mensagens de placeholder.
        Nas próximas etapas:
          - P → QuestionPlanner.plan() (passo 8)
          - R → agent.generate_report() + mapa de cobertura (passo 11)
          - S → CoverageClassifier.classify() manual (passo 6)
          - Q → _shutdown.set() (já implementado)
        """
        async def on_p() -> None:
            # P agora é "atualizar perguntas" — perguntas são geradas automaticamente
            # pelo _coverage_task, mas o comercial pode forçar uma atualização manual.
            if self._planner is None:
                self._renderer.add_alert(
                    "warning",
                    "Planner indisponível — configure GEMINI_API_KEY para habilitar.",
                )
                return

            self._renderer.add_alert("warning", "⏳ Atualizando perguntas…")
            questions = await asyncio.to_thread(self._planner.plan)

            if not questions:
                self._renderer.add_alert("warning", "Todas as áreas de risco já estão cobertas.")
                return

            self._suggested_questions = questions
            self._renderer.set_suggestions(questions)

        async def on_r() -> None:
            # Gera o relatório com o mapa de cobertura prefixado.
            # Só é possível se houver LLM configurado.
            if self._llm is None:
                self._renderer.add_alert(
                    "warning",
                    "Relatório indisponível — configure GEMINI_API_KEY.",
                )
                return

            self._renderer.add_alert("warning", "⏳ Gerando relatório...")

            # Executa em thread separada: generate() é síncrono/bloqueante
            try:
                filepath = await asyncio.to_thread(self._generate_report)
                self._renderer.add_alert(
                    "warning",
                    f"✅ Relatório salvo em: {filepath.name}",
                )
            except Exception as exc:
                self._renderer.add_alert("critical", f"Erro ao gerar relatório: {exc}")

        async def on_s() -> None:
            # Força uma classificação imediata, independente do timer de 30s.
            # Útil quando o comercial percebe que o cliente acabou de revelar
            # algo importante e quer ver o mapa atualizado agora.
            if self._classifier is None:
                self._renderer.add_alert("warning", "Classificador indisponível (LLM não configurado).")
                return
            # asyncio.to_thread() executa a chamada síncrona ao LLM em uma thread
            # separada, sem bloquear o event loop (e portanto sem travar o painel).
            changed = await asyncio.to_thread(self._classifier.classify)
            if changed:
                self._renderer.add_alert("warning", "✓ Mapa de cobertura atualizado manualmente.")
            else:
                self._renderer.add_alert("warning", "Nenhuma mudança detectada no trecho atual.")

        async def on_q() -> None:
            # Dispara o evento de shutdown — todas as tasks vão encerrar
            self._shutdown.set()
            # Para o loop de teclado imediatamente (sem esperar o timeout de 0.5s)
            self._commands.stop()

        self._commands.on("p", on_p)
        self._commands.on("r", on_r)
        self._commands.on("s", on_s)
        self._commands.on("q", on_q)

        # Mapa de comando → handler, usado pelo _web_command_task para despachar
        # mensagens JSON do WebSocket para os mesmos handlers do teclado.
        self._handlers = {
            "questions": on_p,
            "report":    on_r,
            "sync":      on_s,
            "quit":      on_q,
        }

    # ── Geração de relatório ─────────────────────────────────────────────────

    def _generate_report(self) -> Path:
        """Gera o relatório de diagnóstico com o mapa de cobertura prefixado.

        Este método é SÍNCRONO — chamado via asyncio.to_thread() para não
        bloquear o event loop durante a chamada ao LLM.

        Fluxo:
        1. Serializa o mapa de cobertura final (tracker) em texto estruturado
        2. Monta o prompt de relatório augmentado: mapa + REPORT_PROMPT original
        3. Combina com o histórico de transcrição (ConversationManager)
        4. Chama o LLM para gerar o relatório em Markdown
        5. Salva em reports/diagnostico_YYYYMMDD_HHMMSS.md

        Por que não usar DiagnosticAgent.generate_report_with_coverage()?
        O orchestrator não tem um DiagnosticAgent — a entrevista no modo
        realtime é a própria transcrição, não perguntas do agente. Usar
        o agente criaria um acoplamento desnecessário. Fazemos aqui a mesma
        lógica: histórico + prompt augmentado.

        Returns:
            Path do arquivo salvo (para exibir no painel de alertas).
        """
        # Serializa o mapa de cobertura com ícones de status e evidências
        coverage_summary = _build_coverage_summary(self._tracker)

        # Augmenta o REPORT_PROMPT com o mapa de cobertura.
        # O mapa vai ANTES das instruções de formato para que o LLM o leia
        # primeiro e o use ativamente ao preencher cada seção do relatório.
        augmented_prompt = (
            "=== MAPA DE COBERTURA FINAL DA REUNIÃO ===\n"
            f"{coverage_summary}\n\n"
            "Use o mapa acima para preencher a seção 4 (Perguntas sem resposta) "
            "com as áreas que ficaram em RED, e para calibrar o nível de "
            "complexidade baseado na profundidade real do diagnóstico.\n\n"
            f"{REPORT_PROMPT}"
        )

        # Monta a lista de mensagens: histórico de transcrição + prompt augmentado.
        # O histórico já contém o SYSTEM_PROMPT (adicionado no __init__) e todos
        # os chunks de transcrição adicionados pelo _ingestion_task.
        history_with_report = self._conversation.get_history() + [
            Message(role="user", content=augmented_prompt)
        ]

        # Gera o relatório — chamada síncrona ao LLM (pode levar 10-30s)
        report_content = self._llm.generate(history_with_report)

        # Salva em disco com timestamp no nome do arquivo
        reporter = ReportGenerator(self._reports_dir)
        filepath = reporter.save(report_content)

        return filepath

    # ── Tasks assíncronas ────────────────────────────────────────────────────

    async def _ingestion_task(self) -> None:
        """Consome chunks da fonte de transcrição e os acumula no buffer.

        "async for" funciona com geradores assíncronos: a cada iteração,
        espera o próximo chunk sem bloquear o event loop. Enquanto aguarda,
        outras tasks (render, watchdog, keyboard) continuam rodando.

        Ao terminar (fonte esgotou ou shutdown foi solicitado), dispara o
        _shutdown para que as outras tasks encerrem também.
        """
        async for chunk in self._source.stream():
            if self._shutdown.is_set():
                break  # alguém pediu encerramento durante a iteração → para

            self._buffer.append(chunk)
            # Adiciona o chunk ao ConversationManager para que o relatório
            # final tenha a transcrição completa no histórico de contexto.
            self._conversation.append_transcript(chunk)
            # Quando um chunk chega, o stream não está mais pausado
            self._renderer.set_stream_paused(False)

            # Verifica saturação após cada chunk (barato: apenas aritmética,
            # sem chamada ao LLM). Quando o classificador for implementado,
            # a saturação será atualizada pelo tracker, não aqui.
            if self._tracker.is_saturated(self._saturation_threshold):
                self._renderer.set_saturated(True)

        # Fonte esgotada (EOF do stdin, por exemplo) → dispara shutdown
        self._shutdown.set()

    async def _watchdog_task(self) -> None:
        """Verifica periodicamente se o stream de transcrição está ativo.

        Roda a cada WATCHDOG_INTERVAL_SECS (10s). Se o último chunk chegou
        há mais de STREAM_PAUSE_TIMEOUT_SECS (60s), o stream provavelmente
        caiu ou a reunião pausou — mostra aviso no painel.

        Por que asyncio.wait_for + asyncio.shield?
        Queremos "dormir por 10s ou acordar se o shutdown for disparado,
        o que vier primeiro". wait_for com timeout faz isso.

        asyncio.shield() é necessário porque wait_for() cancela a corrotina
        interna quando o timeout estoura. Sem shield(), cancelar o wait_for
        cancelaria o próprio _shutdown.wait(), tornando o evento inutilizável
        para futuras esperas. shield() cria um "escudo" que protege a corrotina
        interna de ser cancelada.
        """
        while not self._shutdown.is_set():
            try:
                # Espera até 10s. Se _shutdown for disparado antes, acorda cedo.
                await asyncio.wait_for(
                    asyncio.shield(self._shutdown.wait()),
                    timeout=self.WATCHDOG_INTERVAL_SECS,
                )
                break  # _shutdown foi disparado → encerra o watchdog
            except asyncio.TimeoutError:
                # Passou 10s sem shutdown → verifica se o stream pausou
                last = self._buffer.last_chunk_at()
                if last and datetime.now() - last > timedelta(seconds=self.STREAM_PAUSE_TIMEOUT_SECS):
                    self._renderer.set_stream_paused(True)

    async def _coverage_task(self) -> None:
        """Executa o CoverageClassifier periodicamente para atualizar o mapa de risco.

        Lógica de gatilho (qual vem primeiro):
        1. Timer base de COVERAGE_INTERVAL_SECS (30s) → classificação normal.
        2. Early trigger: se o buffer acumulou >EARLY_TRIGGER_TOKENS (250 tokens)
           antes dos 30s, classifica imediatamente para não perder red flags.

        Por que usar "sleep interrompível" em vez de asyncio.sleep() puro?
        asyncio.sleep(30) faria o shutdown esperar até 30s após o Q ser pressionado.
        Com wait_for + shield, acordamos cedo quando o shutdown é disparado.

        Por que asyncio.to_thread()?
        O GeminiClient.generate() bloqueia (chamada HTTP síncrona). Se fizéssemos
        await classifier.classify() diretamente, o event loop travaria durante a
        chamada ao Gemini — o painel pararia de renderizar, o teclado não
        responderia, etc. asyncio.to_thread() move a chamada para uma thread do
        pool de threads do Python, liberando o event loop.
        """
        # Não inicia se não houver classificador (sem LLM configurado)
        if self._classifier is None:
            return

        elapsed = 0.0        # tempo acumulado desde a última classificação
        tick = 1.0           # granularidade do "relógio interno" (1s por tick)

        while not self._shutdown.is_set():
            # Verifica early trigger: muitos tokens novos antes do timer base
            tokens_new = self._buffer.tokens_since_flush()
            time_elapsed = elapsed >= self.COVERAGE_INTERVAL_SECS
            early_trigger = tokens_new >= self.EARLY_TRIGGER_TOKENS

            if time_elapsed or early_trigger:
                # Reseta o contador de tempo antes de chamar o LLM.
                # Mesmo que a chamada demore 2-3s, não acumulamos esse atraso
                # no próximo intervalo — mantemos cadência próxima de 30s.
                elapsed = 0.0

                # Executa o classificador em thread separada para não bloquear
                # o event loop durante a chamada síncrona ao Gemini.
                await asyncio.to_thread(self._classifier.classify)

                # Verifica saturação após cada classificação — o tracker foi
                # atualizado, então o score pode ter mudado.
                if self._tracker.is_saturated(self._saturation_threshold):
                    self._renderer.set_saturated(True)

                # Auto-planejamento: só replanejar se chegou conteúdo novo do
                # cliente desde a última geração. Evita chamar o LLM em loop
                # quando o cliente para de falar.
                current_chunks = self._buffer.chunk_count()
                if self._planner is not None and current_chunks > self._last_planned_chunk_count:
                    questions = await asyncio.to_thread(self._planner.plan)
                    if questions:
                        self._suggested_questions = questions
                        self._renderer.set_suggestions(questions)
                        self._last_planned_chunk_count = current_chunks

            # "Dorme" por 1 tick, mas acorda cedo se o shutdown for disparado.
            # Isso mantém a granularidade de 1s no early trigger sem travar
            # o shutdown por até 30s.
            try:
                await asyncio.wait_for(
                    asyncio.shield(self._shutdown.wait()),
                    timeout=tick,
                )
                break   # shutdown disparado → encerra a task
            except asyncio.TimeoutError:
                elapsed += tick  # passou 1s sem shutdown → incrementa o contador

    async def _red_flag_task(self) -> None:
        """Executa o RedFlagDetector a cada RED_FLAG_INTERVAL_SECS (15s).

        Diferente do _coverage_task (que roda a cada 30s e analisa deltas),
        este task roda a cada 15s e analisa a janela mais recente de transcrição
        (~600 tokens = ~60-90s de fala). O foco é velocidade de reação — o
        comercial precisa ver o alerta antes que o assunto mude.

        Não há early trigger aqui: o detector deve rodar no timer fixo
        para não fazer chamadas em rajada quando o cliente fala muito de uma vez.
        Uma chamada a cada 15s já garante latência máxima de ~20s (15s de timer
        + ~2-3s de chamada ao LLM) — suficiente para a maioria dos casos.

        Por que asyncio.to_thread()?
        Mesmo motivo do _coverage_task: o LLMClient é síncrono (chamada HTTP
        bloqueante). Sem to_thread(), o event loop ficaria travado durante a
        chamada ao Gemini e o painel pararia de renderizar.
        """
        # Não inicia se não houver detector configurado (sem LLM)
        if self._red_flag_detector is None:
            return

        while not self._shutdown.is_set():
            # "Dorme" 15s, mas acorda cedo se o shutdown for disparado.
            # asyncio.shield() protege o _shutdown.wait() de ser cancelado
            # quando o wait_for() estoura o timeout.
            try:
                await asyncio.wait_for(
                    asyncio.shield(self._shutdown.wait()),
                    timeout=self.RED_FLAG_INTERVAL_SECS,
                )
                break   # shutdown disparado → encerra a task
            except asyncio.TimeoutError:
                pass    # 15s passaram normalmente → executa o detector

            # Executa a detecção em thread separada para não bloquear o event loop
            flags = await asyncio.to_thread(self._red_flag_detector.detect)

            # Traduz RedFlag (domínio) → add_alert (UI).
            # O renderer não conhece RedFlag — recebe apenas level e text.
            # O campo 'evidence' fica no domínio para deduplicação interna.
            for flag in flags:
                self._renderer.add_alert(flag.level, flag.text)

    async def _render_task(self) -> None:
        """Atualiza o painel a cada RENDER_INTERVAL_SECS (250ms).

        Mesma técnica de "sleep interrompível" do watchdog_task:
        wait_for + shield para acordar cedo se o shutdown for disparado,
        em vez de esperar 250ms inteiros após o encerramento.
        """
        while not self._shutdown.is_set():
            self._renderer.refresh()
            try:
                await asyncio.wait_for(
                    asyncio.shield(self._shutdown.wait()),
                    timeout=self.RENDER_INTERVAL_SECS,
                )
                break  # shutdown → encerra render
            except asyncio.TimeoutError:
                pass   # passou 250ms → renderiza de novo

    async def _web_command_task(self) -> None:
        """Lê comandos da fila do WebRenderer e despacha para os handlers.

        Só é criado como task quando o renderer expõe uma command_queue não-None
        (ou seja, apenas para o WebRenderer). Para o CLIRenderer, o CommandHandler
        de teclado faz esse papel e esta task não é iniciada.

        O protocolo é o mesmo do CommandHandler: o handler recebe o "nome longo"
        do comando ("questions", "report", "sync", "quit") em vez da tecla de
        letra ("p", "r", "s", "q"), mas ambos são despachados pelo mesmo dict
        self._handlers — sem duplicação de lógica.

        Por que wait_for + shield?
        Mesma técnica do watchdog: queremos acordar cedo se o shutdown for
        disparado, sem ficar travados esperando o próximo comando do browser.
        """
        queue = self._renderer.command_queue
        if queue is None:
            return  # renderer sem fila de comandos (CLI) → não faz nada

        while not self._shutdown.is_set():
            try:
                # Sem asyncio.shield: o wait_for cancela o queue.get() no timeout,
                # removendo o waiter da fila. Com shield, o waiter órfão permanece
                # registrado e consome o próximo comando sem que ninguém o processe.
                cmd = await asyncio.wait_for(queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue  # sem comando → checa shutdown e tenta de novo

            handler = self._handlers.get(cmd)
            if handler:
                try:
                    await handler()
                except Exception as exc:
                    self._renderer.add_alert("critical", f"Erro ao executar '{cmd}': {exc}")

    # ── Entry point principal ────────────────────────────────────────────────

    async def run(self) -> None:
        """Inicializa tudo e roda até o usuário pressionar Q ou a fonte esgotar.

        Fluxo:
        1. Configura os handlers de teclado
        2. Inicia o painel visual
        3. Cria as tasks assíncronas com asyncio.create_task()
        4. Aguarda o evento de shutdown (bloqueante, mas não bloqueia o event loop)
        5. Cancela as tasks pendentes
        6. Para o painel

        Por que create_task() em vez de await direto?
        await corrotina() espera ela terminar ANTES de continuar.
        create_task() agenda a corrotina para rodar "em paralelo" (concorrentemente)
        e retorna imediatamente um Task object. As 4 tasks rodam ao mesmo tempo
        porque cada uma faz yield (via await) regularmente.
        """
        self._setup_commands()
        self._renderer.start()

        try:
            tasks: list[asyncio.Task] = [
                asyncio.create_task(self._ingestion_task(),  name="ingestion"),
                asyncio.create_task(self._coverage_task(),   name="coverage"),
                asyncio.create_task(self._red_flag_task(),   name="red_flag"),
                asyncio.create_task(self._watchdog_task(),   name="watchdog"),
                asyncio.create_task(self._render_task(),     name="render"),
                # serve() é no-op para CLIRenderer (termina imediatamente) e
                # inicia o aiohttp server para WebRenderer (vive até ser cancelado).
                asyncio.create_task(self._renderer.serve(),  name="renderer_serve"),
            ]

            # CommandHandler de teclado: só em TTY e sem command_queue do renderer.
            # Em modo web, os comandos chegam pelo WebSocket — o stdin fica livre
            # para a StdinSource usar sem conflito com o modo cbreak do CommandHandler.
            if sys.stdin.isatty() and self._renderer.command_queue is None:
                tasks.append(asyncio.create_task(self._commands.run(), name="keyboard"))

            # Web command task: só quando o renderer expõe command_queue (WebRenderer).
            if self._renderer.command_queue is not None:
                tasks.append(asyncio.create_task(self._web_command_task(), name="web_commands"))

            # Aguarda shutdown (Q pressionado, ingestion encerrou, ou Ctrl+C)
            await self._shutdown.wait()

            for task in tasks:
                if not task.done():
                    task.cancel()

            await asyncio.gather(*tasks, return_exceptions=True)

        except KeyboardInterrupt:
            # Ctrl+C em modo cbreak gera KeyboardInterrupt (não \x03).
            # Capturamos aqui para encerrar de forma limpa em vez de mostrar
            # traceback no terminal (que estaria em estado ruim sem o renderer).
            self._shutdown.set()

        finally:
            # Garante que o painel feche e o alternate screen buffer seja
            # restaurado mesmo se acontecer qualquer exceção.
            self._renderer.stop()
