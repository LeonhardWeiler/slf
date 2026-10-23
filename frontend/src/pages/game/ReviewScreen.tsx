import { useEffect, useState } from "react";
import { ws } from "@/lib/ws";
import {
	X,
	ChevronLeft,
	ChevronRight,
	Link2,
	Link2Off,
	Flame,
	Bell,
} from "lucide-react";
import { cn, isTypingTarget, pressProps } from "@/lib/utils";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { normalize, ruleIssue } from "@/lib/answerValidation";
import { RoomHeader } from "@/components/RoomHeader";
import { RoundLetter } from "@/components/RoundLetter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ReviewScreen() {
	const lobby = useLobbyStore((s) => s.lobby);
	const review = useGameStore((s) => s.review);

	// The answer picked as the merge target ("group anchor"). While set, the
	// host merges by clicking another answer's row directly (no second button).
	const [mergeAnchor, setMergeAnchor] = useState<string | null>(null);

	const isHost = useIsHost();
	const isFirst = (review?.categoryIndex ?? 0) <= 0;
	const isLast = review
		? review.categoryIndex >= review.categoryCount - 1
		: false;

	// Reset the pending merge selection whenever the reviewed category changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: categoryIndex is the intended trigger
	useEffect(() => {
		setMergeAnchor(null);
	}, [review?.categoryIndex]);

	// Host keyboard controls: arrows page through categories; Enter finishes the
	// review on the last category (otherwise advances), and cancels a pending
	// merge. Ending the game stays button-only.
	useEffect(() => {
		if (!isHost) return;
		function onKey(e: KeyboardEvent) {
			if (e.defaultPrevented || isTypingTarget(document.activeElement)) return;
			// Ignore auto-repeat: holding Enter/arrow would fire the action many
			// times. The first finishReview/nextCategory advances the server state,
			// so the repeats hit an invalid state -> spurious "Aktion nicht erlaubt".
			if (e.repeat) return;
			if (e.key === "ArrowLeft" && !isFirst) {
				ws.send({ type: "previousCategory", payload: {} });
			} else if (e.key === "ArrowRight" && !isLast) {
				ws.send({ type: "nextCategory", payload: {} });
			} else if (e.key === "Enter") {
				if (mergeAnchor !== null) {
					setMergeAnchor(null);
				} else if (isLast) {
					ws.send({ type: "finishReview", payload: {} });
				} else {
					ws.send({ type: "nextCategory", payload: {} });
				}
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isHost, isFirst, isLast, mergeAnchor]);

	if (!lobby || !review) {
		return (
			<div className="min-h-svh bg-background flex items-center justify-center">
				<p className="text-muted-foreground">Bewertung wird geladen…</p>
			</div>
		);
	}

	const playerName = (id: string) =>
		lobby.players.find((p) => p.id === id)?.name ?? "?";
	const categoryName =
		lobby.categories[review.categoryIndex]?.name ?? "Kategorie";
	// Everyone sees how the round ended.
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

	function setValid(answerId: string, valid: boolean) {
		ws.send({ type: "setAnswerValidity", payload: { answerId, valid } });
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

	// Merging needs at least 2 different valid answers.
	const canMerge =
		new Set(
			review.answers
				.filter((a) => a.valid && a.mergedInto === "")
				.map((a) => normalize(a.value)),
		).size >= 2;
	const mergeMode = mergeAnchor !== null;

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
						{review.answers.length === 0 && (
							<p className="text-sm text-muted-foreground">
								Keine Antworten in dieser Kategorie.
							</p>
						)}
						{review.answers.map((a) => {
							const merged = a.mergedInto !== "";
							const isAnchor = mergeAnchor === a.answerId;
							const clickable = mergeMode && !isAnchor && !merged;
							const toggles = isHost && !mergeMode && a.value !== "";
							const reason = !a.valid
								? ruleIssue(
										a.value,
										review.letter,
										lobby.settings.lastLetterMode,
									)
								: a.flamed
									? a.pointsPreview === 0
										? "Flamme verloren"
										: "Flamme +5"
									: undefined;
							return (
								<div
									key={a.answerId}
									className={cn(
										"rounded-md px-3 py-2.5 transition-colors",
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
										role={clickable ? "button" : toggles ? "switch" : undefined}
										aria-checked={toggles ? a.valid : undefined}
										{...(clickable
											? pressProps(() => mergeInto(a.answerId))
											: toggles
												? pressProps(() => setValid(a.answerId, !a.valid))
												: {})}
										className={cn((clickable || toggles) && "cursor-pointer")}
									>
										<div className="flex items-center justify-between gap-3">
											<div className="min-w-0">
												<span className="text-xs text-muted-foreground">
													{playerName(a.playerId)}
												</span>
												<div className="flex items-center gap-1.5">
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
													{a.flamed && (
														<span
															className="animate-flame shrink-0 text-orange-500"
															title="Flamme: Wette auf die einzige Antwort (+5 / 0)"
														>
															<Flame className="h-4 w-4 fill-orange-500" />
														</span>
													)}
												</div>
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
												<span
													className={cn(
														"text-lg font-bold tabular-nums w-8 text-right",
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

				{isHost ? (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								onClick={() =>
									ws.send({ type: "previousCategory", payload: {} })
								}
								disabled={isFirst}
							>
								<ChevronLeft className="h-4 w-4" />
								Zurück
							</Button>
							{isLast ? (
								<Button
									className="flex-1"
									onClick={() => ws.send({ type: "finishReview", payload: {} })}
								>
									Bewertung abschließen
								</Button>
							) : (
								<Button
									className="flex-1"
									onClick={() => ws.send({ type: "nextCategory", payload: {} })}
								>
									Weiter
									<ChevronRight className="h-4 w-4" />
								</Button>
							)}
						</div>
					</div>
				) : (
					<p className="text-center text-sm text-muted-foreground">
						Warte auf den Host…
					</p>
				)}
			</div>
		</div>
	);
}
