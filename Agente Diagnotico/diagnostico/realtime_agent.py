import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from agent import _build_augmented_report_prompt
from analysis.question_planner import QuestionPlanner
from analysis.red_flag import RedFlagDetector
from conversation import ConversationManager
from coverage.classifier import CoverageClassifier
from coverage.tracker import CoverageTracker
from llm.base import LLMClient, Message
from prompts import SYSTEM_PROMPT
from report import ReportGenerator
from transcription.base import TranscriptionSource
from transcription.buffer import TranscriptBuffer
from ui.base import BaseRenderer
from ui.renderer import CLIRenderer
from ui.commands import CommandHandler


class RealtimeOrchestrator:
    """Coordena todos os componentes do modo tempo real.

    Recebe uma TranscriptionSource e orquestra:
    - Ingestão de chunks → buffer
    - Classificação periódica de áreas de risco
    - Detecção de red flags
    - Renderização contínua do painel
    - Watchdog para detectar pausa no stream
    - Captura de comandos do teclado
    """

    STREAM_PAUSE_TIMEOUT_SECS = 60
    RENDER_INTERVAL_SECS = 0.25
    WATCHDOG_INTERVAL_SECS = 10
    COVERAGE_INTERVAL_SECS = 30
    # Classificação antecipada quando o buffer acumula muitos tokens novos,
    # evitando perder red flags mencionados em rajadas de fala.
    EARLY_TRIGGER_TOKENS = 250
    # Menor que o classificador: red flags precisam aparecer rápido para o comercial.
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
        self._llm = llm
        self._reports_dir = reports_dir
        self._tracker = tracker or CoverageTracker()
        self._buffer = TranscriptBuffer()
        self._renderer: BaseRenderer = renderer if renderer is not None else CLIRenderer(self._tracker)
        self._commands = CommandHandler()
        self._handlers: dict[str, Any] = {}

        self._shutdown = asyncio.Event()

        self._conversation = ConversationManager()
        self._conversation.add_message("system", SYSTEM_PROMPT)

        self._saturation_threshold = saturation_threshold
        # True once saturation is first reached — avoids re-running is_saturated() every tick.
        self._saturated: bool = False
        self._last_planned_chunk_count: int = 0

        self._classifier: CoverageClassifier | None = (
            CoverageClassifier(llm=llm, tracker=self._tracker, buffer=self._buffer)
            if llm is not None
            else None
        )
        self._red_flag_detector: RedFlagDetector | None = (
            RedFlagDetector(llm=llm, buffer=self._buffer)
            if llm is not None
            else None
        )
        self._planner: QuestionPlanner | None = (
            QuestionPlanner(llm=llm, tracker=self._tracker, buffer=self._buffer)
            if llm is not None
            else None
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    async def _interruptible_sleep(self, seconds: float) -> bool:
        """Sleeps for `seconds` or until shutdown. Returns True if shutdown fired."""
        try:
            await asyncio.wait_for(asyncio.shield(self._shutdown.wait()), timeout=seconds)
            return True
        except asyncio.TimeoutError:
            return False

    def _check_saturation(self) -> None:
        """Marks saturation once reached; no-op on subsequent calls."""
        if not self._saturated and self._tracker.is_saturated(self._saturation_threshold):
            self._saturated = True
            self._renderer.set_saturated(True)

    def _require_llm(self, feature: str) -> bool:
        """Returns False and adds a warning alert if LLM is not configured."""
        if self._llm is None:
            self._renderer.add_alert("warning", f"{feature} indisponível — configure GEMINI_API_KEY.")
            return False
        return True

    # ── Wiring dos comandos de teclado ───────────────────────────────────────

    def _setup_commands(self) -> None:
        async def on_p() -> None:
            if not self._require_llm("Planner"):
                return
            self._renderer.add_alert("warning", "⏳ Atualizando perguntas…")
            questions = await asyncio.to_thread(self._planner.plan)
            if not questions:
                self._renderer.add_alert("warning", "Todas as áreas de risco já estão cobertas.")
                return
            self._renderer.set_suggestions(questions)

        async def on_r() -> None:
            if not self._require_llm("Relatório"):
                return
            self._renderer.add_alert("warning", "⏳ Gerando relatório...")
            try:
                filepath = await asyncio.to_thread(self._generate_report)
                self._renderer.add_alert("warning", f"✅ Relatório salvo em: {filepath.name}")
            except Exception as exc:
                self._renderer.add_alert("critical", f"Erro ao gerar relatório: {exc}")

        async def on_s() -> None:
            if not self._require_llm("Classificador"):
                return
            changed = await asyncio.to_thread(self._classifier.classify)
            msg = "✓ Mapa de cobertura atualizado manualmente." if changed else "Nenhuma mudança detectada no trecho atual."
            self._renderer.add_alert("warning", msg)

        async def on_q() -> None:
            self._shutdown.set()
            self._commands.stop()

        self._commands.on("p", on_p)
        self._commands.on("r", on_r)
        self._commands.on("s", on_s)
        self._commands.on("q", on_q)

        self._handlers = {
            "questions": on_p,
            "report":    on_r,
            "sync":      on_s,
            "quit":      on_q,
        }

    # ── Geração de relatório ─────────────────────────────────────────────────

    def _generate_report(self) -> Path:
        """Gera o relatório de diagnóstico com o mapa de cobertura prefixado.

        Síncrono — chamado via asyncio.to_thread() para não bloquear o event loop.
        """
        history_with_report = self._conversation.get_history() + [
            Message(role="user", content=_build_augmented_report_prompt(self._tracker))
        ]
        report_content = self._llm.generate(history_with_report)
        reporter = ReportGenerator(self._reports_dir)
        return reporter.save(report_content)

    # ── Tasks assíncronas ────────────────────────────────────────────────────

    async def _ingestion_task(self) -> None:
        async for chunk in self._source.stream():
            if self._shutdown.is_set():
                break
            self._buffer.append(chunk)
            self._conversation.append_transcript(chunk)
            self._renderer.set_stream_paused(False)
        self._shutdown.set()

    async def _watchdog_task(self) -> None:
        while not self._shutdown.is_set():
            if await self._interruptible_sleep(self.WATCHDOG_INTERVAL_SECS):
                break
            last = self._buffer.last_chunk_at()
            if last and datetime.now() - last > timedelta(seconds=self.STREAM_PAUSE_TIMEOUT_SECS):
                self._renderer.set_stream_paused(True)

    async def _coverage_task(self) -> None:
        if self._classifier is None:
            return

        elapsed = 0.0
        tick = 1.0

        while not self._shutdown.is_set():
            tokens_new = self._buffer.tokens_since_flush()
            if elapsed >= self.COVERAGE_INTERVAL_SECS or tokens_new >= self.EARLY_TRIGGER_TOKENS:
                elapsed = 0.0

                current_chunks = self._buffer.chunk_count()
                should_plan = (
                    self._planner is not None
                    and current_chunks > self._last_planned_chunk_count
                )

                if should_plan:
                    _, questions = await asyncio.gather(
                        asyncio.to_thread(self._classifier.classify),
                        asyncio.to_thread(self._planner.plan),
                    )
                    if questions:
                        self._renderer.set_suggestions(questions)
                        self._last_planned_chunk_count = current_chunks
                else:
                    await asyncio.to_thread(self._classifier.classify)

                self._check_saturation()

            if await self._interruptible_sleep(tick):
                break
            elapsed += tick

    async def _red_flag_task(self) -> None:
        if self._red_flag_detector is None:
            return
        while not self._shutdown.is_set():
            if await self._interruptible_sleep(self.RED_FLAG_INTERVAL_SECS):
                break
            flags = await asyncio.to_thread(self._red_flag_detector.detect)
            for flag in flags:
                self._renderer.add_alert(flag.level, flag.text)

    async def _render_task(self) -> None:
        while not self._shutdown.is_set():
            self._renderer.refresh()
            if await self._interruptible_sleep(self.RENDER_INTERVAL_SECS):
                break

    async def _web_command_task(self) -> None:
        queue = self._renderer.command_queue
        if queue is None:
            return
        while not self._shutdown.is_set():
            try:
                cmd = await asyncio.wait_for(queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            handler = self._handlers.get(cmd)
            if handler:
                try:
                    await handler()
                except Exception as exc:
                    self._renderer.add_alert("critical", f"Erro ao executar '{cmd}': {exc}")

    # ── Entry point principal ────────────────────────────────────────────────

    async def run(self) -> None:
        """Inicializa tudo e roda até o usuário pressionar Q ou a fonte esgotar."""
        self._setup_commands()
        self._renderer.start()

        try:
            tasks: list[asyncio.Task] = [
                asyncio.create_task(self._ingestion_task(),  name="ingestion"),
                asyncio.create_task(self._coverage_task(),   name="coverage"),
                asyncio.create_task(self._red_flag_task(),   name="red_flag"),
                asyncio.create_task(self._watchdog_task(),   name="watchdog"),
                asyncio.create_task(self._render_task(),     name="render"),
                asyncio.create_task(self._renderer.serve(),  name="renderer_serve"),
            ]

            if sys.stdin.isatty() and self._renderer.command_queue is None:
                tasks.append(asyncio.create_task(self._commands.run(), name="keyboard"))

            if self._renderer.command_queue is not None:
                tasks.append(asyncio.create_task(self._web_command_task(), name="web_commands"))

            await self._shutdown.wait()

            for task in tasks:
                if not task.done():
                    task.cancel()

            await asyncio.gather(*tasks, return_exceptions=True)

        except KeyboardInterrupt:
            self._shutdown.set()

        finally:
            self._renderer.stop()
