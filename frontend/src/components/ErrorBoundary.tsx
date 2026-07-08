import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	// Optional compact fallback (e.g. for a lazy sub-tree) instead of the
	// full-screen one. Receives a retry callback that clears the error state.
	fallback?: (retry: () => void) => ReactNode;
}

interface State {
	error: Error | null;
}

// Catches render-time errors (incl. failed React.lazy chunk loads) so an
// unexpected failure shows a recoverable message instead of a blank page.
export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		if (import.meta.env?.DEV) {
			console.error("ErrorBoundary caught:", error, info);
		}
	}

	private retry = () => this.setState({ error: null });

	render() {
		if (this.state.error) {
			if (this.props.fallback) return this.props.fallback(this.retry);
			return (
				<div className="min-h-svh bg-background flex flex-col items-center justify-center screen-pad gap-4 text-center">
					<h1 className="text-xl font-bold">Etwas ist schiefgelaufen</h1>
					<p className="text-muted-foreground text-sm max-w-sm">
						Ein unerwarteter Fehler ist aufgetreten. Lade die Seite neu, um
						fortzufahren.
					</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
					>
						Neu laden
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
