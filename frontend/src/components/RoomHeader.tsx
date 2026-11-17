import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useRoomStore } from "@/store/room";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { HostGraceBanner } from "@/components/HostGraceBanner";
import { useLeave } from "@/components/useLeave";
import { Button } from "@/components/ui/button";

export function RoomHeader({ title }: { title: string }) {
	const lobby = useRoomStore((s) => s.lobby);
	const { leave, dialog } = useLeave();
	const [copied, setCopied] = useState(false);
	const [copyFailed, setCopyFailed] = useState(false);

	const code = (lobby?.lobbyCode ?? "").toUpperCase();

	async function copyCode() {
		if (!code) return;
		const ok = await copyToClipboard(code);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} else {
			setCopyFailed(true);
			setTimeout(() => setCopyFailed(false), 3000);
		}
	}

	return (
		<>
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0">
					<h1 className="text-2xl font-bold">{title}</h1>
					{code && (
						<button
							type="button"
							onClick={copyCode}
							title="Lobbycode kopieren"
							className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
						>
							<span className="font-mono font-medium uppercase tracking-wider">
								{code.replace(/(.{3})(.{3})/, "$1 $2")}
							</span>
							{copied ? (
								<Check className="h-3 w-3 text-green-600" />
							) : (
								<Copy className="h-3 w-3" />
							)}
							{copyFailed && (
								<span className="text-[10px]">(manuell markieren)</span>
							)}
						</button>
					)}
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<ConnectionBadge />
					<ThemeToggle />
					<Button variant="ghost" size="sm" onClick={leave}>
						Verlassen
					</Button>
				</div>
			</div>
			<HostGraceBanner />
			{dialog}
		</>
	);
}
