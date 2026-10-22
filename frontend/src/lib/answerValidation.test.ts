import { describe, expect, it } from "bun:test";
import type { Category } from "@/types/events";
import { normalize, ruleIssue, validateAnswers } from "./answerValidation";

const invalid = (...a: Parameters<typeof ruleIssue>) =>
	ruleIssue(...a) !== undefined;

// These tests guard the client-side mirror of the backend's authoritative rules
// (game.Normalize / engine.IsRuleValid). If the Go engine changes, the mirror
// must change with it - and these assertions should catch silent drift.

describe("normalize", () => {
	it("trims and cases like the engine (first upper, rest lower)", () => {
		expect(normalize("  berLIN  ")).toBe("Berlin");
		expect(normalize("aPFEL")).toBe("Apfel");
		expect(normalize("x")).toBe("X");
	});

	it("returns empty for blank input", () => {
		expect(normalize("")).toBe("");
		expect(normalize("   ")).toBe("");
	});

	it("handles non-ASCII first characters", () => {
		expect(normalize("über")).toBe("Über");
		expect(normalize("élan")).toBe("Élan");
	});

	// rule-1: JS case mapping expands "ß" to "SS" where Go's per-rune
	// unicode.ToUpper leaves it alone. The mirror must follow Go, or it accepts
	// answers the engine rejects.
	it("does not expand characters the engine leaves alone", () => {
		expect(normalize("ßeta")).toBe("ßeta");
		expect(normalize("ﬁnale")).toBe("ﬁnale");
	});

	// The rune count must survive normalization (Go maps rune by rune).
	it("keeps the code-point count stable", () => {
		const emoji = `A${"\u{1F388}".repeat(5)}`;
		expect([...normalize(emoji)].length).toBe([...emoji].length);
	});
});

describe("ruleIssue", () => {
	it("treats an empty field as not-yet-filled (not invalid)", () => {
		expect(invalid("", "A")).toBe(false);
		expect(invalid("   ", "A")).toBe(false);
	});

	it("accepts an answer starting with the round letter", () => {
		expect(invalid("Apfel", "A")).toBe(false);
		expect(invalid("apfel", "A")).toBe(false); // normalized first
	});

	it("rejects an answer with the wrong first letter", () => {
		expect(invalid("Banane", "A")).toBe(true);
	});

	it("honours last-letter mode (must end with the letter)", () => {
		expect(invalid("Bar", "R", true)).toBe(false);
		expect(invalid("Bus", "R", true)).toBe(true);
	});

	it("rejects answers longer than 30 characters", () => {
		expect(invalid("A".repeat(31), "A")).toBe(true);
	});

	it("rejects a single character as too short (min 2)", () => {
		expect(invalid("A", "A")).toBe(true);
		expect(invalid("A", "A", true)).toBe(true); // last-letter mode too
		expect(invalid("Ab", "A")).toBe(false); // two chars is enough
	});

	// rule-1: the length bound counts code points, like the engine's
	// len([]rune(n)) - not UTF-16 units, which would double every astral char.
	it("measures length in code points, not UTF-16 units", () => {
		const surrogate = "\u{1F388}"; // 1 code point, 2 UTF-16 units
		expect(invalid(`A${surrogate.repeat(15)}`, "A")).toBe(false); // 16
		expect(invalid(`A${surrogate.repeat(29)}`, "A")).toBe(false); // 30
		expect(invalid(`A${surrogate.repeat(30)}`, "A")).toBe(true); // 31
	});

	// rule-1: "ßeta" normalizes to "SSeta" under JS case rules, which would make
	// it pass for letter S - the engine keeps "ßeta" and rejects it.
	it("does not let expanding case mappings fake the round letter", () => {
		expect(invalid("ßeta", "S")).toBe(true);
	});

	// The last-letter check must look at the last *code point*.
	it("matches the last code point in last-letter mode", () => {
		expect(invalid(`Ab${"\u{1F388}"}`, "B", true)).toBe(true);
		expect(invalid("Abb", "B", true)).toBe(false);
	});
});

describe("validateAnswers", () => {
	const categories: Category[] = [
		{ id: "c1", name: "Stadt" },
		{ id: "c2", name: "Land" },
	];

	it("passes when every category has a rule-valid answer", () => {
		const res = validateAnswers(
			categories,
			{ c1: "Aachen", c2: "Argentinien" },
			"A",
		);
		expect(res.valid).toBe(true);
	});

	it("fails with a fill-all hint when a field is empty", () => {
		const res = validateAnswers(categories, { c1: "Aachen", c2: "" }, "A");
		expect(res.valid).toBe(false);
		expect(res.reason).toMatch(/Fülle alle/);
	});

	it("fails without a reason on a wrong letter", () => {
		const res = validateAnswers(
			categories,
			{ c1: "Aachen", c2: "Belgien" },
			"A",
		);
		expect(res.valid).toBe(false);
		expect(res.reason).toBeUndefined();
	});
});
