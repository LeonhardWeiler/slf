import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
	Check,
	Crown,
	Hourglass,
	Link as LinkIcon,
	Eye,
	Play,
	Plus,
	QrCode as QrCodeIcon,
	Share2,
	Star,
	Timer,
	X,
	Zap,
} from "lucide-react";
import { Navigate } from "@/lib/nav";
import type { Player, Settings } from "@/types/events";
import { ws } from "@/lib/ws";
import { isTypingTarget } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { bounce, floatText, haptic } from "@/lib/feel";
import { fx } from "@/lib/fx";
import { sound } from "@/lib/sound";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useConfirm } from "@/components/ConfirmDialog";
import { isModalOpen, Modal } from "@/components/Modal";
import { RoomHeader } from "@/components/RoomHeader";
import {
	Av,
	Btn,
	CodeTiles,
	IconBtn,
	mood,
	Seg,
	Slider,
	Toggle,
} from "@/components/kit";
import { useRoomStore, useIsHost } from "@/store/room";

const QrCode = lazy(() =>
	import("@/components/QrCode").then((m) => ({ default: m.QrCode })),
);

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const RARE = ["C", "J", "Q", "X", "Y"];
const TIME_STEPS: (number | null)[] = [30, 60, 90, 120, 180, null];
const SPRINT_STEPS: (number | null)[] = [45, 75, null];

// Keeps players briefly rendered after they leave so the row can fade out
// instead of snapping away. Present players carry fresh data (name/connection
// stay live); a departed player lingers with its last-known data and
// `leaving: true` until the exit animation has had time to play.
const PLAYER_EXIT_MS = 140;
function usePlayerPresence(
	players: Player[],
): { player: Player; leaving: boolean }[] {
	const [leavingIds, setLeavingIds] = useState<string[]>([]);
	const prevIdsRef = useRef<string[]>(players.map((p) => p.id));
	const lastByIdRef = useRef<Map<string, Player>>(new Map());

	// Remember the latest data for every present player, so a row that starts
	// leaving still has a name to show on the way out.
	for (const p of players) lastByIdRef.current.set(p.id, p);

	useEffect(() => {
		const curIds = players.map((p) => p.id);
		const prev = prevIdsRef.current;
		// Only react to added/removed ids, not to reorders or field updates - those
		// would otherwise re-run this effect on every render and loop via setState.
		const same =
			curIds.length === prev.length && curIds.every((id, i) => id === prev[i]);
		if (same) return;
		prevIdsRef.current = curIds;
		const curSet = new Set(curIds);
		// A re-appeared player (reconnect within the exit window) drops its leaving flag.
		setLeavingIds((l) => l.filter((id) => !curSet.has(id)));
		const gone = prev.filter((id) => !curSet.has(id));
		if (gone.length === 0) return;
		setLeavingIds((l) => Array.from(new Set([...l, ...gone])));
		const t = setTimeout(() => {
			setLeavingIds((l) => l.filter((id) => !gone.includes(id)));
			for (const id of gone) lastByIdRef.current.delete(id);
		}, PLAYER_EXIT_MS);
		return () => clearTimeout(t);
	}, [players]);

	const presentIds = new Set(players.map((p) => p.id));
	const list = players.map((p) => ({ player: p, leaving: false }));
	for (const id of leavingIds) {
		if (presentIds.has(id)) continue;
		const p = lastByIdRef.current.get(id);
		if (p) list.push({ player: p, leaving: true });
	}
	return list;
}

export function Lobby() {
	const lobby = useRoomStore((s) => s.lobby);
	const myPlayerId = useRoomStore((s) => s.myPlayerId);
	const isHost = useIsHost();
	const { confirm, dialog } = useConfirm();
	const [newCategory, setNewCategory] = useState<string | null>(null);
	const [showQr, setShowQr] = useState(false);
	const [showLetters, setShowLetters] = useState(false);
	const [startHint, setStartHint] = useState(false);
	const seen = useRef<Set<string> | null>(null);

	const lobbyCode = (lobby?.lobbyCode ?? "").toUpperCase();
	const joinLink = lobby ? `${window.location.origin}/join/${lobbyCode}` : "";
	const canShare = typeof navigator.share === "function";

	async function copyLink(el: Element | null) {
		const ok = await copyToClipboard(joinLink);
		floatText(el, ok ? "✓" : "✗");
		if (ok) sound.pop();
	}

	async function shareLink(el: Element | null) {
		if (!canShare) return copyLink(el);
		try {
			await navigator.share({ url: joinLink });
		} catch {
			/* dismissed */
		}
	}

	useEffect(() => {
		function onCopy(e: KeyboardEvent) {
			if (!(e.key === "c" && (e.ctrlKey || e.metaKey))) return;
			if (isTypingTarget(document.activeElement)) return;
			if (isModalOpen()) return;
			if ((window.getSelection()?.toString() ?? "") !== "") return;
			void copyToClipboard(lobbyCode).then((ok) => ok && sound.pop());
		}
		window.addEventListener("keydown", onCopy);
		return () => window.removeEventListener("keydown", onCopy);
	}, [lobbyCode]);

	const activePlayers = (lobby?.players ?? []).filter((p) => !p.left);
	const playerRank = (p: Player) =>
		p.id === myPlayerId ? 0 : p.isHost ? 1 : 2;
	const playerRows = usePlayerPresence(activePlayers).sort(
		(a, b) =>
			playerRank(a.player) - playerRank(b.player) ||
			a.player.name.localeCompare(b.player.name, "de"),
	);

	// A seat that appears after the first render pops in with confetti.
	const ids = activePlayers.map((p) => p.id).join();
	useEffect(() => {
		const now = new Set(ids.split(","));
		if (seen.current) {
			for (const id of now) {
				if (seen.current.has(id)) continue;
				const el = document.querySelector(`[data-seat="${id}"]`);
				fx.at(el, { n: 14, speed: 5 });
				sound.pop();
				haptic(10);
				mood("cheer", 900);
			}
		}
		seen.current = now;
	}, [ids]);

	if (!lobby) {
		return <Navigate to="/" />;
	}

	function addCategory(next: string | null) {
		const name = newCategory?.trim();
		if (name) {
			ws.send({ type: "addCategory", payload: { name } });
			sound.word(1);
		}
		setNewCategory(next);
	}

	function saveCategory(id: string, before: string, input: HTMLInputElement) {
		const name = input.value.trim();
		if (name && name !== before)
			ws.send({ type: "editCategory", payload: { categoryId: id, name } });
		else input.value = before;
	}

	async function kickPlayer(id: string, name: string, el: Element | null) {
		if (
			await confirm({
				title: `${name} entfernen?`,
				confirmLabel: "Entfernen",
				destructive: true,
			})
		) {
			fx.at(el, { n: 16, speed: 6 });
			sound.crunch();
			ws.send({ type: "kickPlayer", payload: { playerId: id } });
		}
	}

	function updateSettings(patch: Partial<Settings>) {
		const s = lobby!.settings;
		ws.send({
			type: "updateSettings",
			payload: {
				timeLimit:
					patch.timeLimit !== undefined ? patch.timeLimit : s.timeLimit,
				excludedLetters: patch.excludedLetters ?? s.excludedLetters,
				hostPlays: patch.hostPlays ?? s.hostPlays,
				lastLetterMode: patch.lastLetterMode ?? s.lastLetterMode,
				sprint: patch.sprint ?? s.sprint,
			},
		});
	}

	function toggleLetter(letter: string) {
		const excluded = new Set(lobby!.settings.excludedLetters);
		if (excluded.has(letter)) excluded.delete(letter);
		else excluded.add(letter);
		updateSettings({ excludedLetters: [...excluded] });
	}

	const s = lobby.settings;
	const playingCount = activePlayers.filter(
		(p) => p.connected && (!p.isHost || s.hostPlays),
	).length;
	const canStart = isHost && playingCount >= 1 && lobby.categories.length >= 1;

	return (
		<>
			<RoomHeader noCode />
			<section className="screen lobby">
				<div className="room">
					<CodeTiles code={lobbyCode} />
					<IconBtn
						tip="Link kopieren"
						onClick={(e) => copyLink(e.currentTarget)}
					>
						<LinkIcon />
					</IconBtn>
					<IconBtn tip="QR-Code" onClick={() => setShowQr(true)}>
						<QrCodeIcon />
					</IconBtn>
				</div>

				<div className="seats">
					{playerRows.map(({ player, leaving }) => (
						<div
							key={player.id}
							data-seat={player.id}
							className={`seat${leaving ? " leaving" : ""}${player.connected ? "" : " off"}${player.id === myPlayerId ? " me" : ""}`}
						>
							<Av id={player.id} name={player.name} size="big" tip={false}>
								{player.id === myPlayerId ? <Star /> : undefined}
							</Av>
							{player.isHost && (
								<span className="seat-crown">
									<Crown />
								</span>
							)}
							<span className="seat-name">{player.name}</span>
							{isHost && player.id !== myPlayerId && !leaving && (
								<button
									type="button"
									className="kick"
									aria-label={`${player.name} entfernen`}
									data-tip="Entfernen"
									onClick={(e) =>
										kickPlayer(
											player.id,
											player.name,
											e.currentTarget.parentElement,
										)
									}
								>
									<X />
								</button>
							)}
						</div>
					))}
				</div>

				<div className={`panel${isHost ? "" : " locked"}`} inert={!isHost}>
					<div className="cats-edit">
						{lobby.categories.map((cat) => (
							<span key={cat.id} className="cat-chip">
								<input
									defaultValue={cat.name}
									key={cat.name}
									maxLength={30}
									spellCheck={false}
									aria-label={`Kategorie ${cat.name}`}
									onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
									onBlur={(e) => saveCategory(cat.id, cat.name, e.target)}
								/>
								{lobby.categories.length > 1 && (
									<button
										type="button"
										className="chip-x"
										aria-label={`${cat.name} löschen`}
										onClick={(e) => {
											fx.at(e.currentTarget.parentElement, { n: 8, speed: 4 });
											sound.poof();
											ws.send({
												type: "deleteCategory",
												payload: { categoryId: cat.id },
											});
										}}
									>
										<X />
									</button>
								)}
							</span>
						))}
						{newCategory === null ? (
							<button
								type="button"
								className="cat-chip add"
								aria-label="Kategorie hinzufügen"
								data-tip="Kategorie hinzufügen"
								onClick={() => setNewCategory("")}
							>
								<Plus />
							</button>
						) : (
							<form
								className="cat-chip"
								onSubmit={(e) => {
									e.preventDefault();
									addCategory("");
								}}
							>
								<input
									value={newCategory}
									onChange={(e) => setNewCategory(e.target.value)}
									onBlur={() => addCategory(null)}
									maxLength={30}
									aria-label="Neue Kategorie"
									spellCheck={false}
									enterKeyHint="done"
									// biome-ignore lint/a11y/noAutofocus: opened by the + button
									autoFocus
								/>
							</form>
						)}
					</div>

					<div className="pref" data-tip="Zeitlimit pro Runde">
						<Timer />
						<Slider
							steps={s.sprint ? SPRINT_STEPS : TIME_STEPS}
							value={s.timeLimit}
							label="Zeitlimit"
							format={(v) => (v === null ? "∞" : `${v}s`)}
							onChange={(timeLimit) => updateSettings({ timeLimit })}
						/>
					</div>

					<div className="modes">
						<Toggle
							on={s.sprint}
							tip="Sprint: eine Runde, ein Wort nach dem anderen"
							onChange={(sprint) =>
								updateSettings({ sprint, timeLimit: sprint ? 45 : null })
							}
						>
							<Zap />
						</Toggle>
						<Toggle
							on={!s.hostPlays}
							tip="Host kommentiert nur: du spielst nicht mit und siehst live, wer was ausgefüllt hat"
							onChange={(v) => updateSettings({ hostPlays: !v })}
						>
							<Eye />
						</Toggle>
						<Toggle
							on={s.lastLetterMode}
							tip="Letzter Buchstabe: Antworten müssen mit dem Buchstaben enden statt beginnen"
							onChange={(lastLetterMode) => updateSettings({ lastLetterMode })}
						>
							<b>…A</b>
						</Toggle>
						<button
							type="button"
							className="toggle"
							aria-pressed={s.excludedLetters.length > 0}
							data-tip="Buchstaben auswählen, die gezogen werden können"
							aria-label="Buchstaben auswählen"
							onClick={() => setShowLetters(true)}
						>
							<b>
								{s.excludedLetters.length
									? ALPHABET.length - s.excludedLetters.length
									: "A–Z"}
							</b>
						</button>
					</div>
				</div>

				{isHost ? (
					<>
						<Btn
							kind="primary"
							className="go"
							aria-label="Spiel starten"
							data-tip="Spiel starten"
							aria-disabled={!canStart}
							onClick={() => {
								if (!canStart) {
									setStartHint(true);
									mood("worried");
									return;
								}
								ws.send({ type: "startGame", payload: {} });
							}}
						>
							<Play />
						</Btn>
						{startHint && !canStart && (
							<p className="hint" role="status">
								{!s.hostPlays && playingCount < 1
									? "Als Kommentator brauchst du mindestens 1 Mitspieler."
									: "Mindestens 1 Spieler und 1 Kategorie nötig."}
							</p>
						)}
					</>
				) : (
					<p className="hint wait" data-tip="Warte auf den Host">
						<Hourglass />
					</p>
				)}
			</section>

			{showQr && (
				<Modal
					role="dialog"
					labelledBy="qr-title"
					onClose={() => setShowQr(false)}
				>
					<h2 id="qr-title" className="sr-only">
						Zum Beitreten scannen
					</h2>
					<ErrorBoundary
						fallback={() => (
							<p className="err">QR-Code konnte nicht geladen werden.</p>
						)}
					>
						<Suspense fallback={<div className="qr" />}>
							<QrCode value={joinLink} />
						</Suspense>
					</ErrorBoundary>
					<CodeTiles code={lobbyCode} small />
					<div className="row">
						{canShare && (
							<IconBtn tip="Teilen" onClick={(e) => shareLink(e.currentTarget)}>
								<Share2 />
							</IconBtn>
						)}
						<Btn
							kind="primary"
							aria-label="Schließen"
							onClick={() => setShowQr(false)}
						>
							<Check />
						</Btn>
					</div>
				</Modal>
			)}
			{showLetters && (
				<Modal
					role="dialog"
					labelledBy="letters-title"
					onClose={() => setShowLetters(false)}
					bottom
				>
					<h2 id="letters-title" className="sr-only">
						Buchstaben
					</h2>
					<Seg
						label="Auswahl"
						value={
							!s.excludedLetters.length
								? "all"
								: s.excludedLetters.length === RARE.length &&
										RARE.every((l) => s.excludedLetters.includes(l))
									? "common"
									: ""
						}
						onChange={(v) =>
							updateSettings({ excludedLetters: v === "all" ? [] : RARE })
						}
						options={[
							{ v: "all", label: "A–Z", tip: "Alle Buchstaben" },
							{
								v: "common",
								label: "–CJQXY",
								tip: "Ohne seltene Buchstaben C, J, Q, X, Y",
							},
						]}
					/>
					{/* biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons */}
					<div
						className="letters"
						role="group"
						aria-label="Buchstaben"
						data-tip="Buchstaben, die gezogen werden können"
					>
						{ALPHABET.map((letter) => (
							<button
								key={letter}
								type="button"
								className="lt"
								aria-pressed={!s.excludedLetters.includes(letter)}
								onClick={(e) => {
									toggleLetter(letter);
									bounce(e.currentTarget, 1.2);
								}}
							>
								{letter}
							</button>
						))}
					</div>
					<Btn
						kind="primary"
						aria-label="Fertig"
						onClick={() => setShowLetters(false)}
					>
						<Check />
					</Btn>
				</Modal>
			)}
			{dialog}
		</>
	);
}
