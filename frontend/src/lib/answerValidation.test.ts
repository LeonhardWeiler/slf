import { describe, expect, it } from "vitest";
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
