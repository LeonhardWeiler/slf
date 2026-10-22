import { useEffect, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
	listeners.add(fn);
	window.addEventListener("popstate", fn);
	return () => {
		listeners.delete(fn);
		window.removeEventListener("popstate", fn);
	};
}

export function navigate(to: string, replace = false) {
	if (to === window.location.pathname) return;
	window.history[replace ? "replaceState" : "pushState"](null, "", to);
	for (const fn of listeners) fn();
}

export const usePath = () =>
	useSyncExternalStore(subscribe, () => window.location.pathname);

// joinCode is the :code of a /join/:code path, else null.
export const joinCode = (path: string) =>
	/^\/join\/([^/]+)\/?$/.exec(path)?.[1] ?? null;

export function Navigate({ to }: { to: string }) {
	useEffect(() => navigate(to, true), [to]);
	return null;
}
