---
status: resolved
trigger: "UAT gap G-07-2 from Phase 7 (taqciti-config-background-streamer) verify-work session, test 1 (SC1 — live streaming during a real Google Meet call)."
created: 2026-09-26T00:00:00Z
updated: 2026-09-26T00:40:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "agenteStreamer.ts sends one POST /webhook/extension (-> one transcript_chunks row -> one monitoring-screen line) per coalesced flush cycle that contains ANY new word(s) for a segment, with zero further batching beyond STATE_FLUSH_INTERVAL_MS (250ms, sessionController.ts). Because Google Meet's live-caption DOM growth for natural, paced speech commonly arrives with >250ms gaps between successive new words (confirmed: GoogleMeetProvider scans the DOM every CAPTION_SCAN_INTERVAL_MS=120ms but only EMITS a chunk when the visible text actually changed — i.e. emission cadence tracks real speech/STT pace, not the 120ms scan tick), most individual words land in their own separate flush window and are sent/displayed as their own separate line, instead of being accumulated into a phrase/utterance-level chunk."
  confirming_evidence:
    - "Corrected symptom (coordinator relay of user's own words): 'boa noite' x3 produced exactly 6 one-word lines (Boa/noite/boa/noite/boa/noite) — word count matches exactly what was spoken (2 words x 3 = 6), ruling out any actual duplication/resend of already-sent text."
    - "wordDelta.ts computeSegmentDeltas is provably non-duplicating: already = cursor.sent[key] ?? 0; sent[key] = Math.max(already, words.length); delta = words.slice(already) — a word is only ever included in a delta once its index is beyond the highest count ever recorded for that key. wordDelta.test.ts 'idempotência' test explicitly proves replaying the same segments twice produces zero deltas the second time."
    - "agenteStreamer.ts's cursor is a single module-level variable updated synchronously inside step(), and step() calls are strictly serialized via a promise queue (queue = queue.then(() => step(state))) — no concurrent-flush race can compute overlapping deltas from stale cursor state (plan's own D-07 test 'Idempotência + concorrência' proves 2 simultaneous onSessionFlushed calls with the same state produce exactly 1 fetch, a 3rd produces 0)."
    - "sessionController.ts scheduleFlush(): coalescable CAPTION_CHUNK events only (re)schedule a flush if flushTimer === null; consecutive chunks arriving >250ms apart each get their OWN flush window because the previous timer already fired and reset to null — there is no rolling/extending debounce, only a fixed one-shot 250ms window per burst."
    - "GoogleMeetProvider.ts emitChunk (line 627): 'if (this.lastEmittedText.get(captionId) === text) return' — a chunk is emitted only when the caption node's visible text actually changed since the last scan, i.e. emission cadence is driven by real caption-text growth (paced by speech + Meet's STT), not by the 120ms scan timer itself. For a short, deliberately-paced utterance like 'boa noite' repeated with pauses, successive per-word text growth can easily be spaced further apart than 250ms."
    - "07-01-PLAN.md itself frames the intended granularity as 'a cada pequeno lote de legendas (o mesmo lote que a Taqciti já usa para salvar o estado a cada 250 ms), manda... só as palavras novas daquela fala' — i.e. the 250ms interval was REUSED wholesale from Taqciti's own internal storage-write/UI-broadcast debounce (chosen to avoid O(n^2) local storage cost, per sessionController.ts's own doc comment), not chosen/tuned for meaningful network-chunk/phrase granularity to an external backend."
    - "UAT gap G-07-1 (same test, same session) independently reports the SAME mechanism at coarser granularity: 'Olá, boa noite!' arrived as 2 separate lines ('Você: Olá' / 'Você: boa noite!') instead of one coherent line per utterance — consistent with the same 250ms-window-per-new-word-burst behavior, just with 2 words landing >250ms apart instead of the more extreme all-6-words-separate case in G-07-2."
  falsification_test: "If a growing segment's words that arrive <250ms apart from each other were ALSO observed as separate lines (not just words spaced further apart), the flush-granularity hypothesis would be falsified (would need a real duplication/resend defect instead). Not directly testable against the live Meet call after the fact, but code trace is unambiguous: computeSegmentDeltas' Math.max(already, words.length) construction makes resend structurally impossible regardless of timing; and the reported word count parity (6 spoken = 6 lines, no more) is itself the falsification result for the ORIGINAL 'duplicate/resend' hypothesis, which is hereby eliminated."
  fix_rationale: "N/A — goal is find_root_cause_only, no fix applied in this session."
  blind_spots: "Did not instrument a real Google Meet call to directly measure inter-word chunk-arrival deltas (no access to a live call in this environment); conclusion rests on code-level evidence (scan/emit logic, flush/debounce logic, delta math) plus the UAT's own two paired gap reports (G-07-1 or G-07-2) sharing the same mechanism, not on a live timing capture. Did not inspect the Agente backend's monitoring-screen rendering code (frontend) to confirm it renders 1 transcript_chunks row = 1 visual line with no client-side re-grouping by speaker/proximity — investigation_hints stated the backend inserts every payload verbatim with no dedup, which is sufficient to explain the row count, but the 1-row-per-line rendering assumption on the monitoring screen itself was not independently verified in this session."
  candidate_causes:
    - "code: agenteStreamer.ts step() fires one send() per delta on every flush, with no accumulation/aggregation window beyond a single flush cycle (no 'wait for pause in speech' or minimum-chunk-size heuristic before sending to the Agente backend specifically)"
    - "config/design: STATE_FLUSH_INTERVAL_MS=250ms (constants.ts) was chosen for Taqciti's own internal local-storage-write/UI-broadcast cost control (sessionController.ts doc comment: avoids O(duration^2) storage cost) and reused as-is for the Agente network-send cadence (07-01-PLAN.md D-06), without separately tuning/decoupling it for phrase-level network-chunk granularity"
  and_gate: "No — a single cause is sufficient and confirmed: the flush/send granularity (code+config, effectively one combined 'no phrase-level batching at the network-send layer' cause) fully explains both G-07-1 and G-07-2 without needing an additional contributing condition from a different category (no evidence of environment or data-specific factors; behavior is deterministic given real speech timing relative to the 250ms window)."

next_action: Root cause confirmed with evidence — proceed to return_diagnosis (find_root_cause_only mode, no fix applied).

## Symptoms

expected: "Linhas novas aparecem em transcript_chunks / na tela de monitoramento do Agente em poucos segundos (não só no fim da chamada), sem a mesma frase repetida; desligar o toggle interrompe o envio na hora."
actual: "User said the exact same phrase 3 times in a row for real ('boa noite', 'boa noite', 'boa noite') during a live Google Meet call, with the Taqciti extension streaming live captions to the Agente Diagnóstico backend (via /webhook/extension -> transcript_chunks). The Agente's monitoring screen showed MORE than 3 lines for that phrase — i.e. more repetitions appeared than were actually spoken. This means the streamer is re-sending/duplicating text it already sent, not just faithfully reflecting what was said."
errors: "None reported — no console/network errors observed by the user, just extra duplicate lines appearing in the monitoring UI."
reproduction: "Test 1 (SC1) in .planning/phases/07-taqciti-config-background-streamer/07-UAT.md — join a real Google Meet call with captions on, enable Taqciti's Agente Diagnóstico streaming toggle with a valid session_id, and say the same short phrase 3 times in a row with pauses between repetitions. Compare the number of lines that arrive in the Agente backend's `transcript_chunks` table (or the session monitoring screen) against the number of times the phrase was actually spoken."
started: "Discovered during UAT of Phase 7 (2026-09-26) — this is the first real end-to-end test of the live streaming feature (Plans 07-01/07-02/07-03), so unknown whether this is new or was already present in earlier tracer tests."

## Eliminated

- hypothesis: "wordDelta.ts / agenteStreamer.ts re-sends/duplicates text it already sent (spurious resend of already-sent words, e.g. via captionId reuse confusing the cursor, or a concurrency race in the serialized queue producing 2 overlapping fetches)."
  evidence: "(1) Coordinator relayed the user's exact clarification: 'boa noite' x3 produced exactly 6 one-word lines (Boa/noite/boa/noite/boa/noite) — 2 words x 3 repetitions = 6, exact word-count parity with what was spoken, no extra/phantom words. (2) Code trace of computeSegmentDeltas (wordDelta.ts:63-85): sent[key] = Math.max(already, words.length); delta = words.slice(already) — structurally cannot re-emit a word index once it has been counted as sent, regardless of captionId reuse or timing. (3) wordDelta.test.ts 'idempotência' test and agenteStreamer's own e2e test ('Idempotência + concorrência': 2 simultaneous onSessionFlushed calls with the same state -> exactly 1 fetch, 3rd call -> 0 fetches) both directly prove no resend under replay or concurrency. (4) agenteStreamer.ts's cursor is a single module-level variable updated synchronously inside step(), and steps are strictly serialized via a promise chain (queue = queue.then(() => step(state))) — no window exists for two flushes to compute overlapping deltas from stale cursor state."
  timestamp: 2026-09-26T00:20:00Z

## Evidence

- timestamp: 2026-09-26T00:00:00Z
  checked: taqciti/src/features/agente/wordDelta.ts (full read)
  found: segmentKey(segment, index) = `${index}:${captionId}`. computeSegmentDeltas iterates `segments` (current live segments array) by index, looks up cursor.sent[key], computes delta = words beyond already-sent count. New cursor.sent only contains keys for CURRENT segments — keys for segments that disappeared do not survive.
  implication: If the same DOM/index position gets reused for a genuinely NEW utterance but keeps producing a `captionId` that hashes to the same key OR if segments SHIFT INDEX (e.g. segment removed from array so index numbers shift), stale cursor counts could misapply to the wrong segment, causing either resend or missed text. Need to check aggregator.ts to see how `index` position and `captionId` are assigned/reused.
- timestamp: 2026-09-26T00:00:00Z
  checked: taqciti/src/background/agenteStreamer.ts (full read)
  found: Single in-memory `cursor` variable, single serialized `queue` (promise chain) — `onSessionFlushed` chains `step(state)` onto queue, so steps run strictly sequentially, cursor read/write is not racy within one streamer instance. Sends are fire-and-forget (not awaited by queue), but cursor update happens synchronously in `step()` BEFORE the async send resolves, so cursor advances immediately after computing deltas — a slow network response doesn't cause the same delta to be recomputed on the next flush.
  implication: Rules out a simple "concurrent flush recomputes same delta" race WITHIN one streamer instance. But: if `configureAgenteStreamer()` is called (e.g. config change) creating a NEW streamer instance with a fresh cursor (null), and the old instance still has in-flight queued flushes, could produce duplicate sends. Need to check when configureAgenteStreamer is invoked in production and whether multiple streamer instances/background contexts could exist (e.g. service worker restart).

- timestamp: 2026-09-26T00:15:00Z
  checked: "SYMPTOM CORRECTION from coordinator (relaying user's exact words): 'a frase falada não gera mais palavras, o gerado é: Boa / noite / boa / noite / boa / noite / dessa forma'"
  found: "The actual observed behavior is NOT extra/phantom repetitions beyond what was spoken. It is exactly 6 lines for 6 spoken words (2-word phrase x 3 repetitions), each line containing a SINGLE WORD. Word count parity is exact. This invalidates the original framing ('streamer re-sending/duplicating already-sent text') entirely — the defect (if any) is about SEND GRANULARITY (one word per network request/line) not about DUPLICATION."
  implication: "Original hypothesis eliminated (see Eliminated section). Re-scoped investigation to: why does agenteStreamer.ts send one word per request instead of batching a segment's growth into fewer, more coherent (phrase-level) requests? This reframes the bug as identical in kind to the paired gap G-07-1 ('Olá, boa noite!' -> 2 lines instead of 1), just observed at finer granularity."

- timestamp: 2026-09-26T00:25:00Z
  checked: "taqciti/src/background/sessionController.ts flushState()/scheduleFlush()/isCoalescable() (lines 162-184) + taqciti/src/shared/config/constants.ts STATE_FLUSH_INTERVAL_MS=250"
  found: "scheduleFlush() only sets a new setTimeout if flushTimer === null; once it fires (after up to 250ms), flushTimer resets to null. Any CAPTION_CHUNK dispatched AFTER the flush has already fired starts a brand-new, separate 250ms window. There is no rolling/extending debounce (no timer reset on new activity) — it's a fixed one-shot window per burst of activity. Two new words arriving >250ms apart are guaranteed to land in two separate flush cycles -> two separate agenteStreamer.step() calls -> two separate deltas -> two separate fetch() calls -> two separate transcript_chunks rows/monitoring-screen lines."
  implication: "This is the mechanical trigger for fragmentation: any two consecutive new-word arrivals for the same segment that are >250ms apart WILL be sent as separate requests/lines, regardless of the (correct) word-delta math."

- timestamp: 2026-09-26T00:30:00Z
  checked: "taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts scheduleScan()/scanCaptions()/emitChunk() (lines 542-638) + CAPTION_SCAN_INTERVAL_MS=120 (constants.ts)"
  found: "The DOM caption region is re-scanned every 120ms (throttled from dozens of mutations/sec, per the code's own comment), but emitChunk() only actually calls the registered chunk callbacks (which lead to background 'meet/chunk' -> CAPTION_CHUNK dispatch) when the visible text for that node's captionId has CHANGED since the last emission ('if (this.lastEmittedText.get(captionId) === text) return'). So emission cadence tracks real caption-text growth (paced by the speaker's actual speech + Google's STT latency), not the 120ms scan tick itself. For a short, deliberately-paced utterance ('boa noite' x3 with pauses, per the reproduction steps), successive per-word text growth within one utterance can plausibly be spaced further apart than 250ms, and pauses BETWEEN repetitions guarantee each repetition starts a fresh flush cycle regardless."
  implication: "Confirms the upstream cause of the >250ms gaps feeding into the sessionController flush mechanism identified above: real speech pacing, not a code defect in the scan/emit logic itself (which is deliberately throttled for CPU cost, and correctly emits only on real text change — no duplicate emission for unchanged text)."

- timestamp: 2026-09-26T00:35:00Z
  checked: ".planning/phases/07-taqciti-config-background-streamer/07-01-PLAN.md section 1 ('O que muda') and section 2 ('Como vai ser alterado'), plus 07-UAT.md gap G-07-1"
  found: "Plan's own framing of the feature: 'a cada pequeno lote de legendas (o mesmo lote que a Taqciti já usa para salvar o estado a cada 250 ms), ela manda... só as palavras novas daquela fala.' The 250ms interval (STATE_FLUSH_INTERVAL_MS) was reused wholesale from Taqciti's PRE-EXISTING internal debounce, whose own doc comment (sessionController.ts:156-161) states its purpose is avoiding O(duration^2) local-storage-write + UI-broadcast cost — a purpose unrelated to producing coherent phrase-level chunks for an external network consumer. No separate accumulation/aggregation logic (e.g. 'wait for a pause in speech' or 'wait for N words' before sending to the Agente specifically) exists in agenteStreamer.ts. UAT gap G-07-1 (same test session) independently reports the identical mechanism at coarser granularity ('Olá, boa noite!' -> 2 separate lines instead of 1 coherent line per utterance)."
  implication: "G-07-1 and G-07-2 are the SAME root mechanism (flush/send granularity too fine relative to real inter-word caption arrival timing) observed at different degrees of severity, depending on how the real speech timing happened to align with 250ms flush windows. This is a design/implementation gap in agenteStreamer.ts's send-granularity policy — not a bug in wordDelta.ts's delta-correctness math, and not the originally-hypothesized duplicate-resend defect."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  NOT a duplicate/resend bug (original framing eliminated — see Eliminated section; corrected symptom
  shows exact word-count parity with what was spoken, no extra/phantom words). Confirmed root cause is a
  send-granularity gap: `agenteStreamer.ts`'s `step()` (called from `sessionController.ts`'s `flushState()`
  on every coalesced flush) fires one `POST /webhook/extension` per new-word-delta on EVERY flush cycle,
  with no accumulation/batching beyond a single flush window before sending to the Agente backend
  specifically. `STATE_FLUSH_INTERVAL_MS` (250ms, `taqciti/src/shared/config/constants.ts`) is a
  ONE-SHOT, non-extending debounce (`scheduleFlush()`: only schedules if no timer is already pending;
  once it fires, the window resets to null) that was reused as-is from Taqciti's own pre-existing
  internal local-storage-write/UI-broadcast debounce (chosen to bound storage-write cost, per
  `sessionController.ts`'s own doc comment — unrelated to network-chunk granularity for an external
  consumer). Google Meet's live-caption DOM emits new text for a node only when it actually changes
  (`GoogleMeetProvider.ts emitChunk`), at a cadence paced by real speech + STT latency, not by the 120ms
  scan tick — so for naturally/deliberately paced short utterances (like "boa noite" said 3x with pauses,
  per the SC1 reproduction steps), consecutive new-word arrivals for the same segment commonly land more
  than 250ms apart. Each such gap starts a brand-new, separate flush cycle -> separate
  `computeSegmentDeltas` call -> separate `fetch()` -> separate `transcript_chunks` row -> separate line
  on the monitoring screen, down to single-word granularity in the observed case. This is the same
  mechanism as paired UAT gap G-07-1 ("Olá, boa noite!" -> 2 lines instead of 1), just manifesting at a
  finer degree because the words/repetitions in the SC1 reproduction happened to be spaced further apart.
  This is best characterized as an unintended design/implementation gap (not a deliberate per-word
  streaming design and not a code-correctness bug): the plan's own stated intent (07-01-PLAN.md, "a cada
  pequeno lote de legendas... manda... as palavras novas daquela fala") assumed a flush window would
  typically capture more than one word's worth of growth per batch, but no logic actually enforces or
  waits for phrase/utterance-level coherence before sending — the 250ms interval was borrowed wholesale
  from an unrelated concern (Taqciti's own local-persistence cost control) rather than tuned/decoupled
  for meaningful network-chunk size.
fix: "Corrigido em 72c9be9 (07-04): o envio ao Agente passa a agrupar por fala (janela por fala); confirmado no reteste do UAT (7f2dd54)."
verification: "[not applicable — no fix applied in this session]"
files_changed: []
