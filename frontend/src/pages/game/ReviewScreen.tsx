import { useEffect, useState } from "react";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	Crown,
	Flag,
	Flame,
	Gavel,
	Link2,
	Link2Off,
	ThumbsDown,
	ThumbsUp,
	X,
} from "lucide-react";
import { ws } from "@/lib/ws";
import { bounce, haptic } from "@/lib/feel";
import { sound } from "@/lib/sound";
import { handlesEnter, isTypingTarget } from "@/lib/utils";
import { normalize } from "@/lib/answerValidation";
import { useRoomStore, useIsHost } from "@/store/room";
import type { ReviewAnswer } from "@/types/events";
import { RoomHeader } from "@/components/RoomHeader";
import { Av, Btn, IconBtn, Mascot, playerColor, Tiles } from "@/components/kit";

const ptsClass = (p: number) =>
	p >= 20 ? "p20" : p >= 10 ? "p10" : p > 0 ? "p5" : "p0";

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

	// Deal the answer cards one by one whenever a category opens.
	// biome-ignore lint/correctness/useExhaustiveDependencies: categoryIndex is the trigger
	useEffect(() => {
		setMergeAnchor(null);
		setShown(0);
		sound.whoosh();
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

	// Enter marks yourself done, so a keyboard player never needs the mouse.
	useEffect(() => {
		if (!iVote) return;
		function onKey(e: KeyboardEvent) {
			if (e.key !== "Enter" || e.repeat || handlesEnter(document.activeElement))
				return;
			ws.send({ type: "reviewReady", payload: {} });
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [iVote]);

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

	function vote(a: ReviewAnswer, up: boolean, el: Element) {
		const mine = a.votes?.[me ?? ""];
		const v = mine === up ? 0 : up ? 1 : -1;
		ws.send({ type: "voteAnswer", payload: { answerId: a.answerId, vote: v } });
		bounce(el, 1.25);
		if (v === 1) sound.pop();
		else if (v === -1) sound.crunch();
		haptic(v === -1 ? [20, 30, 20] : 10);
	}

	function toggleReady() {
		ws.send({ type: "reviewReady", payload: {} });
		if (!imReady) sound.stamp(10);
		haptic(15);
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
						const up = votes.filter(Boolean).length;
						const down = votes.length - up;
						const mine = a.votes?.[me ?? ""];
						const doubted = down > 0 && !a.ruled;
						const canVote = iVote && a.playerId !== me && !a.ruled;
						return (
							// biome-ignore lint/a11y/noStaticElementInteractions: merge pick, the buttons stay the keyboard path
							// biome-ignore lint/a11y/useKeyWithClickEvents: merge pick, the buttons stay the keyboard path
							<div
								key={a.answerId}
								className={`ans${i < shown ? " dealt open" : ""}${a.valid ? "" : " cracked"}${doubted ? " doubt" : ""}${merged ? " linked" : ""}${mergeAnchor === a.answerId ? " twin" : ""}`}
								style={
									{ "--pc": playerColor(a.playerId) } as React.CSSProperties
								}
								onClick={() => mergeAnchor && pick(a)}
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
										{a.flamed && (
											<span
												className={`ans-flame${a.pointsPreview > 10 ? " win" : a.pointsPreview === 0 ? " out" : ""}`}
												data-tip="Flamme"
											>
												<Flame />
											</span>
										)}
										<span className={`pts on ${ptsClass(a.pointsPreview)}`}>
											{a.pointsPreview}
										</span>
										{a.value && (canVote || down > 0 || isHost) && (
											<span className="thumbs">
												{canVote ? (
													<>
														<button
															type="button"
															className="up"
															aria-pressed={mine === true}
															aria-label="Gilt"
															data-tip="Gilt"
															onClick={(e) => vote(a, true, e.currentTarget)}
														>
															<ThumbsUp />
															{up > 0 && <small>{up}</small>}
														</button>
														<button
															type="button"
															className="down"
															aria-pressed={mine === false}
															aria-label="Gilt nicht"
															data-tip="Gilt nicht"
															onClick={(e) => vote(a, false, e.currentTarget)}
														>
															<ThumbsDown />
															{down > 0 && <small>{down}</small>}
														</button>
													</>
												) : (
													down > 0 && (
														<span
															className="tally"
															data-tip={`${up} dafür, ${down} dagegen`}
														>
															<ThumbsDown />
															{down}
														</span>
													)
												)}
												{isHost && (
													<button
														type="button"
														className="rule"
														aria-pressed={a.ruled}
														aria-label={
															a.valid
																? "Als ungültig festlegen"
																: "Als gültig festlegen"
														}
														data-tip={
															a.valid ? "Host: gilt nicht" : "Host: gilt"
														}
														onClick={(e) => {
															ws.send({
																type: "setAnswerValidity",
																payload: {
																	answerId: a.answerId,
																	valid: !a.valid,
																},
															});
															sound.stamp(a.valid ? 0 : 10);
															bounce(e.currentTarget, 1.25);
														}}
													>
														<Gavel />
													</button>
												)}
											</span>
										)}
										{isHost && merged && (
											<button
												type="button"
												className="link-btn"
												aria-label="Trennen"
												data-tip={`Trennen von ${playerName(a.mergedInto)}`}
												onClick={() =>
													ws.send({
														type: "unmergeAnswers",
														payload: { answerId: a.answerId },
													})
												}
											>
												<Link2Off />
											</button>
										)}
										{isHost &&
											!merged &&
											a.valid &&
											(canMerge || mergeAnchor === a.answerId) &&
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
