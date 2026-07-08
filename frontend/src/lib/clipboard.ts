// Copy text to the clipboard with a fallback for insecure contexts.
//
// navigator.clipboard is only available over HTTPS/localhost, so on a plain-HTTP
// LAN IP (the common "phone joins via local IP" case) it is undefined. We then
// fall back to a hidden <textarea> + document.execCommand("copy"), which still
// works in that context. Returns whether the copy succeeded so callers can show
// a "copied" tick or a hint that copying isn't available.
export async function copyToClipboard(text: string): Promise<boolean> {
	if (!text) return false;

	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// fall through to the execCommand fallback
		}
	}

	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		// Keep it out of view and out of the layout/scroll.
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.top = "-9999px";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(ta);
		return ok;
	} catch {
		return false;
	}
}
