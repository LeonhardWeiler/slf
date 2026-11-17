import { useEffect, useState } from "react";
import { ws } from "@/lib/ws";
import {
	X,
	Check,
	ChevronLeft,
	ChevronRight,
	Link2,
	Link2Off,
	Bell,
	ThumbsDown,
} from "lucide-react";
import { cn, handlesEnter, isTypingTarget, pressProps } from "@/lib/utils";
import { useRoomStore, useIsHost } from "@/store/room";
import { normalize, ruleIssue } from "@/lib/answerValidation";
import type { ReviewAnswer } from "@/types/events";
import { RoomHeader } from "@/components/RoomHeader";
import { RoundLetter } from "@/components/RoundLetter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ReviewScreen() {
	const lobby = useRoomStore((s) => s.lobby);
	const review = useRoomStore((s) => s.review);
	const me = useRoomStore((s) => s.myPlayerId) ?? "";

	// The answer picked as the merge target ("group anchor"). While set, the
	// host merges by clicking another answer's row directly (no second button).
	const [mergeAnchor, setMergeAnchor] = useState<string | null>(null);

	const isHost = useIsHost();
	const isFirst = (review?.categoryIndex ?? 0) <= 0;
	const isLast = review
		? review.categoryIndex >= review.categoryCount - 1
		: false;
	const voters = review?.voters ?? [];
	const ready = new Set(review?.ready ?? []);
	const iVote = voters.includes(me);
	const imReady = ready.has(me);

	// biome-ignore lint/correctness/useExhaustiveDependencies: categoryIndex is the intended trigger
	useEffect(() => {
		setMergeAnchor(null);
	}, [review?.categoryIndex]);

	// Arrows page through categories for the host. Enter marks a voter done;
	// a host who does not vote advances with it instead. Escape cancels a merge.
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.defaultPrevented || isTypingTarget(document.activeElement)) return;
			if (e.repeat) return;
			if (isHost && e.key === "ArrowLeft" && !isFirst) {
				ws.send({ type: "previousCategory", payload: {} });
			} else if (isHost && e.key === "ArrowRight" && !isLast) {
				ws.send({ type: "nextCategory", payload: {} });
			} else if (e.key === "Escape" && mergeAnchor !== null) {
				setMergeAnchor(null);
			} else if (e.key === "Enter" && !handlesEnter(document.activeElement)) {
				if (iVote) ws.send({ type: "reviewReady", payload: {} });
				else if (isHost)
					ws.send({
						type: isLast ? "finishReview" : "nextCategory",
						payload: {},
					});
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isHost, isFirst, isLast, mergeAnchor, iVote]);

	if (!lobby || !review) return null;

	const playerName = (id: string) =>
		lobby.players.find((p) => p.id === id)?.name ?? "?";
	const categoryName =
		lobby.categories.find((c) => c.id === review.categoryId)?.name ??
		"Kategorie";
	const endText =
		review.endReason === "timeout" ? (
			"Zeit abgelaufen"
		) : review.endReason === "host" ? (
			"Host hat die Runde beendet"
		) : review.buzzedBy ? (
			<>
				<b>{playerName(review.buzzedBy)}</b> hat gestoppt
			</>
		) : null;

	// The host rules an answer in or out; a voter doubts someone else's answer.
	function strike(a: ReviewAnswer) {
		if (isHost)
			ws.send({
				type: "setAnswerValidity",
				payload: { answerId: a.answerId, valid: !a.valid },
			});
		else
			ws.send({
				type: "voteAnswer",
				payload: {
					answerId: a.answerId,
					vote: a.votes?.[me] === false ? 0 : -1,
				},
			});
	}
	function unmerge(answerId: string) {
		ws.send({ type: "unmergeAnswers", payload: { answerId } });
	}
	function mergeInto(sourceAnswerId: string) {
		if (mergeAnchor === null || mergeAnchor === sourceAnswerId) return;
		ws.send({
			type: "mergeAnswers",
			payload: { targetAnswerId: mergeAnchor, sourceAnswerId },
		});
		setMergeAnchor(null);
	}

	const canMerge =
		new Set(
			review.answers
				.filter((a) => a.valid && a.mergedInto === "")
				.map((a) => normalize(a.value)),
		).size >= 2;
	const mergeMode = mergeAnchor !== null;
	const nobody = review.answers.every((a) => a.value === "");

	return (
		<div className="min-h-svh bg-background screen-pad">
			<div className="mx-auto w-full max-w-xl space-y-4">
				<RoomHeader title="Bewertung" />

				{endText && (
					<p className="flex items-center justify-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
						<Bell className="h-4 w-4 shrink-0" />
						<span>{endText}</span>
					</p>
				)}

				<Card>
					<CardContent className="pt-6 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<RoundLetter letter={review.letter} className="text-4xl" />
							<div>
								<p className="text-xs text-muted-foreground uppercase tracking-widest">
									Kategorie {review.categoryIndex + 1}/{review.categoryCount}
								</p>
								<p className="text-lg font-semibold">{categoryName}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6 space-y-2">
						{nobody && (
							<p className="text-sm text-muted-foreground">
								Niemand hatte etwas in dieser Kategorie.
							</p>
						)}
						{!nobody &&
							review.answers.map((a) => {
								const merged = a.mergedInto !== "";
								const isAnchor = mergeAnchor === a.answerId;
								const clickable = mergeMode && !isAnchor && !merged;
								const toggles =
									!mergeMode &&
									a.value !== "" &&
									(isHost || (iVote && a.playerId !== me && !a.ruled));
								const down = Object.values(a.votes ?? {}).filter(
									(v) => !v,
								).length;
								const mine = a.votes?.[me] === false;
								const reason = !a.valid
									? ruleIssue(
											a.value,
											review.letter,
											lobby.settings.lastLetterMode,
										)
									: undefined;
								return (
									<div
										key={a.answerId}
										className={cn(
											"px-3 py-2.5 transition-colors",
											isAnchor
												? "bg-primary/10 ring-2 ring-primary"
												: a.valid
													? "bg-green-500/10"
													: "bg-muted/50",
											clickable &&
												"ring-1 ring-primary/40 hover:ring-2 hover:ring-primary active:ring-2 active:ring-primary",
										)}
									>
										{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is set dynamically to switch */}
										<div
											role={
												clickable ? "button" : toggles ? "switch" : undefined
											}
											aria-checked={
												toggles ? (isHost ? a.valid : !mine) : undefined
											}
											{...(clickable
												? pressProps(() => mergeInto(a.answerId))
												: toggles
													? pressProps(() => strike(a))
													: {})}
											className={cn((clickable || toggles) && "cursor-pointer")}
										>
											<div className="flex items-center justify-between gap-3">
												<div className="min-w-0">
													<span className="text-xs text-muted-foreground">
														{playerName(a.playerId)}
													</span>
													<p
														className={cn(
															"text-lg font-medium truncate",
															a.valid
																? "text-foreground"
																: "line-through text-muted-foreground",
														)}
													>
														{a.value || "-"}
													</p>
													{merged && (
														<p className="text-xs text-muted-foreground">
															↳ zusammengeführt mit {playerName(a.mergedInto)}
														</p>
													)}
													{reason && (
														<p className="text-xs text-muted-foreground">
															{reason}
														</p>
													)}
												</div>
												<div className="flex items-center gap-3 shrink-0">
													{down > 0 && (
														<span
															className={cn(
																"flex items-center gap-1 text-sm tabular-nums",
																mine
																	? "text-destructive"
																	: "text-muted-foreground",
															)}
															title={`${down} dagegen`}
														>
															<ThumbsDown className="h-4 w-4" />
															{down}
														</span>
													)}
													<span
														className={cn(
															"text-lg font-bold tabular-nums w-12 text-right",
															a.valid ? "" : "text-muted-foreground",
														)}
													>
														{a.pointsPreview}
													</span>
												</div>
											</div>
										</div>

										{isHost &&
											(merged ||
												(!mergeMode && canMerge && a.valid) ||
												isAnchor) && (
												<div className="mt-1.5 flex flex-wrap items-center gap-2">
													{merged ? (
														<Button
															variant="ghost"
															size="xs"
															onClick={() => unmerge(a.answerId)}
														>
															<Link2Off className="h-3.5 w-3.5 mr-1" />
															Trennen
														</Button>
													) : isAnchor ? (
														<>
															<Button
																variant="outline"
																size="xs"
																onClick={() => setMergeAnchor(null)}
															>
																<X className="h-3.5 w-3.5 mr-1" />
																Abbrechen
															</Button>
															<span className="text-xs text-muted-foreground">
																Antwort antippen, die gleich „{a.value}“ ist
															</span>
														</>
													) : (
														<Button
															variant="ghost"
															size="xs"
															onClick={() => setMergeAnchor(a.answerId)}
														>
															<Link2 className="h-3.5 w-3.5 mr-1" />
															Zusammenführen
														</Button>
													)}
												</div>
											)}
									</div>
								);
							})}
					</CardContent>
				</Card>

				{iVote && (
					<p className="text-center text-xs text-muted-foreground">
						Antwort antippen, wenn sie nicht gilt.
					</p>
				)}

				{voters.length > 0 && (
					<div className="flex flex-wrap justify-center gap-2">
						{voters.map((id) => (
							<span
								key={id}
								className={cn(
									"flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
									ready.has(id)
										? "border-green-600 text-green-700 dark:text-green-400"
										: "text-muted-foreground",
								)}
							>
								{ready.has(id) && <Check className="h-3 w-3" />}
								{playerName(id)}
							</span>
						))}
					</div>
				)}

				{iVote && (
					<Button
						className="w-full"
						variant={imReady ? "outline" : "default"}
						aria-pressed={imReady}
						onClick={() => ws.send({ type: "reviewReady", payload: {} })}
					>
						<Check className="h-4 w-4" />
						{imReady ? "Doch nicht fertig" : "Fertig"}
					</Button>
				)}

				{isHost ? (
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => ws.send({ type: "previousCategory", payload: {} })}
							disabled={isFirst}
						>
							<ChevronLeft className="h-4 w-4" />
							Zurück
						</Button>
						{isLast ? (
							<Button
								variant={iVote ? "outline" : "default"}
								className="flex-1"
								onClick={() => ws.send({ type: "finishReview", payload: {} })}
							>
								Bewertung abschließen
							</Button>
						) : (
							<Button
								variant={iVote ? "outline" : "default"}
								className="flex-1"
								onClick={() => ws.send({ type: "nextCategory", payload: {} })}
							>
								Weiter
								<ChevronRight className="h-4 w-4" />
							</Button>
						)}
					</div>
				) : (
					!iVote && (
						<p className="text-center text-sm text-muted-foreground">
							Warte auf den Host…
						</p>
					)
				)}
			</div>
		</div>
	);
}
