import { useEffect, useRef } from "react";
import { navigate, usePath } from "@/lib/nav";
import { phaseReady, useRoomStore } from "@/store/room";
import { useLeave } from "@/components/useLeave";
import { Lobby } from "./Lobby";
import { GameScreen } from "./game/GameScreen";
import { ReviewScreen } from "./game/ReviewScreen";
import { RoundResultScreen } from "./game/RoundResultScreen";
import { GameOverScreen } from "./game/GameOverScreen";

// Room owns every path while a lobby is in the store: it moves a fresh room
// to /join/:code and treats a back step away from it as a leave.
export function Room() {
	// Only the phase, so Room does not re-render on other lobby changes.
	const state = useRoomStore((s) => s.lobby?.state ?? "Lobby");
	const code = useRoomStore((s) => s.lobby?.lobbyCode.toUpperCase());
	const ready = useRoomStore(phaseReady);
	const path = usePath();
	const prevPath = useRef<string | null>(null);
	const { leave, dialog } = useLeave();
	const roomPath = `/join/${code}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: leave is a fresh closure each render
	useEffect(() => {
		const prev = prevPath.current;
		prevPath.current = path;
		if (path === roomPath) return;
		if (prev !== roomPath) {
			navigate(roomPath, true);
			return;
		}
		void leave().then((left) => {
			if (!left) navigate(roomPath);
		});
	}, [path, roomPath]);

	if (!ready) {
		return (
			<div className="min-h-svh bg-background flex items-center justify-center">
				<p className="text-muted-foreground">Wird geladen…</p>
				{dialog}
			</div>
		);
	}

	return (
		<>
			{renderScreen(state)}
			{dialog}
		</>
	);
}

export function renderScreen(state: string) {
	switch (state) {
		case "Countdown":
		case "Playing":
			return <GameScreen />;
		case "Reviewing":
			return <ReviewScreen />;
		case "RoundResult":
			return <RoundResultScreen />;
		case "GameOver":
			return <GameOverScreen />;
		default:
			return <Lobby />;
	}
}
