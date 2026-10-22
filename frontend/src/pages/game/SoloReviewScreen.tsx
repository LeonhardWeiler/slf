import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { ws } from "@/lib/ws";
import { cn, isTypingTarget } from "@/lib/utils";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { RoomHeader } from "@/components/RoomHeader";
import { CountUp } from "@/components/CountUp";
import { useConfirm } from "@/components/ConfirmDialog";
import { isModalOpen } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SoloReviewScreen() {
	const lobby = useLobbyStore((s) => s.lobby);
	const myPlayerId = useLobbyStore((s) => s.myPlayerId);
	const review = useGameStore((s) => s.review);
	const lettersLeft = useGameStore((s) => s.game?.remainingLetters.length);
	const { confirm, dialog } = useConfirm();

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (isTypingTarget(document.activeElement) || isModalOpen()) return;
			if (e.repeat) return;
			if (e.key === "Enter") ws.send({ type: "finishReview", payload: {} });
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	if (!lobby || !review?.solo) {
		return (
			<div className="min-h-svh bg-background flex items-center justify-center">
				<p className="text-muted-foreground">Bewertung wird geladen…</p>
			</div>
		);
	}

	const rows = review.solo;
	const roundPoints = rows.reduce((sum, r) => sum + r.points, 0);
	const total =
		(lobby.players.find((p) => p.id === myPlayerId)?.score ?? 0) + roundPoints;
	const categoryName = (id: string) =>
		lobby.categories.find((c) => c.id === id)?.name ?? "Kategorie";

	function setValid(categoryId: string, valid: boolean) {
		if (!myPlayerId) return;
		ws.send({
			type: "setAnswerValidity",
			payload: { answerId: myPlayerId, valid, categoryId },
		});
	}

	async function handleEndGame() {
		if (
			await confirm({
				title: "Spiel beenden?",
				description: "Diese Runde zählt noch, danach siehst du deine Punkte.",
				confirmLabel: "Spiel beenden",
				destructive: true,
			})
		) {
			ws.send({ type: "endGame", payload: {} });
		}
	}

	return (
		<div className="min-h-svh bg-background screen-pad">
			<div className="mx-auto w-full max-w-5xl space-y-4">
				<RoomHeader title="Auswertung" />

				<div className="sticky top-0 z-10 -mx-1 flex items-center justify-between rounded-lg border bg-background/90 px-4 py-3 shadow-sm backdrop-blur">
					<p className="text-4xl font-black leading-none">{review.letter}</p>
					<div className="flex items-end gap-6 text-right">
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-widest">
								Runde
							</p>
							<CountUp
								value={roundPoints}
								className="text-2xl font-bold tabular-nums text-green-600"
							/>
						</div>
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-widest">
								Gesamt
							</p>
							<CountUp
								value={total}
								className="text-2xl font-bold tabular-nums"
							/>
						</div>
					</div>
				</div>

				<Card>
					<CardContent className="pt-6 space-y-2">
						{rows.map((r) => (
							<div
								key={r.categoryId}
								className={cn(
									"flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors",
									r.valid ? "bg-green-500/10" : "bg-muted/50",
								)}
							>
								<div className="min-w-0">
									<p className="text-xs text-muted-foreground">
										{categoryName(r.categoryId)}
									</p>
									<p
										className={cn(
											"text-lg font-medium truncate",
											r.valid
												? "text-foreground"
												: "line-through text-muted-foreground",
										)}
									>
										{r.value || "-"}
									</p>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<span
										className={cn(
											"text-lg font-bold tabular-nums w-8 text-right",
											!r.valid && "text-muted-foreground",
										)}
									>
										{r.points}
									</span>
									{r.value && (
										<>
											<Button
												variant={r.valid ? "default" : "outline"}
												size="sm"
												aria-pressed={r.valid}
												onClick={() => setValid(r.categoryId, true)}
											>
												<Check className="h-4 w-4" />
												Ja
											</Button>
											<Button
												variant={r.valid ? "outline" : "destructive"}
												size="sm"
												aria-pressed={!r.valid}
												onClick={() => setValid(r.categoryId, false)}
											>
												<X className="h-4 w-4" />
												Nein
											</Button>
										</>
									)}
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				<div className="flex flex-col-reverse gap-2 sm:flex-row">
					<Button
						variant="outline"
						className="sm:flex-1"
						onClick={handleEndGame}
					>
						Spiel beenden
					</Button>
					<Button
						className="sm:flex-1"
						size="lg"
						onClick={() => ws.send({ type: "finishReview", payload: {} })}
					>
						{lettersLeft === 0 ? "Spiel abschließen" : "Nächste Runde"}
					</Button>
				</div>
			</div>
			{dialog}
		</div>
	);
}
