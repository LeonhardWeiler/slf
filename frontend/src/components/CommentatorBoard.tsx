import type { Category, CommentatorStatePayload, Player } from "@/types/events";
import { Av, playerColor } from "@/components/kit";

interface Props {
	categories: Category[];
	players: Player[];
	commentator: CommentatorStatePayload | null;
}

export function CommentatorBoard({ categories, players, commentator }: Props) {
	const rows = new Map(
		(commentator?.players ?? []).map((p) => [p.playerId, p]),
	);
	return (
		<div className="board">
			{players.map((player) => {
				const row = rows.get(player.id);
				const filled = new Set(row?.filledCategoryIds);
				return (
					<div
						key={player.id}
						className={`board-row${row?.complete ? " done" : ""}${player.connected ? "" : " off"}`}
						style={{ "--pc": playerColor(player.id) } as React.CSSProperties}
					>
						<Av id={player.id} name={player.name} />
						{categories.map((cat) => (
							<span
								key={cat.id}
								className={`cell${filled.has(cat.id) ? " on" : ""}`}
								data-tip={cat.name}
							>
								{[...cat.name][0]}
							</span>
						))}
					</div>
				);
			})}
		</div>
	);
}
