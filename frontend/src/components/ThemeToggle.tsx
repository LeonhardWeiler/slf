import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const order: Theme[] = ["light", "dark", "system"];
const labels: Record<Theme, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "System",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = order[(order.indexOf(theme) + 1) % order.length]!;

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      title={`Theme: ${labels[theme]} (klicken für ${labels[next]})`}
      aria-label={`Theme wechseln, aktuell ${labels[theme]}`}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}
