import { useEffect, useRef, useState } from "react";
import {
	Check,
	Eye,
	Flame,
	Hand,
	Loader2,
	SkipForward,
	Square,
} from "lucide-react";
import { ws } from "@/lib/ws";
import { isTypingTarget } from "@/lib/utils";
import { haptic, shiftPalette, slam } from "@/lib/feel";
import { fx } from "@/lib/fx";
import { sound } from "@/lib/sound";
import { storage } from "@/lib/storage";
import { answersKey, clearDrafts, flameKey } from "@/lib/session";
import { useRoomStore, useIsHost } from "@/store/room";
import type { GameStatePayload, LobbyStatePayload } from "@/types/events";
import {
	validateAnswers,
	ruleIssue,
	LENGTH_ISSUE,
} from "@/lib/answerValidation";
import { RoomHeader } from "@/components/RoomHeader";
import { CommentatorBoard } from "@/components/CommentatorBoard";
import { useConfirm } from "@/components/ConfirmDialog";
import { isModalOpen } from "@/components/Modal";
import { Av, Btn, IconBtn, Mascot, mood, Tiles } from "@/components/kit";

// Local ticking timer that counts down from `seconds`, restarting whenever
// `resetKey` changes. The server stays authoritative for phase transitions.
function useCountdown(seconds: number | null, resetKey: string): number | null {
	const [value, setValue] = useState(seconds);
	// resetKey is the intended restart trigger; `seconds` is re-read each run.
	// biome-ignore lint/correctness/useExhaustiveDependencies: restart only on resetKey
	useEffect(() => {
		setValue(seconds);
		if (seconds === null) return;
		const id = setInterval(() => {
			setValue((v) => (v === null ? null : Math.max(0, v - 1)));
		}, 1000);
		return () => clearInterval(id);
	}, [resetKey]);
	return value;
}

function sendInputSync(roundId: string, answers: Record<string, string>) {
	const entries = Object.entries(answers).filter(([, v]) => v.trim() !== "");
	if (entries.length === 0) return;
	ws.send({
		type: "inputSync",
		payload: {
			roundId,
			answers: entries.map(([categoryId, value]) => ({ categoryId, value })),
		},
	});
}
const flameHintKey = "slf:flameHintSeen";

// A stored draft is only trusted as a map of strings; anything else is dropped.
function loadDraft(roundId: string): Record<string, string> {
	try {
		const v: unknown = JSON.parse(storage.get(answersKey(roundId)) ?? "{}");
		if (!v || typeof v !== "object" || Array.isArray(v)) return {};
		return Object.fromEntries(
			Object.entries(v).filter(([, s]) => typeof s === "string"),
		);
	} catch {
		return {};
	}
}

export function GameScreen() {
	const lobby = useRoomStore((s) => s.lobby);
	const myPlayerId = useRoomStore((s) => s.myPlayerId);
	const game = useRoomStore((s) => s.game);
	const buzzRejected = useRoomStore((s) => s.buzzRejected);
	const buzzing = useRoomStore((s) => s.buzzing);
	const buzz = useRoomStore((s) => s.buzz);
	const commentator = useRoomStore((s) => s.commentator);
	const isHost = useIsHost();
	const { confirm, dialog } = useConfirm();

	// True for a mid-game joiner still waiting to play from the next round.
	const isPending =
		lobby?.players.find((p) => p.id === myPlayerId)?.pending ?? false;
	// A commentator host and a pending joiner both watch instead of playing: they
	// fill nothing and instead see the per-player fill overview.
	const isSpectator =
		(isHost && lobby?.settings.hostPlays === false) || isPending;
	const lastLetterMode = lobby?.settings.lastLetterMode ?? false;
	const flamesEnabled =
		(lobby?.settings.flamesEnabled ?? false) && !lobby?.solo;

	const [answers, setAnswers] = useState<Record<string, string>>({});
	// Categories the player has blurred at least once - a field only shows a red
	// "invalid" border after it was left, not while still being typed in.
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	// The single category this player has "flamed" this round ("" = none).
	const [flamed, setFlamed] = useState<string>("");
	// The flame bet is explained once, in the first round that has flames.
	const [showFlameHint] = useState(() => !storage.get(flameHintKey));
	useEffect(() => {
		if (flamesEnabled && showFlameHint) storage.set(flameHintKey, "1");
	}, [flamesEnabled, showFlameHint]);
	const loadedRound = useRef<string>("");
	// Debounce buffer: latest value per category not yet sent to the server.
	const pendingAnswers = useRef<Record<string, string>>({});
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const roundId = game?.roundId ?? "";

	// Send all buffered answer changes now (also used before buzzing and on unmount
	// so no keystrokes are lost).
	function flushAnswers() {
		if (flushTimer.current) {
			clearTimeout(flushTimer.current);
			flushTimer.current = null;
		}
		const pending = pendingAnswers.current;
		pendingAnswers.current = {};
		for (const [categoryId, value] of Object.entries(pending)) {
			ws.send({
				type: "answerUpdate",
				payload: { roundId, categoryId, value },
			});
		}
	}

	// Load saved draft answers (and flame) for this round and push them to the
	// server so a reconnect mid-round restores progress (SRS 5.6 / 9.10).
	// biome-ignore lint/correctness/useExhaustiveDependencies: run only when roundId changes
	useEffect(() => {
		if (!roundId || loadedRound.current === roundId) return;
		loadedRound.current = roundId;
		// Clear out drafts from earlier rounds so localStorage stays bounded.
		clearDrafts(roundId);
		// Drop any buffered answers from the previous round.
		pendingAnswers.current = {};
		if (flushTimer.current) {
			clearTimeout(flushTimer.current);
			flushTimer.current = null;
		}
		const saved = loadDraft(roundId);
		setAnswers(saved);
		setTouched({});

		const savedFlame = storage.get(flameKey(roundId)) ?? "";
		setFlamed(savedFlame);

		if (isSpectator) return; // the commentator host submits nothing

		sendInputSync(roundId, saved);
		if (savedFlame) {
			ws.send({
				type: "setFlame",
				payload: { roundId, categoryId: savedFlame },
			});
		}
	}, [roundId]);

	// Every reconnect resends all answers: ones sent just before the socket died
	// may never have reached the server.
	const sessionEpoch = useRoomStore((s) => s.sessionEpoch);
	const syncedEpoch = useRef(sessionEpoch);
	// biome-ignore lint/correctness/useExhaustiveDependencies: run only on a new session
	useEffect(() => {
		if (syncedEpoch.current === sessionEpoch) return;
		syncedEpoch.current = sessionEpoch;
		if (roundId && !isSpectator) sendInputSync(roundId, answers);
	}, [sessionEpoch]);

	const countdown = useCountdown(
		game?.countdownRemaining ?? null,
		`${roundId}:cd:${game?.countdownRemaining ?? ""}`,
	);

	// Send the last keystrokes the moment time runs out, not a debounce later.
	const endsAt = game?.endsAt ?? null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-arm only on endsAt
	useEffect(() => {
		if (endsAt === null) return;
		const id = setTimeout(flushAnswers, Math.max(0, endsAt - Date.now()));
		return () => clearTimeout(id);
	}, [endsAt]);

	// Solo needs no gate: the lone player may end their own round at any time.
	const validation = lobby?.solo
		? { valid: true }
		: lobby && game
			? validateAnswers(lobby.categories, answers, game.letter, lastLetterMode)
			: { valid: false };
	const canBuzz =
		!isSpectator && lobby?.state === "Playing" && validation.valid && !buzzing;

	function handleBuzz() {
		flushAnswers(); // server must have the latest answers before the buzz check
		buzz();
		ws.send({ type: "buzz", payload: { roundId } });
	}

	async function handleEndRound() {
		if (
			await confirm({
				title: "Runde beenden?",
				description:
					"Die laufende Runde wird für alle sofort beendet und zur Bewertung gebracht.",
				confirmLabel: "Runde beenden",
				destructive: true,
			})
		) {
			ws.send({ type: "endRound", payload: {} });
		}
	}

	// Flush any buffered answers when leaving the screen (e.g. round ended on
	// timeout) so the last keystrokes still reach the server.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run only on unmount
	useEffect(() => {
		return () => flushAnswers();
	}, []);

	// Buzz with Enter (there's no form to submit). Only when an all-valid set
	// is ready and we are actually in the playing phase.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-bind only on canBuzz
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key !== "Enter") return;
			// Ignore auto-repeat so holding Enter buzzes only once; a second buzz
			// after the round advances would hit an invalid state.
			if (e.repeat) return;
			if (!canBuzz) return;
			if (isTypingTarget(e.target as Element)) return;
			// Pause while a confirm dialog is up (e.g. "Runde beenden?") so its Enter
			// doesn't also buzz (UX-1).
			if (isModalOpen()) return;
			e.preventDefault();
			handleBuzz();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canBuzz]);

	const lockedCount =
		lobby && game && !isSpectator
			? lobby.categories.filter(
					(c) =>
						touched[c.id] &&
						(answers[c.id] ?? "").trim() !== "" &&
						!ruleIssue(answers[c.id] ?? "", game.letter, lastLetterMode),
				).length
			: 0;
	const prevLocked = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: fires per newly locked card
	useEffect(() => {
		const n = lobby?.categories.length ?? 0;
		if (lockedCount > prevLocked.current) {
			sound.word(lockedCount);
			haptic(15);
			mood("happy", 700);
			for (const el of document.querySelectorAll(".card.locked .tiles"))
				fx.at(el, { n: 10, speed: 5 });
			if (lockedCount === n && n > 1) {
				sound.clear();
				shiftPalette();
				slam(`${n}/${n}`, "clear");
				mood("cheer", 1400);
			}
		}
		sound.layer = lockedCount;
		prevLocked.current = lockedCount;
	}, [lockedCount]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: fires per countdown step
	useEffect(() => {
		if (countdown === null || lobby?.state !== "Countdown") return;
		if (countdown > 0) sound.tick(3 - countdown);
		else slam("Los!", "big");
	}, [countdown]);

	if (!lobby) return null;

	function updateAnswer(categoryId: string, value: string) {
		const before = [...(answers[categoryId] ?? "")].length;
		const len = [...value].length;
		if (len > before) {
			sound.key(len - 1);
			if (Math.random() < 0.25) mood("blink", 160);
		}
		setAnswers((prev) => {
			const next = { ...prev, [categoryId]: value };
			storage.set(answersKey(roundId), JSON.stringify(next));
			return next;
		});
		pendingAnswers.current[categoryId] = value;
		if (!flushTimer.current) {
			flushTimer.current = setTimeout(flushAnswers, 250);
		}
	}

	function toggleFlame(categoryId: string, el: Element) {
		const next = flamed === categoryId ? "" : categoryId;
		setFlamed(next);
		if (next) storage.set(flameKey(roundId), next);
		else storage.remove(flameKey(roundId));
		ws.send({ type: "setFlame", payload: { roundId, categoryId: next } });
		if (next) {
			sound.ignite();
			fx.at(el, { n: 14, speed: 5, up: 3 });
			haptic([10, 20, 25]);
			mood("wow", 700);
		} else sound.fizzle();
	}

	if (lobby.state === "Countdown") {
		return (
			<>
				<RoomHeader />
				<section className="screen center countdown">
					<Mascot size="huge" letter={game?.letter ?? ""} base="wow" />
					{countdown !== null && (
						<b key={countdown} className="count" aria-live="assertive">
							{countdown > 0 ? countdown : "Los!"}
						</b>
					)}
				</section>
			</>
		);
	}

	if (!game) return null;

	if (game.letters?.length && !isSpectator)
		return (
			<>
				<RoomHeader>
					{isHost && !lobby.solo && (
						<IconBtn tip="Runde beenden" onClick={handleEndRound}>
							<Square />
						</IconBtn>
					)}
				</RoomHeader>
				<Sprint
					key={game.roundId}
					lobby={lobby}
					game={game}
					letters={game.letters}
					onStop={lobby.solo ? handleBuzz : undefined}
					buzzing={buzzing}
				/>
				{dialog}
			</>
		);

	const categories = lobby.categories;
	const playingPlayers = lobby.players.filter(
		(p) => !p.left && !p.pending && (!p.isHost || lobby.settings.hostPlays),
	);
	const isLocked = (id: string) =>
		touched[id] &&
		(answers[id] ?? "").trim() !== "" &&
		!ruleIssue(answers[id] ?? "", game.letter, lastLetterMode);

	function onEnter(idx: number, card: HTMLElement) {
		const cat = categories[idx];
		const value = answers[cat.id] ?? "";
		if (ruleIssue(value, game!.letter, lastLetterMode)) {
			if (value.trim()) {
				card.classList.remove("wrong");
				void card.offsetWidth;
				card.classList.add("wrong");
				sound.crunch();
				haptic([30, 40, 30]);
				mood("sad", 800);
			}
			return;
		}
		setTouched((t) => ({ ...t, [cat.id]: true }));
		const next = [
			...categories.slice(idx + 1),
			...categories.slice(0, idx),
		].find((c) => !isLocked(c.id));
		if (next) document.getElementById(`cat-${next.id}`)?.focus();
		else if (canBuzz) handleBuzz();
	}

	return (
		<>
			<RoomHeader>
				{isHost && !lobby.solo && !isSpectator && (
					<IconBtn tip="Runde beenden" onClick={handleEndRound}>
						<Square />
					</IconBtn>
				)}
			</RoomHeader>
			<section className="screen play">
				<div className="hud">
					<Mascot
						size="letter"
						letter={lastLetterMode ? `…${game.letter}` : game.letter}
					/>
					<div className="hud-mid">
						<Fuse endsAt={game.endsAt} total={lobby.settings.timeLimit} />
					</div>
					<div className="friends">
						{playingPlayers
							.filter((p) => p.id !== myPlayerId)
							.map((p) => (
								<span
									key={p.id}
									className={`friend${p.connected ? "" : " off"}`}
								>
									<Av id={p.id} name={p.name} size="sm" />
								</span>
							))}
					</div>
				</div>

				{isSpectator ? (
					<>
						{isPending && (
							<p
								className="hint"
								data-tip="Du spielst ab der nächsten Runde mit"
							>
								<Eye />
							</p>
						)}
						<CommentatorBoard
							categories={categories}
							players={playingPlayers}
							commentator={commentator}
						/>
						{isHost && !lobby.solo && (
							<Btn
								kind="stop"
								className="armed"
								aria-label="Runde beenden"
								data-tip="Runde beenden"
								onClick={handleEndRound}
							>
								<Square />
							</Btn>
						)}
					</>
				) : (
					<>
						<div className="cards">
							{categories.map((cat, idx) => {
								const value = answers[cat.id] ?? "";
								const issue = ruleIssue(value, game.letter, lastLetterMode);
								const showInvalid =
									issue !== undefined &&
									(touched[cat.id] ||
										(!lastLetterMode && issue !== LENGTH_ISSUE));
								return (
									<label
										key={cat.id}
										className={`card${isLocked(cat.id) ? " locked" : ""}${flamed === cat.id ? " flamed" : ""}`}
										style={{ "--ci": idx } as React.CSSProperties}
									>
										<span className="cat">{cat.name}</span>
										<Tiles
											value={value}
											letter={game.letter}
											last={lastLetterMode}
											live
											ghost={
												value
													? undefined
													: lastLetterMode
														? `…${game.letter}`
														: game.letter
											}
										/>
										<input
											id={`cat-${cat.id}`}
											className="answer"
											value={value}
											onChange={(e) => updateAnswer(cat.id, e.target.value)}
											onBlur={() =>
												setTouched((t) => ({ ...t, [cat.id]: true }))
											}
											onKeyDown={(e) => {
												if (e.key !== "Enter" || e.repeat) return;
												e.preventDefault();
												onEnter(
													idx,
													e.currentTarget.parentElement as HTMLElement,
												);
											}}
											maxLength={30}
											autoComplete="off"
											autoCapitalize="words"
											spellCheck={false}
											enterKeyHint={
												idx === categories.length - 1 ? "done" : "next"
											}
											// biome-ignore lint/a11y/noAutofocus: the round starts typing in the first field
											autoFocus={idx === 0}
											aria-label={`${cat.name} mit ${game.letter}`}
											aria-invalid={showInvalid || undefined}
										/>
										{showInvalid && <span className="issue">{issue}</span>}
										{flamesEnabled && (
											<button
												type="button"
												className="flame-btn"
												aria-pressed={flamed === cat.id}
												aria-label="Flamme"
												data-tip="Wette: einzige Antwort +5, sonst 0"
												onClick={(e) => toggleFlame(cat.id, e.currentTarget)}
											>
												<Flame />
											</button>
										)}
										<span className="lock">
											<Check />
										</span>
									</label>
								);
							})}
						</div>

						{(buzzRejected === "incompleteAnswers" ||
							buzzRejected === "invalidAnswers") && (
							<p className="err">Erst alle Kategorien gültig ausfüllen.</p>
						)}

						<Btn
							kind="stop"
							className={canBuzz ? "armed" : ""}
							aria-disabled={!canBuzz}
							data-tip={validation.valid ? "STOPP" : validation.reason}
							onClick={() => canBuzz && handleBuzz()}
						>
							{buzzing ? <Loader2 className="spin" /> : <Hand />}
							<span>STOPP</span>
						</Btn>
					</>
				)}
			</section>
			{dialog}
		</>
	);
}

// Sprint shows one prompt at a time: letter letters[pos / n] with category
// pos % n. Enter takes the word, Enter on an empty field skips the prompt.
function Sprint({
	lobby,
	game,
	letters,
	onStop,
	buzzing,
}: {
	lobby: LobbyStatePayload;
	game: GameStatePayload;
	letters: string[];
	onStop?: () => void;
	buzzing: boolean;
}) {
	const cats = lobby.categories;
	const n = cats.length;
	const last = lobby.settings.lastLetterMode;
	const [pos, setPos] = useState(game.sprintPos ?? 0);
	const [words, setWords] = useState<string[]>(game.sprintWords ?? []);
	const [streak, setStreak] = useState(0);
	const [value, setValue] = useState("");
	const card = useRef<HTMLLabelElement>(null);

	useEffect(() => {
		if (game.sprintPos === undefined) return;
		setPos(game.sprintPos);
		setWords(game.sprintWords ?? []);
	}, [game.sprintPos, game.sprintWords]);

	const done = pos >= letters.length * n;
	const letter = letters[(Math.min(pos, letters.length * n - 1) / n) | 0];
	const cat = cats[pos % n];

	function advance(word: string) {
		ws.send({
			type: "sprintWord",
			payload: { roundId: game.roundId, pos, value: word },
		});
		const next = pos + 1;
		const run = word ? streak + 1 : 0;
		setPos(next);
		setValue("");
		if (word) {
			setWords((w) => [...w, word]);
			sound.word(run);
			haptic(15);
			mood("happy", 600);
			fx.at(card.current, { n: 12, speed: 5 });
		} else {
			sound.whoosh();
			mood("blink", 300);
		}
		if (next % n === 0) {
			if (run >= n) {
				sound.clear();
				slam(`${n}/${n}`, "clear");
				mood("cheer", 1400);
			}
			shiftPalette();
			setStreak(0);
		} else setStreak(run);
	}

	function onEnter() {
		if (done) return;
		const word = value.trim();
		if (!word) return advance("");
		if (ruleIssue(word, letter, last)) {
			const el = card.current;
			el?.classList.remove("wrong");
			void el?.offsetWidth;
			el?.classList.add("wrong");
			sound.crunch();
			haptic([30, 40, 30]);
			mood("sad", 800);
			return;
		}
		advance(word);
	}

	return (
		<section className="screen play sprint">
			<div className="hud">
				<Mascot
					size="letter"
					letter={last ? `…${letter}` : letter}
					base={done ? "happy" : undefined}
				/>
				<div className="hud-mid">
					<Fuse endsAt={game.endsAt} total={lobby.settings.timeLimit} />
				</div>
				<b key={words.length} className="sprint-count" data-tip="Wörter">
					{words.length}
				</b>
			</div>

			<div className="rounds" aria-hidden="true">
				{cats.map((c, i) => (
					<i
						key={c.id}
						className={
							i < pos % n || done ? "done" : i === pos % n ? "now" : ""
						}
					/>
				))}
			</div>

			{done ? (
				<Mascot size="huge" base="cheer" />
			) : (
				<label key={pos} ref={card} className="card sprint-card">
					<span className="cat">{cat.name}</span>
					<Tiles
						value={value}
						letter={letter}
						last={last}
						live
						ghost={value ? undefined : last ? `…${letter}` : letter}
					/>
					<input
						className="answer"
						value={value}
						onChange={(e) => {
							if ([...e.target.value].length > [...value].length)
								sound.key([...e.target.value].length - 1);
							setValue(e.target.value);
						}}
						onKeyDown={(e) => {
							if (e.key !== "Enter" || e.repeat) return;
							e.preventDefault();
							onEnter();
						}}
						maxLength={30}
						autoComplete="off"
						autoCapitalize="words"
						spellCheck={false}
						enterKeyHint="next"
						// biome-ignore lint/a11y/noAutofocus: each prompt is typed right away
						autoFocus
						aria-label={`${cat.name} mit ${letter}`}
					/>
				</label>
			)}

			{!done && (
				<IconBtn tip="Überspringen" onClick={() => advance("")}>
					<SkipForward />
				</IconBtn>
			)}

			<div className="chips">
				{words.slice(-6).map((w, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: words repeat
						key={words.length - 6 + i}
						className="word-chip"
					>
						{w}
					</span>
				))}
			</div>

			{onStop && (
				<Btn
					kind="stop"
					className="armed"
					data-tip="STOPP"
					onClick={() => !buzzing && onStop()}
				>
					{buzzing ? <Loader2 className="spin" /> : <Hand />}
					<span>STOPP</span>
				</Btn>
			)}
		</section>
	);
}

// Fuse burns down to `endsAt`; it turns hot and ticks in the last seconds.
function Fuse({
	endsAt,
	total,
}: {
	endsAt: number | null;
	total: number | null;
}) {
	const left = () => (endsAt === null ? 1 : Math.max(0, endsAt - Date.now()));
	const [ms, setMs] = useState(left);
	// biome-ignore lint/correctness/useExhaustiveDependencies: left() reads endsAt
	useEffect(() => {
		if (endsAt === null) return;
		let last = -1;
		const id = setInterval(() => {
			const m = left();
			setMs(m);
			const s = Math.ceil(m / 1000);
			if (s !== last && s <= 5 && s > 0) {
				sound.tick(5 - s);
				haptic(12);
			}
			last = s;
		}, 100);
		return () => {
			clearInterval(id);
			document.body.classList.remove("urgent");
		};
	}, [endsAt]);
	const secs = Math.ceil(ms / 1000);
	const hot = endsAt !== null && secs <= 10;
	useEffect(() => {
		document.body.classList.toggle("urgent", hot);
		if (hot) mood("worried", 0);
	}, [hot]);
	if (endsAt === null)
		return (
			<div className="fuse endless" data-tip="Ohne Zeitlimit">
				<i />
			</div>
		);
	return (
		<div
			className={`fuse${hot ? " hot" : ""}`}
			style={
				{
					"--f": total ? Math.min(1, ms / (total * 1000)) : 1,
				} as React.CSSProperties
			}
			role="timer"
			aria-label={`${secs} Sekunden`}
		>
			<i />
			<b />
			<span className="sr-only" aria-live="assertive">
				{secs <= 5 ? secs : ""}
			</span>
		</div>
	);
}
