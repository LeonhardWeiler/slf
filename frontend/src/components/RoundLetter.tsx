import { cn } from "@/lib/utils";
import { useLobbyStore } from "@/store/lobby";

export function RoundLetter({
	letter,
	className,
}: {
	letter: string;
	className: string;
}) {
	const lastLetter = useLobbyStore((s) => s.lobby?.settings.lastLetterMode);
	return (
		<div className="flex items-baseline gap-3">
			<span className={cn("font-black leading-none", className)}>{letter}</span>
			{lastLetter && (
				<span className="text-muted-foreground">endet auf {letter}</span>
			)}
		</div>
	);
}
