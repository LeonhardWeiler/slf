import { describe, expect, it, setSystemTime } from "bun:test";
import { stats } from "@/lib/stats";

describe("stats", () => {
	it("keeps the best score per mode", () => {
		stats.record("solo", 30);
		stats.record("solo", 20);
		stats.record("multi", 5);
		expect(stats.best("solo")).toBe(30);
		expect(stats.best("multi")).toBe(5);
		expect(stats.best("sprint")).toBe(0);
	});

	it("counts consecutive days and resets after a gap", () => {
		setSystemTime(new Date(2026, 0, 1, 12));
		expect(stats.played()).toBe(1);
		expect(stats.played()).toBe(1);
		setSystemTime(new Date(2026, 0, 2, 12));
		expect(stats.streak()).toBe(1);
		expect(stats.played()).toBe(2);
		setSystemTime(new Date(2026, 0, 4, 12));
		expect(stats.streak()).toBe(0);
		expect(stats.played()).toBe(1);
		setSystemTime();
	});
});
