import { useEffect, useRef, useState } from "react";
import { Flame, Check } from "lucide-react";
import { ws } from "@/lib/ws";
import { cn } from "@/lib/utils";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import {
	validateAnswers,
	ruleIssue,
	LENGTH_ISSUE,
} from "@/lib/answerValidation";
import { RoomHeader } from "@/components/RoomHeader";
import { RoundLetter } from "@/components/RoundLetter";
import { CommentatorBoard } from "@/components/CommentatorBoard";
import { useConfirm } from "@/components/ConfirmDialog";
import { isModalOpen } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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

// Whole seconds until the local-clock deadline `endsAt`, null when unlimited.
function useSecondsLeft(endsAt: number | null): number | null {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (endsAt === null) return;
		setNow(Date.now());
		const id = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(id);
	}, [endsAt]);
	return endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

const answersKey = (roundId: string) => `slf:answers:${roundId}`;

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
const flameKey = (roundId: string) => `slf:flame:${roundId}`;
const flameHintKey = "slf:flameHintSeen";

// Draft answers/flames are stored per round. Drop every round's drafts except the
// current one so localStorage doesn't grow unbounded across many games.
function purgeOtherRoundDrafts(keepRoundId: string) {
	try {
		const keep = new Set([answersKey(keepRoundId), flameKey(keepRoundId)]);
		const stale: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!k) continue;
			if (
				(k.startsWith("slf:answers:") || k.startsWith("slf:flame:")) &&
				!keep.has(k)
			) {
				stale.push(k);
			}
		}
		for (const k of stale) localStorage.removeItem(k);
	} catch {
		/* ignore storage errors */
	}
}

function formatClock(total: number): string {
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GameScreen() {
	const lobby = useLobbyStore((s) => s.lobby);
	const myPlayerId = useLobbyStore((s) => s.myPlayerId);
	const game = useGameStore((s) => s.game);
	const buzzRejected = useGameStore((s) => s.buzzRejected);
	const buzzing = useGameStore((s) => s.buzzing);
	const buzz = useGameStore((s) => s.buzz);
	const commentator = useGameStore((s) => s.commentator);
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
	const [showFlameHint] = useState(() => !localStorage.getItem(flameHintKey));
	useEffect(() => {
		if (flamesEnabled && showFlameHint) localStorage.setItem(flameHintKey, "1");
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
		purgeOtherRoundDrafts(roundId);
		// Drop any buffered answers from the previous round.
		pendingAnswers.current = {};
		if (flushTimer.current) {
			clearTimeout(flushTimer.current);
			flushTimer.current = null;
		}
		let saved: Record<string, string> = {};
		try {
			saved = JSON.parse(localStorage.getItem(answersKey(roundId)) ?? "{}");
		} catch {
			saved = {};
		}
		setAnswers(saved);
		setTouched({});

		const savedFlame = localStorage.getItem(flameKey(roundId)) ?? "";
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
	const sessionEpoch = useLobbyStore((s) => s.sessionEpoch);
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
	const timeLeft = useSecondsLeft(game?.endsAt ?? null);

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
			// Pause while a confirm dialog is up (e.g. "Runde beenden?") so its Enter
			// doesn't also buzz (UX-1).
			if (isModalOpen()) return;
			e.preventDefault();
			handleBuzz();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canBuzz]);

	if (!lobby) return null;

	function updateAnswer(categoryId: string, value: string) {
		setAnswers((prev) => {
			const next = { ...prev, [categoryId]: value };
			try {
				localStorage.setItem(answersKey(roundId), JSON.stringify(next));
			} catch {
				/* ignore quota errors */
			}
			return next;
		});
		// Debounce the server sync: batch keystrokes into at most one answerUpdate
		// per ~250ms instead of one message per keystroke.
		pendingAnswers.current[categoryId] = value;
		if (!flushTimer.current) {
			flushTimer.current = setTimeout(flushAnswers, 250);
		}
	}

	// Toggle the flame on a category. Only one flame per round, so flaming another
	// category moves it. The server is authoritative and enforces the same limit.
	function toggleFlame(categoryId: string) {
		const next = flamed === categoryId ? "" : categoryId;
		setFlamed(next);
		try {
			if (next) localStorage.setItem(flameKey(roundId), next);
			else localStorage.removeItem(flameKey(roundId));
		} catch {
			/* ignore quota errors */
		}
		ws.send({ type: "setFlame", payload: { roundId, categoryId: next } });
	}

	// ---- Countdown phase ----
	// Phase is derived from the lobby state (single source of truth) so the
	// countdown screen shows immediately - even before the first gameState
	// arrives - instead of a blank frame or a flash of the Playing UI.
	if (lobby.state === "Countdown") {
		const display =
			countdown === null ? "" : countdown > 0 ? String(countdown) : "Los!";
		const isGo = countdown === 0;
		const letter = game?.letter;
		return (
			<div className="min-h-svh bg-background flex flex-col items-center justify-center screen-pad gap-6 animate-fade-in">
				{letter && <RoundLetter letter={letter} className="text-9xl" />}
				<div
					className={cn(
						"flex items-center justify-center",
						letter ? "h-16" : "h-48 w-48",
					)}
				>
					{/* Just the digits scale down and swap each tick - no progress ring. */}
					<div
						key={display}
						aria-live="assertive"
						aria-atomic="true"
						className={cn(
							"font-bold tabular-nums min-h-[1em]",
							letter ? "text-4xl" : "text-8xl",
							isGo
								? "animate-countdown-go text-primary"
								: "animate-countdown-pop",
						)}
					>
						{display}
					</div>
				</div>
			</div>
		);
	}

	if (!game) return null;

	const categories = lobby.categories;
	const placeholder = lastLetterMode ? `…${game.letter}` : `${game.letter}…`;

	// ---- Playing phase ----
	// Red border stays on through 0 and until the round actually ends.
	const dangerZone = timeLeft !== null && timeLeft <= 5;

	// Players actually participating this round (for the fill overview): not left,
	// not a pending spectator, and - unless the host plays - not the host.
	const playingPlayers = lobby.players.filter(
		(p) => !p.left && !p.pending && (!p.isHost || lobby.settings.hostPlays),
	);

	return (
		<div className="min-h-svh bg-background screen-pad">
			{/* Red, pulsing screen border for the final 5 seconds (only when timed). */}
			{dangerZone && (
				<div className="pointer-events-none fixed inset-0 z-50 ring-4 ring-inset ring-destructive animate-pulse" />
			)}
			<div
				className={cn(
					"mx-auto w-full space-y-4 animate-fade-in",
					isSpectator ? "max-w-5xl" : "max-w-xl",
				)}
			>
				<RoomHeader
					title={
						isSpectator
							? isPending
								? "Gleich dabei"
								: "Kommentator"
							: "Runde läuft"
					}
				/>
				{isPending && (
					<p className="text-center text-sm text-muted-foreground">
						Du spielst ab der nächsten Runde mit.
					</p>
				)}

				{/* Letter & time without a surrounding card/border; the values sit
            freely on the background (like the borderless switch). */}
				<div className="flex items-center justify-between px-1">
					<RoundLetter letter={game.letter} className="text-6xl" />
					{timeLeft !== null && (
						<p
							className={cn(
								"text-3xl font-mono font-bold tabular-nums",
								dangerZone && "text-destructive",
							)}
						>
							{formatClock(timeLeft)}
						</p>
					)}
				</div>

				{/* Screen-reader announcement for the final seconds. */}
				<span className="sr-only" aria-live="assertive">
					{dangerZone && timeLeft !== null ? `Noch ${timeLeft} Sekunden` : ""}
				</span>

				{isSpectator ? (
					<Card>
						<CardContent className="pt-6">
							<CommentatorBoard
								categories={categories}
								players={playingPlayers}
								commentator={commentator}
							/>
						</CardContent>
					</Card>
				) : (
					<>
						{flamesEnabled && showFlameHint && (
							<p className="text-sm text-muted-foreground">
								🔥 Wette: einzige Antwort +5, sonst 0
							</p>
						)}
						<div className="space-y-3">
							{categories.map((cat, idx) => {
								const isFlamed = flamed === cat.id;
								const issue = ruleIssue(
									answers[cat.id] ?? "",
									game.letter,
									lastLetterMode,
								);
								// A wrong first letter shows at once, anything else after blur.
								const showInvalid =
									issue !== undefined &&
									(touched[cat.id] ||
										(!lastLetterMode && issue !== LENGTH_ISSUE));
								const done = (answers[cat.id] ?? "").trim() !== "" && !issue;
								return (
									<div key={cat.id} className="space-y-1">
										<label
											htmlFor={`cat-${cat.id}`}
											className="text-sm font-medium"
										>
											{cat.name}
										</label>
										<div className="flex items-center gap-2">
											<div className="relative flex-1">
												<Input
													id={`cat-${cat.id}`}
													value={answers[cat.id] ?? ""}
													onChange={(e) => updateAnswer(cat.id, e.target.value)}
													onBlur={() =>
														setTouched((t) => ({ ...t, [cat.id]: true }))
													}
													placeholder={placeholder}
													maxLength={30}
													autoComplete="off"
													autoFocus={idx === 0}
													aria-invalid={showInvalid || undefined}
													className={cn(done && "pr-9")}
												/>
												{/* Check pops in once the field holds a valid answer. */}
												{done && (
													<Check className="animate-scale-in pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
												)}
											</div>
											{flamesEnabled && (
												<Button
													type="button"
													variant="outline"
													size="icon"
													aria-pressed={isFlamed}
													aria-label="Flamme setzen"
													title={
														isFlamed
															? "Flamme entfernen"
															: "Flamme setzen: Wette, dass du die einzige Antwort hast (+5 / 0)"
													}
													onClick={() => toggleFlame(cat.id)}
													className="shrink-0 aria-pressed:border-orange-500 aria-pressed:text-orange-500 aria-pressed:bg-orange-500/10 aria-pressed:hover:text-orange-500"
												>
													<Flame
														className={cn(
															"h-4 w-4",
															isFlamed && "fill-orange-500",
														)}
													/>
												</Button>
											)}
										</div>
										{showInvalid && (
											<p className="text-xs text-destructive">{issue}</p>
										)}
									</div>
								);
							})}
						</div>

						{(buzzRejected === "incompleteAnswers" ||
							buzzRejected === "invalidAnswers") && (
							<p className="text-sm text-destructive text-center">
								Du musst alle Kategorien gültig ausfüllen, bevor du buzzern
								kannst.
							</p>
						)}

						<div className="space-y-2">
							<Button
								className="w-full"
								size="lg"
								onClick={handleBuzz}
								disabled={!validation.valid || buzzing}
							>
								{buzzing ? "Gesendet…" : "STOPP - Fertig!"}
							</Button>
							{!validation.valid && (
								<p className="text-center text-xs text-muted-foreground">
									{validation.reason}
								</p>
							)}
						</div>
					</>
				)}

				{/* Host can end a stuck round early (hard letter, or a commentator host
            who never buzzes) -> everyone moves to review. */}
				{isHost && !lobby.solo && (
					<div className="flex justify-center pt-1">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground"
							onClick={handleEndRound}
						>
							Runde beenden
						</Button>
					</div>
				)}
			</div>
			{dialog}
		</div>
	);
}
