import type { ReactNode } from "react";
import { DoorOpen } from "lucide-react";
import { navigate } from "@/lib/nav";
import { copyToClipboard } from "@/lib/clipboard";
import { floatText } from "@/lib/feel";
import { sound } from "@/lib/sound";
import { ws } from "@/lib/ws";
import { markForcedLeave } from "@/lib/forcedLeave";
import { useRoomStore, useIsHost } from "@/store/room";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { HostGraceBanner } from "@/components/HostGraceBanner";
import { useConfirm } from "@/components/ConfirmDialog";
import { CodeTiles, IconBtn } from "@/components/kit";
import { TopBar } from "@/components/Shell";

export function RoomHeader({
	children,
	noCode,
}: {
	children?: ReactNode;
	noCode?: boolean;
}) {
	const reset = useRoomStore((s) => s.reset);
	const code = useRoomStore((s) => s.lobby?.lobbyCode ?? "").toUpperCase();
	const setSelfLeaving = useRoomStore((s) => s.setSelfLeaving);
	const isHost = useIsHost();
	const playing = useRoomStore(
		(s) => !!s.lobby && !["Lobby", "GameOver"].includes(s.lobby.state),
	);
	const { confirm, dialog } = useConfirm();

	async function copyCode(el: HTMLElement) {
		const ok = await copyToClipboard(code);
		floatText(el, ok ? "✓" : "✗", ok ? "good" : "bad");
		if (ok) sound.pop();
	}

	async function handleLeave() {
		const confirmed = await confirm(
			isHost
				? {
						title: "Lobby schließen?",
						description: "Das Spiel endet für alle.",
						confirmLabel: "Schließen",
						destructive: true,
					}
				: {
						title: "Spiel verlassen?",
						confirmLabel: "Verlassen",
						destructive: true,
					},
		);
		if (!confirmed) return;
		setSelfLeaving(true);
		if (playing)
			ws.send({
				type: "track",
				payload: { ev: "leave", value: document.documentElement.dataset.world },
			});
		ws.send({ type: "leaveLobby", payload: {} });
		markForcedLeave();
		reset();
		navigate("/");
	}

	return (
		<TopBar
			start={
				<>
					<IconBtn
						tip={isHost ? "Lobby schließen" : "Verlassen"}
						onClick={handleLeave}
					>
						<DoorOpen />
					</IconBtn>
					<ConnectionBadge />
				</>
			}
		>
			{code && !noCode && (
				<button
					type="button"
					className="code-btn"
					data-tip="Code kopieren"
					aria-label={`Code ${code} kopieren`}
					onClick={(e) => copyCode(e.currentTarget)}
				>
					<CodeTiles code={code} small />
				</button>
			)}
			{children}
			<HostGraceBanner />
			{dialog}
		</TopBar>
	);
}
