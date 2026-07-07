import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category, CommentatorStatePayload, Player } from "@/types/events";
import { Button } from "@/components/ui/button";

interface Props {
  categories: Category[];
  players: Player[];
  commentator: CommentatorStatePayload | null;
  // When set, the host can remove a player straight from the table (a mid-game
  // kick keeps them in the standings marked "(verlassen)").
  onKick?: (playerId: string, name: string) => void;
}

// Beamer/commentator overview: a matrix of players × categories showing only
// *whether* a field has been filled (a check), never the answer itself.
export function CommentatorBoard({ categories, players, commentator, onKick }: Props) {
  const filledByPlayer = new Map<string, Set<string>>();
  const completeByPlayer = new Map<string, boolean>();
  for (const p of commentator?.players ?? []) {
    filledByPlayer.set(p.playerId, new Set(p.filledCategoryIds));
    completeByPlayer.set(p.playerId, p.complete);
  }

  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Mitspieler.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium px-2 py-1">Spieler</th>
            {categories.map((cat) => (
              <th
                key={cat.id}
                className="font-medium px-2 py-1 text-center whitespace-nowrap"
              >
                {cat.name}
              </th>
            ))}
            <th className="font-medium px-2 py-1 text-right">Fertig</th>
            {onKick && <th className="w-8 px-1 py-1" aria-label="Entfernen" />}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const filled = filledByPlayer.get(player.id) ?? new Set<string>();
            const complete = completeByPlayer.get(player.id) ?? false;
            const count = filled.size;
            return (
              <tr
                key={player.id}
                className={cn(
                  "rounded-md",
                  complete ? "bg-green-500/10" : "bg-muted/50"
                )}
              >
                <td className="px-2 py-2 font-medium rounded-l-md whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        player.connected ? "bg-green-500" : "bg-muted-foreground"
                      )}
                    />
                    {player.name}
                  </span>
                </td>
                {categories.map((cat) => {
                  const done = filled.has(cat.id);
                  return (
                    <td key={cat.id} className="px-2 py-2 text-center">
                      {done ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-500 inline" />
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </td>
                  );
                })}
                <td
                  className={cn(
                    "px-2 py-2 text-right tabular-nums",
                    !onKick && "rounded-r-md"
                  )}
                >
                  <span className={complete ? "text-green-600 font-semibold" : ""}>
                    {count}/{categories.length}
                  </span>
                </td>
                {onKick && (
                  <td className="px-1 py-2 text-right rounded-r-md">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title={`${player.name} entfernen`}
                      onClick={() => onKick(player.id, player.name)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
