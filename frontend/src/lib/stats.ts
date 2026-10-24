import { storage } from "@/lib/storage";

const KEY = "slf:stats";

type Stats = { best: Record<string, number>; day: string; streak: number };

const day = (offset = 0) => {
	const d = new Date();
	d.setDate(d.getDate() + offset);
	return d.toLocaleDateString("sv");
};

function load(): Stats {
	const s: Stats = { best: {}, day: "", streak: 0 };
	try {
		return { ...s, ...JSON.parse(storage.get(KEY) ?? "{}") };
	} catch {
		return s;
	}
}

const save = (s: Stats) => storage.set(KEY, JSON.stringify(s));

export const stats = {
	best: (mode: string) => load().best[mode] ?? 0,
	record(mode: string, score: number) {
		const s = load();
		if (score > (s.best[mode] ?? 0))
			save({ ...s, best: { ...s.best, [mode]: score } });
	},
	streak() {
		const s = load();
		return s.day === day() || s.day === day(-1) ? s.streak : 0;
	},
	played() {
		const s = load();
		if (s.day !== day()) save({ ...s, day: day(), streak: this.streak() + 1 });
		return this.streak();
	},
};
