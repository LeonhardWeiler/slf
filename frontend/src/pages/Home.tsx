import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { joinCode, usePath } from "@/lib/nav";
import { ArrowLeft, Flame, Plus, LogIn, ScanLine } from "lucide-react";
import { stats } from "@/lib/stats";
import { ws } from "@/lib/ws";
import { isTypingTarget } from "@/lib/utils";
import { consumeForcedLeave } from "@/lib/forcedLeave";
import type { LobbyCheckPayload } from "@/types/events";
import { useToastStore } from "@/store/toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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

const UNAVAILABLE_MESSAGES: Record<string, string> = {
	full: "Diese Lobby ist voll.",
	notFound: "Diese Lobby gibt es nicht.",
	invalidCode: "Ungültiger Lobbycode.",
	throttled: "Zu viele Versuche - bitte kurz warten.",
};

const preloadRoom = () => import("@/pages/Room");

export function Home() {
	const path = usePath();
	const [streak] = useState(stats.streak);
	const addToast = useToastStore((s) => s.addToast);
	// Only error toasts bump errorSeq, so an info toast does not end the spinner.
	const errorSeq = useToastStore((s) => s.errorSeq);

	// After a forced leave the URL is still /join/:code; the one-shot flag skips the deep-link join.
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
	const [step, setStep] = useState<Step>(
		deepLinkCode.length === 6 ? "joinCode" : "start",
	);
	const [loading, setLoading] = useState(false);
	const [checking, setChecking] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	const [connected, setConnected] = useState(ws.status);
	const [showOffline, setShowOffline] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingCode = useRef<string | null>(null);
	const stepRef = useRef(step);
	stepRef.current = step;

	useEffect(() => ws.onStatusChange(setConnected), []);

	// Delayed so a reconnect right after a reload never flashes the offline banner.
	useEffect(() => {
		if (connected) {
			setShowOffline(false);
			return;
		}
		const t = setTimeout(() => setShowOffline(true), 1200);
		return () => clearTimeout(t);
	}, [connected]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: register once on mount
	useEffect(() => {
		ws.on("lobbyCheck", onLobbyCheck);
		if (deepLinkCode.length === 6) checkCode(deepLinkCode);
		return () => {
			ws.off("lobbyCheck");
			if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: run only on a new error toast
	useEffect(() => {
		setLoading(false);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
	}, [errorSeq]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	// A deep link lands on the code step, so seed a "start" entry beneath it for the back button.
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

	// Ignored while typing so the cursor still moves left in a field.
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

	useEffect(() => {
		if (step !== "joinName") return;
		useToastStore.getState().setErrorSink((message) => {
			setJoinError(message);
			setLoading(false);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		});
		return () => useToastStore.getState().setErrorSink(null);
	}, [step]);

	function goTo(next: Step) {
		window.history.pushState({ homeStep: next }, "");
		setStep(next);
	}

	function back() {
		window.history.back();
	}

	function armTimeout() {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			ws.drop("createLobby");
			ws.drop("joinLobby");
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
		if (payload.lobbyCode !== pendingCode.current) return;
		pendingCode.current = null;
		if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
		setChecking(false);
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
			if (stepRef.current === "scan") back();
			else setStep("joinCode");
		}
	}

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
			ws.drop("checkLobby");
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
					{streak > 0 && (
						<p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
							<Flame className="h-4 w-4 text-orange-500" />
							{streak} {streak === 1 ? "Tag" : "Tage"} in Folge
						</p>
					)}
				</div>

				{showOffline && (
					<div className="mx-auto flex max-w-[18rem] items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 sm:max-w-[22rem] dark:text-amber-300">
						<span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
						Keine Verbindung zum Server…
					</div>
				)}

				{step === "start" && (
					<div className="mx-auto max-w-[18rem] space-y-3 sm:max-w-[22rem]">
						<Button
							className="w-full"
							size="lg"
							onPointerEnter={preloadRoom}
							onFocus={preloadRoom}
							onClick={() => goTo("createName")}
						>
							<Plus className="h-4 w-4" />
							Lobby erstellen
						</Button>
						<Button
							variant="outline"
							className="w-full"
							size="lg"
							onPointerEnter={preloadRoom}
							onFocus={preloadRoom}
							onClick={() => {
								setCode("");
								setJoinError(null);
								goTo("joinCode");
							}}
						>
							<LogIn className="h-4 w-4" />
							Lobby beitreten
						</Button>
					</div>
				)}

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
											checkCode(scanned);
										}}
										onClose={back}
									/>
								</Suspense>
							</ErrorBoundary>
						</CardContent>
					</Card>
				)}

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
													.toUpperCase()
													.replace(/[^A-Z0-9]/g, "")
													.slice(0, 6),
											);
										}}
										aria-invalid={joinError != null}
										aria-describedby={joinError ? "code-error" : undefined}
										readOnly={checking}
										placeholder="6-stelliger Code"
										autoCapitalize="characters"
										autoCorrect="off"
										spellCheck={false}
										maxLength={6}
										autoFocus
										autoComplete="off"
										className="font-mono uppercase tracking-widest placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
									/>
									{joinError && (
										<p
											id="code-error"
											role="alert"
											className="text-sm text-destructive"
										>
											{joinError}
										</p>
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

				{step === "joinName" && (
					<Card>
						<CardHeader className="pb-4">
							<CardTitle className="text-base">Lobby beitreten</CardTitle>
							<CardDescription>
								Lobby {code.toUpperCase()} - gib deinen Namen ein.
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
										aria-describedby={joinError ? "join-name-error" : undefined}
										autoFocus
										autoComplete="off"
									/>
									{joinError && (
										<p
											id="join-name-error"
											role="alert"
											className="text-sm text-destructive"
										>
											{joinError}
										</p>
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
