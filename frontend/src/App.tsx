import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Router } from "@/router";

export function App() {
	return (
		<ErrorBoundary>
			<Router />
		</ErrorBoundary>
	);
}
