import { cn } from "@/lib/utils";
import { useRoomStore } from "@/store/room";

export function RoundLetter({
	letter,
	className,
}: {
	letter: string;
	className: string;
}) {
	const lastLetter = useRoomStore((s) => s.lobby?.settings.lastLetterMode);
	return (
		<div className="flex items-baseline gap-3">
			<span className={cn("font-black", className)}>{letter}</span>
			{lastLetter && (
				<span className="text-muted-foreground">endet auf {letter}</span>
			)}
		</div>
	);
}
