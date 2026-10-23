import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Btn, Mascot } from "@/components/kit";

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
				<div className="center crash">
					<Mascot size="big" base="sad" />
					<Btn
						kind="primary"
						aria-label="Neu laden"
						data-tip="Neu laden"
						onClick={() => window.location.reload()}
					>
						<RotateCcw />
					</Btn>
				</div>
			);
		}
		return this.props.children;
	}
}
