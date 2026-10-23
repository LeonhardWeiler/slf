import { useEffect, useState } from "react";
import { ArrowRight, Flag, Star } from "lucide-react";
import { ws } from "@/lib/ws";
import { sound } from "@/lib/sound";
import { handlesEnter } from "@/lib/utils";
import { useRoomStore } from "@/store/room";
import { RoomHeader } from "@/components/RoomHeader";
import { CountUp } from "@/components/CountUp";
import { useConfirm } from "@/components/ConfirmDialog";
import { isModalOpen } from "@/components/Modal";
import { Btn, IconBtn, Mascot, Tiles } from "@/components/kit";

export function SoloReviewScreen() {
	const lobby = useRoomStore((s) => s.lobby);
	const myPlayerId = useRoomStore((s) => s.myPlayerId);
	const review = useRoomStore((s) => s.review);
	const lettersLeft = useRoomStore((s) => s.game?.remainingLetters.length);
	const { confirm, dialog } = useConfirm();
	const [shown, setShown] = useState(0);
	const n = review?.solo?.length ?? 0;

	// biome-ignore lint/correctness/useExhaustiveDependencies: deal once per round
	useEffect(() => {
		let k = 0;
		const id = setInterval(() => {
			k++;
			setShown(k);
			sound.flip();
			if (k >= n) clearInterval(id);
		}, 160);
		return () => clearInterval(id);
	}, [review?.roundId]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (
				e.defaultPrevented ||
				handlesEnter(document.activeElement) ||
				isModalOpen()
			)
				return;
			if (e.repeat) return;
			if (e.key === "Enter") ws.send({ type: "finishReview", payload: {} });
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	if (!lobby || !review?.solo) return null;

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
		<>
			<RoomHeader>
				<IconBtn tip="Spiel beenden" onClick={handleEndGame}>
					<Flag />
				</IconBtn>
			</RoomHeader>
			<section className="screen solo-review">
				<div className="solo-bar">
					<Mascot
						size="letter"
						letter={review.letter}
						base={roundPoints > 0 ? "happy" : "sad"}
					/>
					<b>
						+<CountUp value={roundPoints} />
					</b>
					<span className="solo-total" data-tip="Gesamt">
						<Star />
						<CountUp value={total} />
					</span>
				</div>
				<div className="solo-list">
					{rows.map((r, i) => (
						<button
							key={r.categoryId}
							type="button"
							className={`solo-row${i < shown ? " in" : ""}${r.valid ? "" : " cracked"}`}
							role="switch"
							aria-checked={r.valid}
							aria-label={`${categoryName(r.categoryId)}: ${r.value || "leer"}`}
							data-tip={
								r.value
									? r.valid
										? "Antippen: gilt nicht"
										: "Antippen: gilt"
									: categoryName(r.categoryId)
							}
							disabled={!r.value}
							onClick={() => setValid(r.categoryId, !r.valid)}
						>
							<span className="ans-word">
								<small>{categoryName(r.categoryId)}</small>
								{r.value ? (
									<Tiles
										value={r.value}
										letter={review.letter}
										last={lobby.settings.lastLetterMode}
										max={26}
									/>
								) : (
									<span className="empty">–</span>
								)}
							</span>
							<span className="pts">{r.points}</span>
						</button>
					))}
				</div>
				<Btn
					kind="next"
					aria-label={lettersLeft === 0 ? "Spiel abschließen" : "Nächste Runde"}
					data-tip={lettersLeft === 0 ? "Spiel abschließen" : "Nächste Runde"}
					onClick={() => ws.send({ type: "finishReview", payload: {} })}
				>
					{lettersLeft === 0 ? <Flag /> : <ArrowRight />}
				</Btn>
			</section>
			{dialog}
		</>
	);
}
