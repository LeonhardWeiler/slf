import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// True if the element is a text-entry target (input/textarea/select or a
// contenteditable). Used by global keyboard handlers to avoid hijacking keys
// while the user is typing.
export function isTypingTarget(el: Element | null): boolean {
	if (!el) return false;
	const tag = el.tagName;
	return (
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		tag === "SELECT" ||
		(el as HTMLElement).isContentEditable
	);
}
