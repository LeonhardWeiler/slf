import { useEffect, useRef, useState } from "react";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	Crown,
	Flag,
	Link2,
	Link2Off,
	ThumbsDown,
	X,
} from "lucide-react";
import { ws } from "@/lib/ws";
import { bounce, haptic, slam } from "@/lib/feel";
import { sound } from "@/lib/sound";
import { handlesEnter, isTypingTarget } from "@/lib/utils";
import { BUZZ_BONUS, normalize, wordValue } from "@/lib/answerValidation";
import { useRoomStore, useIsHost } from "@/store/room";
import type { ReviewAnswer } from "@/types/events";
import { CountUp } from "@/components/CountUp";
import { RoomHeader } from "@/components/RoomHeader";
import { Av, Btn, IconBtn, Mascot, playerColor, Tiles } from "@/components/kit";

// ptsClass colours an answer by its multiplier (shared, unique, only one).
function ptsClass(a: ReviewAnswer) {
	if (a.pointsPreview <= 0) return "p0";
	const m = a.pointsPreview / wordValue(a.value);
	return m >= 4 ? "p20" : m >= 2 ? "p10" : "p5";
}

export function ReviewScreen() {
	const lobby = useRoomStore((s) => s.lobby);
	const review = useRoomStore((s) => s.review);
	const me = useRoomStore((s) => s.myPlayerId);
	const isHost = useIsHost();
	const [mergeAnchor, setMergeAnchor] = useState<string | null>(null);
	const [shown, setShown] = useState(0);

	const idx = review?.categoryIndex ?? 0;
	const count = review?.answers.length ?? 0;
	const isFirst = idx <= 0;
	const isLast = review ? idx >= review.categoryCount - 1 : false;

	const buzzedRound = review?.buzzedBy === me ? review?.roundId : undefined;
	useEffect(() => {
		if (buzzedRound) slam(`+${BUZZ_BONUS}`, "win");
	}, [buzzedRound]);

	// Deal the answer cards one by one whenever a category opens.
	const opened = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: categoryIndex is the trigger
	useEffect(() => {
		setMergeAnchor(null);
		setShown(0);
		if (opened.current) sound.advance();
		else sound.whoosh();
		opened.current = true;
		let k = 0;
		const id = setInterval(() => {
			k++;
			setShown(k);
			sound.flip();
			if (k >= count) clearInterval(id);
		}, 140);
		return () => clearInterval(id);
	}, [idx]);

	useEffect(() => {
		if (!isHost) return;
		function onKey(e: KeyboardEvent) {
			if (
				e.defaultPrevented ||
				isTypingTarget(document.activeElement) ||
				e.repeat
			)
				return;
			if (e.key === "ArrowLeft" && !isFirst)
				ws.send({ type: "previousCategory", payload: {} });
			else if (e.key === "ArrowRight" && !isLast)
				ws.send({ type: "nextCategory", payload: {} });
			else if (e.key === "Escape" && mergeAnchor !== null) setMergeAnchor(null);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isHost, isFirst, isLast, mergeAnchor]);

	const voters = review?.voters ?? [];
	const ready = new Set(review?.ready ?? []);
	const iVote = voters.includes(me ?? "");
	const imReady = ready.has(me ?? "");

	function toggleReady() {
		ws.send({ type: "reviewReady", payload: {} });
		sound.ready(!imReady);
		haptic(imReady ? 8 : 15);
	}

	// Enter marks yourself done, so a keyboard player never needs the mouse.
	// biome-ignore lint/correctness/useExhaustiveDependencies: toggleReady reads imReady
	useEffect(() => {
		if (!iVote) return;
		function onKey(e: KeyboardEvent) {
			if (e.key !== "Enter" || e.repeat || handlesEnter(document.activeElement))
				return;
			toggleReady();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [iVote, imReady]);

	if (!lobby || !review) return null;

	const playerName = (id: string) =>
		lobby.players.find((p) => p.id === id)?.name ?? "?";
	const category =
		lobby.categories.find((c) => c.id === review.categoryId)?.name ?? "";
	const last = lobby.settings.lastLetterMode;
	const canMerge =
		new Set(
			review.answers
				.filter((a) => a.valid && a.mergedInto === "")
				.map((a) => normalize(a.value)),
		).size >= 2;

	// strike lets the host rule an answer out (or back in) and a voter doubt it.
	function strike(a: ReviewAnswer, el: Element) {
		let out: boolean;
		if (isHost) {
			out = a.valid;
			ws.send({
				type: "setAnswerValidity",
				payload: { answerId: a.answerId, valid: !a.valid },
			});
		} else {
			out = a.votes?.[me ?? ""] !== false;
			ws.send({
				type: "voteAnswer",
				payload: { answerId: a.answerId, vote: out ? -1 : 0 },
			});
		}
		bounce(el, 1.04);
		if (out) sound.crunch();
		else sound.pop();
		haptic(out ? [20, 30, 20] : 10);
	}

	function pick(a: ReviewAnswer) {
		if (
			mergeAnchor === null ||
			mergeAnchor === a.answerId ||
			a.mergedInto !== ""
		)
			return;
		ws.send({
			type: "mergeAnswers",
			payload: { targetAnswerId: mergeAnchor, sourceAnswerId: a.answerId },
		});
		setMergeAnchor(null);
		sound.combo(2);
	}

	return (
		<>
			<RoomHeader />
			<section className="screen review">
				<div className="hud">
					<Mascot size="letter" letter={review.letter} />
					<div className="hud-mid">
						<h2 className="cat-title">{category}</h2>
						<div className="rounds">
							{Array.from({ length: review.categoryCount }, (_, i) => (
								<i
									// biome-ignore lint/suspicious/noArrayIndexKey: one dot per slot
									key={i}
									className={i < idx ? "done" : i === idx ? "now" : ""}
								/>
							))}
						</div>
					</div>
					{idx === 0 && (
						<span
							className="ends"
							data-tip={
								review.endReason === "timeout"
									? "Zeit abgelaufen"
									: review.endReason === "host"
										? "Host hat beendet"
										: "Gestoppt"
							}
						>
							{review.endReason === "timeout" ? (
								<Clock />
							) : review.endReason === "host" ? (
								<Crown />
							) : review.buzzedBy ? (
								<Av
									id={review.buzzedBy}
									name={playerName(review.buzzedBy)}
									size="sm"
								/>
							) : null}
						</span>
					)}
				</div>

				<div className={`answers${mergeAnchor ? " merging" : ""}`}>
					{review.answers.map((a, i) => {
						const merged = a.mergedInto !== "";
						const votes = Object.values(a.votes ?? {});
						const down = votes.filter((v) => !v).length;
						const doubted = down > 0 && !a.ruled;
						const canStrike =
							a.value !== "" &&
							(isHost || (iVote && a.playerId !== me && !a.ruled));
						const out = isHost ? !a.valid : a.votes?.[me ?? ""] === false;
						return (
							// biome-ignore lint/a11y/useSemanticElements: the card holds its own buttons, so it cannot be a <button>
							<div
								key={a.answerId}
								className={`ans${i < shown ? " dealt open" : ""}${a.valid ? "" : " cracked"}${doubted ? " doubt" : ""}${merged ? " linked" : ""}${mergeAnchor === a.answerId ? " twin" : ""}`}
								style={
									{ "--pc": playerColor(a.playerId) } as React.CSSProperties
								}
								role="button"
								tabIndex={canStrike ? 0 : -1}
								aria-disabled={!canStrike}
								aria-pressed={out}
								aria-label={
									canStrike
										? isHost
											? a.valid
												? "Als ungültig festlegen"
												: "Als gültig festlegen"
											: "Gilt nicht"
										: undefined
								}
								data-tip={
									canStrike && !mergeAnchor && out
										? "Antippen: gilt wieder"
										: undefined
								}
								onClick={(e) => {
									if (mergeAnchor) pick(a);
									else if (canStrike) strike(a, e.currentTarget);
								}}
								onKeyDown={(e) => {
									if (
										(e.key === "Enter" || e.key === " ") &&
										e.target === e.currentTarget
									) {
										e.preventDefault();
										e.currentTarget.click();
									}
								}}
							>
								<div className="ans-card">
									<div className="ans-back">
										<Av id={a.playerId} name={playerName(a.playerId)} />
									</div>
									<div className="ans-front">
										<Av
											id={a.playerId}
											name={playerName(a.playerId)}
											size="sm"
										/>
										<div className="ans-word">
											{a.value ? (
												<Tiles
													value={a.value}
													letter={review.letter}
													last={last}
													max={26}
												/>
											) : (
												<span className="empty">–</span>
											)}
										</div>
										<CountUp
											value={a.pointsPreview}
											className={`pts ${ptsClass(a)}`}
										/>
										{down > 0 && (
											<span className="tally" data-tip={`${down} dagegen`}>
												<ThumbsDown />
												{down}
											</span>
										)}
										{isHost && merged && (
											<button
												type="button"
												className="link-btn"
												aria-label="Trennen"
												data-tip={`Trennen von ${playerName(a.mergedInto)}`}
												onClick={(e) => {
													e.stopPropagation();
													ws.send({
														type: "unmergeAnswers",
														payload: { answerId: a.answerId },
													});
												}}
											>
												<Link2Off />
											</button>
										)}
										{isHost &&
											!merged &&
											a.valid &&
											canMerge &&
											!mergeAnchor && (
												<button
													type="button"
													className="link-btn"
													aria-label="Zusammenführen"
													data-tip="Gleiche Antwort verbinden"
													onClick={(e) => {
														e.stopPropagation();
														setMergeAnchor(a.answerId);
													}}
												>
													<Link2 />
												</button>
											)}
									</div>
								</div>
							</div>
						);
					})}
					{review.answers.length === 0 && <Mascot base="sad" />}
				</div>

				{mergeAnchor && (
					<IconBtn
						tip="Verbinden abbrechen"
						onClick={() => setMergeAnchor(null)}
					>
						<X />
					</IconBtn>
				)}

				<div className="ready-row">
					{voters.map((id) => (
						<Av
							key={id}
							id={id}
							name={playerName(id)}
							size="sm"
							className={ready.has(id) ? "on" : ""}
						/>
					))}
				</div>

				{iVote && (
					<Btn
						kind="next"
						className={imReady ? "done" : ""}
						aria-pressed={imReady}
						aria-label="Fertig"
						data-tip={imReady ? "Doch nicht fertig" : "Fertig"}
						onClick={toggleReady}
					>
						<Check />
					</Btn>
				)}

				{isHost && (
					<div className="host-tools">
						<IconBtn
							tip="Vorherige Kategorie"
							disabled={isFirst}
							onClick={() => ws.send({ type: "previousCategory", payload: {} })}
						>
							<ChevronLeft />
						</IconBtn>
						{isLast ? (
							<IconBtn
								tip="Bewertung abschließen"
								onClick={() => ws.send({ type: "finishReview", payload: {} })}
							>
								<Flag />
							</IconBtn>
						) : (
							<IconBtn
								tip="Nächste Kategorie"
								onClick={() => ws.send({ type: "nextCategory", payload: {} })}
							>
								<ChevronRight />
							</IconBtn>
						)}
					</div>
				)}
			</section>
		</>
	);
}
