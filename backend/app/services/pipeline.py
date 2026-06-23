import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from app.database import get_supabase
from app.services import llm as llm_service
from app.services.llm import tokens_to_usd
from app.services.prompt_builder import PromptBuilder
from app.services.session_state import CoverageArea, Question, RedFlag, SessionState
from app.services.ws_manager import ws_manager


class SessionPipeline:
    def __init__(self, state: SessionState):
        self.state = state
        self._tasks: list[asyncio.Task] = []
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        await self._send_initial_state()
        self._tasks = [
            asyncio.create_task(self._coverage_task(), name=f"coverage-{self.state.session_id}"),
            asyncio.create_task(self._red_flag_task(), name=f"redflag-{self.state.session_id}"),
            asyncio.create_task(self._render_task(), name=f"render-{self.state.session_id}"),
            asyncio.create_task(self._expire_task(), name=f"expire-{self.state.session_id}"),
        ]

    async def load_state_only(self) -> None:
        """Carrega transcrição, red flags e cobertura do banco sem subir tasks de background.
        Usado para gerar relatório de sessões já encerradas."""
        await self._send_initial_state()

    async def stop(self) -> None:
        self._running = False
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []

    async def push_chunk(self, text: str, speaker: Optional[str] = None) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        chunk = {"text": text, "speaker": speaker, "timestamp": ts}

        # Se o novo chunk é uma extensão do último chunk do mesmo speaker,
        # transmite ao frontend só a parte nova (evita repetições na tela).
        broadcast_text = text
        if self.state.transcript_chunks:
            last = self.state.transcript_chunks[-1]
            if last.get("speaker") == speaker and text.startswith(last["text"]):
                new_part = text[len(last["text"]):].strip()
                if not new_part:
                    return  # duplicata exata, descarta
                broadcast_text = new_part

        self.state.transcript_chunks.append(chunk)
        await ws_manager.broadcast(
            self.state.session_id, "transcript_chunk", {**chunk, "text": broadcast_text}
        )

    async def trigger_questions(self) -> None:
        asyncio.create_task(self._run_question_planner())

    async def trigger_report(self) -> Optional[str]:
        return await self._run_report_generator()

    # -------------------------------------------------------------------------
    # Background tasks
    # -------------------------------------------------------------------------

    def _budget_ok(self) -> bool:
        remaining = self.state.budget_remaining()
        if remaining is None:
            return True
        return remaining >= self.state.estimated_report_cost()

    async def _coverage_task(self) -> None:
        while self._running:
            await asyncio.sleep(30)
            if not self.state.transcript_chunks or not self.state.gemini_api_key:
                continue
            if not self._budget_ok():
                continue
            try:
                await self._run_coverage_classifier()
            except Exception:
                pass

    async def _red_flag_task(self) -> None:
        await asyncio.sleep(15)
        while self._running:
            await asyncio.sleep(15)
            if not self.state.transcript_chunks or not self.state.gemini_api_key:
                continue
            if not self._budget_ok():
                continue
            try:
                await self._run_red_flag_detector()
            except Exception:
                pass

    async def _render_task(self) -> None:
        while self._running:
            await asyncio.sleep(1)
            try:
                await ws_manager.broadcast(
                    self.state.session_id, "budget_update", self._budget_payload()
                )
            except Exception:
                pass

    async def _expire_task(self) -> None:
        while self._running:
            await asyncio.sleep(1)
            now = datetime.now(timezone.utc)
            expired_ids = []
            for q in self.state.questions:
                if q.status != "queued" or not q.expires_at:
                    continue
                try:
                    exp = datetime.fromisoformat(q.expires_at.replace("Z", "+00:00"))
                    if now > exp:
                        q.status = "dismissed"
                        expired_ids.append(q.id)
                except ValueError:
                    pass
            for qid in expired_ids:
                await ws_manager.broadcast(
                    self.state.session_id, "question_expired", {"id": qid}
                )

    # -------------------------------------------------------------------------
    # LLM workers
    # -------------------------------------------------------------------------

    async def _run_coverage_classifier(self) -> None:
        transcript = self.state.get_transcript_text(last_n=100)
        data, inp, out = await llm_service.classify_coverage(
            self.state.gemini_api_key,
            transcript,
            self.state.project_type,
            self.state.data_maturity_score,
            system_prompt=self.state.prompts.get("coverage_classifier"),
        )
        self.state.add_token_cost(inp, out)
        if data:
            changed = False
            for area, info in data.get("areas", {}).items():
                if area not in self.state.coverage:
                    continue
                current = self.state.coverage[area]
                if current.status == "not_applicable":
                    continue
                new_score = int(info.get("score", 0) or 0)
                # Cobertura é monotônica: só sobe quando um tópico é de fato
                # coberto. Nunca abaixa sozinha por causa da janela deslizante
                # da transcrição — evita a flutuação aleatória do mapa.
                if new_score <= current.score:
                    continue
                self.state.coverage[area] = CoverageArea(
                    status=info.get("status", current.status),
                    score=new_score,
                    notes=info.get("notes", "") or current.notes,
                )
                changed = True
            if not changed:
                return
            db = get_supabase()
            db.table("coverage_snapshots").insert({
                "session_id": self.state.session_id,
                "coverage_json": self.state.coverage_to_dict(),
            }).execute()
            db.table("sessions").update({
                "tokens_used": self.state.tokens_used,
                "cost_usd": str(round(self.state.cost_usd, 8)),
            }).eq("id", self.state.session_id).execute()
            await ws_manager.broadcast(
                self.state.session_id,
                "coverage_update",
                {"areas": self.state.coverage_to_dict()},
            )

    async def _run_red_flag_detector(self) -> None:
        transcript = self.state.get_transcript_text(last_n=50)
        flags, inp, out = await llm_service.detect_red_flags(
            self.state.gemini_api_key,
            transcript,
            self.state.pre_meeting_context,
            self.state.data_maturity_score,
            system_prompt=self.state.prompts.get("red_flag_detector"),
        )
        self.state.add_token_cost(inp, out)
        existing_texts = {f.text[:60] for f in self.state.red_flags}
        db = get_supabase()
        for flag in flags[:2]:
            text = flag.get("text", "")
            if not text or text[:60] in existing_texts:
                continue
            flag_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            rf = RedFlag(
                id=flag_id,
                text=text,
                severity=flag.get("severity", "warning"),
                evidence=flag.get("evidence", ""),
                detected_at=now,
            )
            self.state.red_flags.append(rf)
            existing_texts.add(text[:60])
            db.table("red_flags").insert({
                "id": flag_id,
                "session_id": self.state.session_id,
                "text": rf.text,
                "severity": rf.severity,
                "evidence": rf.evidence,
            }).execute()
            await ws_manager.broadcast(
                self.state.session_id, "red_flag", rf.__dict__
            )

    async def _run_question_planner(self) -> None:
        if not self.state.gemini_api_key:
            return
        # Max 5 queued
        queued_count = sum(1 for q in self.state.questions if q.status == "queued")
        if queued_count >= 5:
            return
        transcript = self.state.get_transcript_text(last_n=80)
        recent = [
            q.text
            for q in self.state.questions[-3:]
            if q.status in ("queued", "pinned", "used")
        ]
        questions, inp, out = await llm_service.generate_questions(
            self.state.gemini_api_key,
            transcript,
            self.state.coverage_to_dict(),
            recent,
            self.state.project_type,
            self.state.data_maturity_score,
            bank_questions=self.state.bank_questions,
            system_prompt=self.state.prompts.get("question_planner"),
            pre_meeting_context=self.state.pre_meeting_context,
        )
        self.state.add_token_cost(inp, out)
        db = get_supabase()
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(seconds=self.state.question_ttl_seconds)).isoformat()
        for q_data in questions:
            queued_count = sum(1 for q in self.state.questions if q.status == "queued")
            if queued_count >= 5:
                break
            q_id = str(uuid.uuid4())
            q = Question(
                id=q_id,
                text=q_data.get("text", ""),
                block=q_data.get("block", "negocio"),
                source="auto",
                status="queued",
                generated_at=now.isoformat(),
                expires_at=expires_at,
            )
            self.state.questions.append(q)
            db.table("questions").insert({
                "id": q_id,
                "session_id": self.state.session_id,
                "text": q.text,
                "block": q.block,
                "source": "auto",
                "status": "queued",
                "expires_at": expires_at,
            }).execute()
            await ws_manager.broadcast(
                self.state.session_id, "question_new", q.__dict__
            )

    async def _run_report_generator(self) -> Optional[str]:
        if not self.state.gemini_api_key:
            return None
        transcript = self.state.get_transcript_text()
        questions_used = [
            q.text for q in self.state.questions if q.status in ("used", "pinned")
        ]
        red_flags_raw = [
            {"text": rf.text, "severity": rf.severity, "evidence": rf.evidence}
            for rf in self.state.red_flags
        ]
        markdown, inp, out = await llm_service.generate_report(
            api_key=self.state.gemini_api_key,
            transcript=transcript,
            coverage=self.state.coverage_to_dict(),
            red_flags=red_flags_raw,
            questions_used=questions_used,
            project_type=self.state.project_type,
            dms=self.state.data_maturity_score,
            pre_meeting_context=self.state.pre_meeting_context,
            system_prompt=self.state.prompts.get("report_generator"),
        )
        self.state.add_token_cost(inp, out)
        db = get_supabase()
        db.table("reports").insert({
            "session_id": self.state.session_id,
            "markdown_content": markdown,
            "cost_usd": str(round(tokens_to_usd(inp, out), 6)),
        }).execute()
        db.table("sessions").update({
            "tokens_used": self.state.tokens_used,
            "cost_usd": str(round(self.state.cost_usd, 8)),
        }).eq("id", self.state.session_id).execute()
        await ws_manager.broadcast(
            self.state.session_id, "report_ready", {"markdown_content": markdown}
        )
        return markdown

    # -------------------------------------------------------------------------
    # Initial state load
    # -------------------------------------------------------------------------

    async def _send_initial_state(self) -> None:
        db = get_supabase()
        chunks = (
            db.table("transcript_chunks")
            .select("speaker, text, timestamp")
            .eq("session_id", self.state.session_id)
            .order("timestamp")
            .execute()
        )
        for c in chunks.data:
            self.state.transcript_chunks.append({
                "text": c["text"],
                "speaker": c.get("speaker"),
                "timestamp": c.get("timestamp", ""),
            })

        snapshots = (
            db.table("coverage_snapshots")
            .select("coverage_json")
            .eq("session_id", self.state.session_id)
            .order("snapshot_at", desc=True)
            .limit(1)
            .execute()
        )
        if snapshots.data:
            for area, info in (snapshots.data[0].get("coverage_json") or {}).items():
                if area in self.state.coverage:
                    if self.state.coverage[area].status == "not_applicable":
                        continue
                    self.state.coverage[area] = CoverageArea(
                        status=info.get("status", "uncovered"),
                        score=info.get("score", 0),
                        notes=info.get("notes", ""),
                    )

        flags = (
            db.table("red_flags")
            .select("*")
            .eq("session_id", self.state.session_id)
            .execute()
        )
        for f in flags.data:
            self.state.red_flags.append(RedFlag(
                id=f["id"],
                text=f["text"],
                severity=f.get("severity", "warning"),
                evidence=f.get("evidence", ""),
                detected_at=f.get("detected_at", ""),
            ))

        questions = (
            db.table("questions")
            .select("*")
            .eq("session_id", self.state.session_id)
            .in_("status", ["queued", "pinned"])
            .execute()
        )
        for q in questions.data:
            self.state.questions.append(Question(
                id=q["id"],
                text=q["text"],
                block=q.get("block", "negocio"),
                source=q.get("source", "auto"),
                status=q["status"],
                generated_at=q.get("generated_at", ""),
                expires_at=q.get("expires_at", ""),
            ))

    # -------------------------------------------------------------------------
    # Budget payload
    # -------------------------------------------------------------------------

    def _budget_payload(self) -> dict:
        remaining = self.state.budget_remaining()
        estimated = self.state.estimated_report_cost()
        pct = 0.0
        if self.state.budget_usd:
            pct = self.state.cost_usd / self.state.budget_usd
        status = "ok"
        if self.state.budget_usd:
            if remaining is not None and remaining < estimated:
                status = "insufficient"
            elif pct >= 0.8:
                status = "critical"
            elif pct >= 0.6:
                status = "warning"
        return {
            "used_usd": round(self.state.cost_usd, 6),
            "limit_usd": self.state.budget_usd,
            "estimated_report_cost": round(estimated, 6),
            "status": status,
        }


# ---------------------------------------------------------------------------
# Singleton manager
# ---------------------------------------------------------------------------


class PipelineManager:
    def __init__(self):
        self._pipelines: Dict[str, SessionPipeline] = {}

    async def get_or_create(
        self, session_id: str, allow_finished: bool = False
    ) -> Optional[SessionPipeline]:
        if session_id in self._pipelines:
            return self._pipelines[session_id]

        db = get_supabase()
        query = (
            db.table("sessions")
            .select("*, projects(*)")
            .eq("id", session_id)
        )
        if not allow_finished:
            query = query.eq("status", "active")
        session_res = query.execute()
        if not session_res.data:
            return None

        session = session_res.data[0]
        project = session.get("projects") or {}

        gemini_key = ""
        secret_id = project.get("gemini_api_key_secret_id")
        if secret_id:
            try:
                key_res = db.rpc("vault_get_secret", {"p_secret_id": secret_id}).execute()
                gemini_key = key_res.data or ""
            except Exception:
                pass

        raw_budget = project.get("budget_usd")
        budget_usd = float(raw_budget) if raw_budget else None

        bank_res = db.table("question_bank").select("block, text, priority, project_types").order("priority").execute()
        bank_questions = bank_res.data or []

        project_type = project.get("project_type") or ""
        pre_meeting_context = project.get("pre_meeting_context") or ""

        if not project_type and gemini_key and pre_meeting_context:
            try:
                inferred, _, _ = await llm_service.infer_project_type(
                    gemini_key, pre_meeting_context
                )
                if inferred:
                    project_type = inferred
                    db.table("projects").update({"project_type": project_type}).eq(
                        "id", project.get("id")
                    ).execute()
            except Exception:
                pass

        builder = PromptBuilder(
            dms=project.get("data_maturity_score") or 3,
            pre_meeting_context=pre_meeting_context,
            project_type=project_type,
        )
        prompts = builder.build_all()

        try:
            rows = [
                {"session_id": session_id, "agent": agent, "prompt_text": text}
                for agent, text in prompts.items()
            ]
            db.table("session_prompts").insert(rows).execute()
        except Exception:
            pass

        state = SessionState(
            session_id=session_id,
            project_id=str(project.get("id", "")),
            project_type=project_type,
            data_maturity_score=project.get("data_maturity_score") or 3,
            pre_meeting_context=pre_meeting_context,
            budget_usd=budget_usd,
            gemini_api_key=gemini_key,
            question_ttl_seconds=project.get("question_ttl_seconds") or 30,
            bank_questions=bank_questions,
            prompts=prompts,
            tokens_used=session.get("tokens_used") or 0,
            cost_usd=float(session.get("cost_usd") or 0),
        )

        pipeline = SessionPipeline(state)
        session_status = session.get("status", "active")
        if session_status == "active":
            self._pipelines[session_id] = pipeline
            await pipeline.start()
        else:
            # Sessão encerrada: carrega contexto do banco sem subir tasks de background.
            # Não armazena em _pipelines — uso único para gerar relatório.
            await pipeline.load_state_only()
        return pipeline

    async def push_chunk(
        self, session_id: str, text: str, speaker: Optional[str] = None
    ) -> None:
        pipeline = await self.get_or_create(session_id)
        if pipeline:
            await pipeline.push_chunk(text, speaker)

    async def stop_session(self, session_id: str) -> None:
        pipeline = self._pipelines.pop(session_id, None)
        if pipeline:
            await pipeline.stop()


pipeline_manager = PipelineManager()
