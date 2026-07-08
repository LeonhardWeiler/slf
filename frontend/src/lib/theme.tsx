import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Resolve the initial theme: a stored light/dark preference wins; otherwise the
// OS preference is used *once* to pick a starting value. After that the system
// preference plays no further role.
function getInitialTheme(): Theme {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	// Theme is a per-browser display preference, so localStorage (shared across
	// tabs, persistent) is the right home for it — unlike the session identity.
	const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [theme]);

	const setTheme = (next: Theme) => {
		localStorage.setItem(STORAGE_KEY, next);
		setThemeState(next);
	};

	const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

	return (
		<ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return ctx;
}
