// localStorage that never throws: when the browser blocks or fills it, values
// live in memory for this tab only.
const memory = new Map<string, string>();

export const storage = {
	get(key: string): string | null {
		try {
			return localStorage.getItem(key) ?? memory.get(key) ?? null;
		} catch {
			return memory.get(key) ?? null;
		}
	},
	set(key: string, value: string) {
		try {
			localStorage.setItem(key, value);
			memory.delete(key);
		} catch {
			memory.set(key, value);
		}
	},
	remove(key: string) {
		memory.delete(key);
		try {
			localStorage.removeItem(key);
		} catch {}
	},
	keys(): string[] {
		const keys = [...memory.keys()];
		try {
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k) keys.push(k);
			}
		} catch {}
		return keys;
	},
};
