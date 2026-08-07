import { describe, expect, it } from "bun:test";
import type { Category } from "@/types/events";
import { isFieldInvalid, normalize, validateAnswers } from "./answerValidation";

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

describe("isFieldInvalid", () => {
	it("treats an empty field as not-yet-filled (not invalid)", () => {
		expect(isFieldInvalid("", "A")).toBe(false);
		expect(isFieldInvalid("   ", "A")).toBe(false);
	});

	it("accepts an answer starting with the round letter", () => {
		expect(isFieldInvalid("Apfel", "A")).toBe(false);
		expect(isFieldInvalid("apfel", "A")).toBe(false); // normalized first
	});

	it("rejects an answer with the wrong first letter", () => {
		expect(isFieldInvalid("Banane", "A")).toBe(true);
	});

	it("honours last-letter mode (must end with the letter)", () => {
		expect(isFieldInvalid("Bar", "R", true)).toBe(false);
		expect(isFieldInvalid("Bus", "R", true)).toBe(true);
	});

	it("rejects answers longer than 30 characters", () => {
		expect(isFieldInvalid("A".repeat(31), "A")).toBe(true);
	});

	it("rejects a single character as too short (min 2)", () => {
		expect(isFieldInvalid("A", "A")).toBe(true);
		expect(isFieldInvalid("A", "A", true)).toBe(true); // last-letter mode too
		expect(isFieldInvalid("Ab", "A")).toBe(false); // two chars is enough
	});

	// rule-1: the length bound counts code points, like the engine's
	// len([]rune(n)) - not UTF-16 units, which would double every astral char.
	it("measures length in code points, not UTF-16 units", () => {
		const surrogate = "\u{1F388}"; // 1 code point, 2 UTF-16 units
		expect(isFieldInvalid(`A${surrogate.repeat(15)}`, "A")).toBe(false); // 16
		expect(isFieldInvalid(`A${surrogate.repeat(29)}`, "A")).toBe(false); // 30
		expect(isFieldInvalid(`A${surrogate.repeat(30)}`, "A")).toBe(true); // 31
	});

	// rule-1: "ßeta" normalizes to "SSeta" under JS case rules, which would make
	// it pass for letter S - the engine keeps "ßeta" and rejects it.
	it("does not let expanding case mappings fake the round letter", () => {
		expect(isFieldInvalid("ßeta", "S")).toBe(true);
	});

	// The last-letter check must look at the last *code point*.
	it("matches the last code point in last-letter mode", () => {
		expect(isFieldInvalid(`Ab${"\u{1F388}"}`, "B", true)).toBe(true);
		expect(isFieldInvalid("Abb", "B", true)).toBe(false);
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

	it("fails and names the offending category on a wrong letter", () => {
		const res = validateAnswers(
			categories,
			{ c1: "Aachen", c2: "Belgien" },
			"A",
		);
		expect(res.valid).toBe(false);
		expect(res.reason).toContain("Land");
	});
});
