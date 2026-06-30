const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Shows the full alphabet with already-played letters and host-disabled letters
// greyed out, so players can see which letters are still in play.
export function LetterOverview({
  used,
  excluded,
}: {
  used: Set<string>;
  excluded: Set<string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {ALPHABET.map((letter) => {
        const isUsed = used.has(letter);
        const isExcluded = excluded.has(letter);
        return (
          <span
            key={letter}
            title={
              isExcluded
                ? "Nicht im Spiel"
                : isUsed
                ? "Bereits gespielt"
                : "Noch offen"
            }
            className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold border ${
              isExcluded
                ? "bg-muted text-muted-foreground/40 border-border line-through"
                : isUsed
                ? "bg-muted text-muted-foreground/50 border-border"
                : "bg-primary/10 text-foreground border-primary/30"
            }`}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}
