import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { joinCode, Navigate, usePath } from "@/lib/nav";
import {
	ArrowLeft,
	ArrowRight,
	Flame,
	Loader2,
	LogIn,
	Plus,
	ScanLine,
	User,
	WifiOff,
} from "lucide-react";
import { ws } from "@/lib/ws";
import { isTypingTarget } from "@/lib/utils";
import { consumeForcedLeave } from "@/lib/forcedLeave";
import type { LobbyCheckPayload } from "@/types/events";
import { useRoomStore } from "@/store/room";
import { useToastStore } from "@/store/toast";
import { Btn, CodeTiles, IconBtn, Mascot, Tiles } from "@/components/kit";
import { TopBar } from "@/components/Shell";
import { sound } from "@/lib/sound";
import { stats } from "@/lib/stats";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// The QR scanner pulls in the sizeable qr-scanner library (+ worker); load it
// only when the user actually opens the scan step so the initial paint is lean.
const QrScannerView = lazy(() =>
	import("@/components/QrScanner").then((m) => ({ default: m.QrScannerView })),
);
type Step = "start" | "createName" | "joinCode" | "joinName" | "scan";

// Human-readable reason why a lobby can't be joined, keyed by the server's
// checkLobby reason code. Shown inline at the code step before a name is asked.
const UNAVAILABLE_MESSAGES: Record<string, string> = {
	full: "Diese Lobby ist voll.",
	notFound: "Diese Lobby gibt es nicht.",
	invalidCode: "Ungültiger Lobbycode.",
	throttled: "Zu viele Versuche - bitte kurz warten.",
};

const preloadRoom = () => import("@/pages/Room");

export function Home() {
	// Home renders on both `/` (no code) and `/join/:code`.
	const path = usePath();
	const lobby = useRoomStore((s) => s.lobby);
	const addToast = useToastStore((s) => s.addToast);
	const [streak] = useState(stats.streak);
	// Counter of error toasts: a new *error* (validation or server error) means the
	// pending submit failed -> stop the spinner. Info toasts (e.g. a reconnect
	// notice) don't bump it, so they no longer end the spinner prematurely.
	const errorSeq = useToastStore((s) => s.errorSeq);

	// When Home mounts because the player was just pulled out of a lobby (kicked,
	// closed, left) the URL is still that lobby's /join/:code - but we must land on
	// the start screen, not re-run the deep-link join. Consume the one-shot flag
	// once per mount so a genuine external deep link still works.
	const forcedLeaveRef = useRef<boolean | null>(null);
	if (forcedLeaveRef.current === null)
		forcedLeaveRef.current = consumeForcedLeave();
	const skipDeepLink = forcedLeaveRef.current;

	const deepLinkCode = skipDeepLink
		? ""
		: (joinCode(path) ?? "")
				.toUpperCase()
				.replace(/[^A-Z0-9]/g, "")
				.slice(0, 6);

	const [name, setName] = useState("");
	const [code, setCode] = useState(deepLinkCode);
	// A deep link (/join/:code) prefills the code and lands on the code step so a
	// pre-join check can run first - an unavailable lobby (mid-game/full/unknown)
	// is surfaced there instead of only after the player typed a name.
	const [step, setStep] = useState<Step>(
		deepLinkCode.length === 6 ? "joinCode" : "start",
	);
	const [loading, setLoading] = useState(false);
	// Pre-join availability check (code/QR/deep-link) and its inline error.
	const [checking, setChecking] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	const [connected, setConnected] = useState(ws.status);
	// Debounced offline flag: only turns true after the connection has actually
	// been down for a moment, so a fast (re)connect right after a page reload
	// never flashes the "no connection" banner and shifts the layout.
	const [showOffline, setShowOffline] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// The code whose checkLobby reply we're currently awaiting (to ignore stale
	// replies when the user changed the code meanwhile).
	const pendingCode = useRef<string | null>(null);
	// Mirror of `step` readable inside the once-registered lobbyCheck handler, so
	// a late reply can be discarded when the user already left the join flow.
	const stepRef = useRef(step);
	stepRef.current = step;

	// Track live connection status so the user sees when the server is down.
	useEffect(() => ws.onStatusChange(setConnected), []);

	// Delay surfacing the offline banner: a genuinely-down server still shows it
	// (after ~1.2s), but a connection that establishes right after a reload never
	// flashes it. Reconnecting clears it immediately.
	useEffect(() => {
		if (connected) {
			setShowOffline(false);
			return;
		}
		const t = setTimeout(() => setShowOffline(true), 1200);
		return () => clearTimeout(t);
	}, [connected]);

	// Handle checkLobby replies and kick off the initial check for a deep link.
	// biome-ignore lint/correctness/useExhaustiveDependencies: register once on mount
	useEffect(() => {
		ws.on("lobbyCheck", onLobbyCheck);
		if (deepLinkCode.length === 6) checkCode(deepLinkCode);
		return () => {
			ws.off("lobbyCheck");
			if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
		};
	}, []);

	// Stop the loading spinner once a new error toast appears (validation or
	// server error) - not on unrelated info toasts.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run only on a new error toast
	useEffect(() => {
		setLoading(false);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
	}, [errorSeq]);

	// Clean up the pending timeout if the component unmounts.
	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	// Seed history so the browser back button walks the step flow like the in-app
	// "Zurück" button instead of leaving the page. A deep link (/join/:code) lands
	// on the code step, so we put a "start" entry beneath it - back then goes to
	// the start screen, matching the button. popstate restores the step stored in
	// each entry's state (same URL throughout, so the router doesn't re-route).
	useEffect(() => {
		window.history.replaceState({ homeStep: "start" }, "");
		if (stepRef.current !== "start") {
			window.history.pushState({ homeStep: stepRef.current }, "");
		}
		function onPop(e: PopStateEvent) {
			const next = (e.state as { homeStep?: Step } | null)?.homeStep;
			if (next && next !== stepRef.current) setStep(next);
		}
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);

	// Left arrow key steps back through the login flow (like the in-app
	// "Zurück" button). It is ignored while typing in a field, so the cursor
	// can still move left normally there.
	// biome-ignore lint/correctness/useExhaustiveDependencies: back() is stable; register once on mount
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key !== "ArrowLeft") return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (isTypingTarget(document.activeElement)) return;
			if (stepRef.current === "start") return;
			e.preventDefault();
			back();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// While on the join-name step, route server errors (e.g. "Name bereits
	// vergeben") to an inline message at the field instead of a toast - matching
	// the code step. Cleared when leaving the step.
	useEffect(() => {
		if (step !== "joinName") return;
		useToastStore.getState().setErrorSink((message) => {
			setJoinError(message);
			setLoading(false);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		});
		return () => useToastStore.getState().setErrorSink(null);
	}, [step]);

	// Already in a lobby (e.g. after a reconnect on reload, or once the server
	// confirms our create/join) -> the global handlers set the lobby state and we
	// navigate to the lobby's own /join/:code URL (so the address bar equals the
	// shareable join link). The redirect unmounts this screen.
	if (lobby) {
		return <Navigate to={`/join/${lobby.lobbyCode.toUpperCase()}`} />;
	}

	// Forward navigation pushes a real history entry (same URL) so the browser's
	// back button / gesture mirrors the in-app "Zurück" button. The step lives in
	// the history state; the popstate handler below restores it. `back()` simply
	// pops, so both paths share one code path.
	function goTo(next: Step) {
		window.history.pushState({ homeStep: next }, "");
		setStep(next);
	}

	function back() {
		window.history.back();
	}

	function armTimeout() {
		// Safety net: if the server never answers (e.g. backend down), don't hang
		// on "Verbinde…" forever - surface an error so the user can retry.
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			addToast("Keine Verbindung zum Server. Bitte erneut versuchen.");
			setLoading(false);
		}, 15000);
	}

	function submitCreate(e: React.FormEvent) {
		e.preventDefault();
		const trimmedName = name.trim();
		if (!trimmedName) return;
		setLoading(true);
		armTimeout();
		ws.send({ type: "createLobby", payload: { playerName: trimmedName } });
	}

	function onLobbyCheck(payload: LobbyCheckPayload) {
		// Ignore a reply for a code the user has since changed.
		if (payload.lobbyCode !== pendingCode.current) return;
		pendingCode.current = null;
		if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
		setChecking(false);
		// The user left the join flow before the (possibly slow) reply arrived ->
		// discard it instead of yanking them back into a step.
		if (stepRef.current !== "joinCode" && stepRef.current !== "scan") return;
		if (payload.available) {
			setJoinError(null);
			// Advancing from the code step is a forward move (push); coming from the
			// scan step we replace its entry so back from the name step lands on the
			// code step, not the reopened camera.
			if (stepRef.current === "scan") {
				window.history.replaceState({ homeStep: "joinName" }, "");
				setStep("joinName");
			} else {
				goTo("joinName");
			}
		} else {
			setJoinError(
				UNAVAILABLE_MESSAGES[payload.reason ?? ""] ?? "Beitritt nicht möglich.",
			);
			// Land back on the code step so the error sits next to the code field
			// (covers the QR and deep-link paths too). From scan, pop its history
			// entry; on the code step already, just stay.
			if (stepRef.current === "scan") back();
			else setStep("joinCode");
		}
	}

	// Ask the server whether `candidate` can be joined right now, before moving on
	// to the name step. Only advances on success; otherwise shows an inline error.
	function checkCode(candidate: string) {
		const c = candidate.trim();
		if (c.length !== 6) {
			setJoinError("Der Lobbycode muss 6 Zeichen lang sein.");
			setStep("joinCode");
			return;
		}
		setJoinError(null);
		setChecking(true);
		pendingCode.current = c;
		if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
		checkTimeoutRef.current = setTimeout(() => {
			pendingCode.current = null;
			setChecking(false);
			setJoinError("Keine Verbindung zum Server. Bitte erneut versuchen.");
		}, 15000);
		ws.send({ type: "checkLobby", payload: { lobbyCode: c } });
	}

	function submitJoinCode(e: React.FormEvent) {
		e.preventDefault();
		checkCode(code);
	}

	function submitJoinName(e: React.FormEvent) {
		e.preventDefault();
		const trimmedName = name.trim();
		if (!trimmedName) return;
		if (code.trim().length !== 6) {
			setJoinError("Der Lobbycode muss 6 Zeichen lang sein.");
			setStep("joinCode");
			return;
		}
		setJoinError(null);
		setLoading(true);
		armTimeout();
		ws.send({
			type: "joinLobby",
			payload: { playerName: trimmedName, lobbyCode: code.trim() },
		});
	}

	const ready = connected && !loading;
	const nameForm = (
		onSubmit: (e: React.FormEvent) => void,
		errorId?: string,
	) => (
		<form onSubmit={onSubmit}>
			<Tiles value={name} live max={40} className="name-tiles" />
			<label className={`field${joinError && errorId ? " bad" : ""}`}>
				<User />
				<input
					value={name}
					onChange={(e) => {
						setJoinError(null);
						setName(e.target.value);
						sound.key([...e.target.value].length);
					}}
					aria-label="Dein Name"
					placeholder="Name"
					maxLength={20}
					aria-invalid={errorId ? joinError != null : undefined}
					aria-describedby={joinError && errorId ? errorId : undefined}
					// biome-ignore lint/a11y/noAutofocus: each step focuses its only field
					autoFocus
					autoComplete="off"
					enterKeyHint="go"
				/>
			</label>
			{errorId && joinError && (
				<p id={errorId} role="alert" className="err">
					{joinError}
				</p>
			)}
			<div className="row">
				<IconBtn
					tip="Zurück"
					onClick={() => {
						setJoinError(null);
						back();
					}}
				>
					<ArrowLeft />
				</IconBtn>
				<Btn
					type="submit"
					kind="primary"
					aria-label="Los"
					data-tip="Los"
					disabled={!ready || !name.trim()}
				>
					{loading ? <Loader2 className="spin" /> : <ArrowRight />}
				</Btn>
			</div>
		</form>
	);

	return (
		<>
			<TopBar
				start={
					streak > 0 && (
						<span className="badge streak" data-tip="Tage in Folge">
							<Flame />
							{streak}
						</span>
					)
				}
			/>
			<section className="screen home">
				<div className="hero">
					<Mascot size="big" />
				</div>

				{step !== "start" && showOffline && (
					<p className="offline" role="status">
						<WifiOff /> Keine Verbindung…
					</p>
				)}

				{step === "start" && (
					<div className="choices">
						<Btn
							kind="primary"
							aria-label="Lobby erstellen"
							data-tip="Lobby erstellen"
							onPointerEnter={preloadRoom}
							onFocus={preloadRoom}
							onClick={() => goTo("createName")}
						>
							<Plus />
						</Btn>
						<Btn
							aria-label="Lobby beitreten"
							data-tip="Lobby beitreten"
							onPointerEnter={preloadRoom}
							onFocus={preloadRoom}
							onClick={() => {
								setCode("");
								setJoinError(null);
								goTo("joinCode");
							}}
						>
							<LogIn />
						</Btn>
					</div>
				)}

				{step === "scan" && (
					<ErrorBoundary
						fallback={() => (
							<p role="alert" className="err">
								QR-Scanner konnte nicht geladen werden.
							</p>
						)}
					>
						<Suspense
							fallback={<Loader2 className="spin" aria-label="Kamera lädt" />}
						>
							<QrScannerView
								onScan={(scanned) => {
									setCode(scanned);
									checkCode(scanned);
								}}
								onClose={back}
							/>
						</Suspense>
					</ErrorBoundary>
				)}

				{step === "createName" && nameForm(submitCreate)}

				{step === "joinCode" && (
					<form onSubmit={submitJoinCode}>
						<div className="code-row">
							<label className={`code-in${joinError ? " bad" : ""}`}>
								{Array.from({ length: 6 }, (_, i) => (
									<span
										// biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position
										key={i}
										className={
											i < code.length ? "on" : i === code.length ? "cur" : ""
										}
										style={
											{ "--c": `var(--t${(i % 5) + 1})` } as React.CSSProperties
										}
									>
										{code[i] ?? ""}
									</span>
								))}
								<input
									value={code}
									onChange={(e) => {
										setJoinError(null);
										const next = e.target.value
											.toUpperCase()
											.replace(/[^A-Z0-9]/g, "")
											.slice(0, 6);
										if (next.length > code.length) sound.slot(next.length);
										else if (next.length < code.length) sound.poof();
										setCode(next);
										if (next.length === 6) checkCode(next);
									}}
									aria-label="Lobbycode"
									aria-invalid={joinError != null}
									aria-describedby={joinError ? "code-error" : undefined}
									disabled={checking}
									autoCapitalize="characters"
									autoCorrect="off"
									spellCheck={false}
									maxLength={6}
									// biome-ignore lint/a11y/noAutofocus: each step focuses its only field
									autoFocus
									autoComplete="off"
									enterKeyHint="go"
								/>
							</label>
							<IconBtn
								tip="QR-Code scannen"
								onClick={() => goTo("scan")}
								disabled={checking || !connected}
							>
								<ScanLine />
							</IconBtn>
						</div>
						{joinError && (
							<p id="code-error" role="alert" className="err">
								{joinError}
							</p>
						)}
						<div className="row">
							<IconBtn tip="Zurück" onClick={back} disabled={checking}>
								<ArrowLeft />
							</IconBtn>
							<Btn
								type="submit"
								kind="primary"
								aria-label="Weiter"
								data-tip="Weiter"
								disabled={code.length !== 6 || checking || !connected}
							>
								{checking ? <Loader2 className="spin" /> : <ArrowRight />}
							</Btn>
						</div>
					</form>
				)}

				{step === "joinName" && (
					<>
						<CodeTiles code={code} small />
						{nameForm(submitJoinName, "join-name-error")}
					</>
				)}
			</section>
		</>
	);
}
