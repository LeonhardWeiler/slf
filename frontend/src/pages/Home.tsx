import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useParams, Navigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, LogIn, ScanLine } from "lucide-react";
import { ws } from "@/lib/ws";
import { isTypingTarget } from "@/lib/utils";
import { consumeForcedLeave } from "@/lib/forcedLeave";
import type { LobbyCheckPayload } from "@/types/events";
import { useLobbyStore } from "@/store/lobby";
import { useToastStore } from "@/store/toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// The QR scanner pulls in the sizeable qr-scanner library (+ worker); load it
// only when the user actually opens the scan step so the initial paint is lean.
const QrScannerView = lazy(() =>
	import("@/components/QrScanner").then((m) => ({ default: m.QrScannerView })),
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type Step = "start" | "createName" | "joinCode" | "joinName" | "scan";

// Human-readable reason why a lobby can't be joined, keyed by the server's
// checkLobby reason code. Shown inline at the code step before a name is asked.
const UNAVAILABLE_MESSAGES: Record<string, string> = {
	full: "Diese Lobby ist voll.",
	notFound: "Diese Lobby gibt es nicht.",
	invalidCode: "Ungültiger Lobbycode.",
	throttled: "Zu viele Versuche – bitte kurz warten.",
};

export function Home() {
	// Loose params: Home renders on both `/` (no param) and `/join/$code`.
	const params = useParams({ strict: false });
	const lobby = useLobbyStore((s) => s.lobby);
	const addToast = useToastStore((s) => s.addToast);
	// Counter of error toasts: a new *error* (validation or server error) means the
	// pending submit failed → stop the spinner. Info toasts (e.g. a reconnect
	// notice) don't bump it, so they no longer end the spinner prematurely.
	const errorSeq = useToastStore((s) => s.errorSeq);

	// When Home mounts because the player was just pulled out of a lobby (kicked,
	// closed, left) the URL is still that lobby's /join/:code — but we must land on
	// the start screen, not re-run the deep-link join. Consume the one-shot flag
	// once per mount so a genuine external deep link still works.
	const forcedLeaveRef = useRef<boolean | null>(null);
	if (forcedLeaveRef.current === null)
		forcedLeaveRef.current = consumeForcedLeave();
	const skipDeepLink = forcedLeaveRef.current;

	const deepLinkCode = skipDeepLink
		? ""
		: (params.code ?? "")
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
				.slice(0, 6);

	const [name, setName] = useState("");
	const [code, setCode] = useState(deepLinkCode);
	// A deep link (/join/:code) prefills the code and lands on the code step so a
	// pre-join check can run first — an unavailable lobby (mid-game/full/unknown)
	// is surfaced there instead of only after the player typed a name.
	const [step, setStep] = useState<Step>(
		deepLinkCode.length === 6 ? "joinCode" : "start",
	);
	const [loading, setLoading] = useState(false);
	// Pre-join availability check (code/QR/deep-link) and its inline error.
	const [checking, setChecking] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	const [connected, setConnected] = useState(ws.status);
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
	// server error) — not on unrelated info toasts.
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
	// on the code step, so we put a "start" entry beneath it — back then goes to
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
	// vergeben") to an inline message at the field instead of a toast — matching
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
	// confirms our create/join) → the global handlers set the lobby state and we
	// navigate to the lobby's own /join/:code URL (so the address bar equals the
	// shareable join link). The redirect unmounts this screen.
	if (lobby) {
		return (
			<Navigate to="/join/$code" params={{ code: lobby.lobbyCode }} replace />
		);
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
		// on "Verbinde…" forever — surface an error so the user can retry.
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			addToast("Keine Verbindung zum Server. Bitte erneut versuchen.");
			setLoading(false);
		}, 8000);
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
		// The user left the join flow before the (possibly slow) reply arrived →
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
		}, 8000);
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

	return (
		<div className="min-h-svh flex items-center justify-center screen-pad bg-background">
			<div className="absolute top-3 right-3">
				<ThemeToggle />
			</div>
			<div className="w-full max-w-sm space-y-4">
				<div className="text-center space-y-1">
					<h1 className="text-3xl font-bold tracking-tight">
						Stadt Land Fluss
					</h1>
				</div>

				{!connected && (
					<div className="flex items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
						<span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
						Keine Verbindung zum Server…
					</div>
				)}

				{/* ---- Step: start ---- */}
				{step === "start" && (
					// Slightly narrower and centered so the buttons do not take up the
					// full card width on mobile.
					<div className="mx-auto max-w-[16rem] space-y-3">
						<Button
							className="w-full"
							size="lg"
							disabled={!connected}
							onClick={() => goTo("createName")}
						>
							<Plus className="h-4 w-4" />
							Lobby erstellen
						</Button>
						<Button
							variant="outline"
							className="w-full"
							size="lg"
							disabled={!connected}
							onClick={() => goTo("joinCode")}
						>
							<LogIn className="h-4 w-4" />
							Lobby beitreten
						</Button>
					</div>
				)}

				{/* ---- Step: scan QR ---- */}
				{step === "scan" && (
					<Card>
						<CardHeader className="pb-1"></CardHeader>
						<CardContent>
							<ErrorBoundary
								fallback={() => (
									<p className="text-sm text-destructive">
										QR-Scanner konnte nicht geladen werden. Nutze stattdessen
										den Code.
									</p>
								)}
							>
								<Suspense
									fallback={
										<p
											aria-live="polite"
											className="text-sm text-muted-foreground"
										>
											Kamera wird geladen…
										</p>
									}
								>
									<QrScannerView
										onScan={(scanned) => {
											setCode(scanned);
											// Verify the scanned lobby is joinable before asking a name.
											checkCode(scanned);
										}}
										onClose={back}
									/>
								</Suspense>
							</ErrorBoundary>
						</CardContent>
					</Card>
				)}

				{/* ---- Step: create → name ---- */}
				{step === "createName" && (
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">Lobby erstellen</CardTitle>
						</CardHeader>
						<CardContent>
							<form onSubmit={submitCreate} className="space-y-4">
								<div className="space-y-2">
									<Input
										id="name"
										aria-label="Dein Name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Name eingeben…"
										maxLength={20}
										autoFocus
										autoComplete="off"
									/>
								</div>
								<div className="flex gap-2">
									<Button type="button" variant="outline" onClick={back}>
										<ArrowLeft className="h-4 w-4" />
										Zurück
									</Button>
									<Button
										type="submit"
										className="flex-1"
										disabled={loading || !name.trim() || !connected}
									>
										{loading ? "Verbinde…" : "Weiter"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				)}

				{/* ---- Step: join → code ---- */}
				{step === "joinCode" && (
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">Lobby beitreten</CardTitle>
						</CardHeader>
						<CardContent>
							<form onSubmit={submitJoinCode} className="space-y-4">
								<div className="space-y-2">
									<Input
										id="code"
										aria-label="Lobbycode"
										value={code}
										onChange={(e) => {
											setJoinError(null);
											setCode(
												e.target.value
													.toLowerCase()
													.replace(/[^a-z0-9]/g, "")
													.slice(0, 6),
											);
										}}
										aria-invalid={joinError != null}
										disabled={checking}
										placeholder="askzf6"
										autoCapitalize="characters"
										autoCorrect="off"
										spellCheck={false}
										maxLength={6}
										autoFocus
										autoComplete="off"
										className="font-mono uppercase tracking-widest"
									/>
									{joinError && (
										<p className="text-sm text-destructive">{joinError}</p>
									)}
								</div>

								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span className="h-px flex-1 bg-border" />
									oder
									<span className="h-px flex-1 bg-border" />
								</div>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => goTo("scan")}
									disabled={checking || !connected}
								>
									<ScanLine className="h-4 w-4" />
									QR-Code scannen
								</Button>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={back}
										disabled={checking}
									>
										<ArrowLeft className="h-4 w-4" />
										Zurück
									</Button>
									<Button
										type="submit"
										className="flex-1"
										disabled={
											code.trim().length !== 6 || checking || !connected
										}
									>
										{checking ? "Prüfe…" : "Weiter"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				)}

				{/* ---- Step: join → name ---- */}
				{step === "joinName" && (
					<Card>
						<CardHeader className="pb-4">
							<CardTitle className="text-base">Lobby beitreten</CardTitle>
							<CardDescription>
								Lobby {code.toUpperCase()} — gib deinen Namen ein.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={submitJoinName} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="join-name">Dein Name</Label>
									<Input
										id="join-name"
										value={name}
										onChange={(e) => {
											setJoinError(null);
											setName(e.target.value);
										}}
										placeholder="Name eingeben…"
										maxLength={20}
										aria-invalid={joinError != null}
										autoFocus
										autoComplete="off"
									/>
									{joinError && (
										<p className="text-sm text-destructive">{joinError}</p>
									)}
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setJoinError(null);
											back();
										}}
									>
										<ArrowLeft className="h-4 w-4" />
										Zurück
									</Button>
									<Button
										type="submit"
										className="flex-1"
										disabled={loading || !name.trim() || !connected}
									>
										{loading ? "Verbinde…" : "Beitreten"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
