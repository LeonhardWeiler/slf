import { z } from "zod";
import type { Category } from "@/types/events";

// Mirror of the backend's game.Normalize (engine.go): trim, uppercase the first
// rune, lowercase the rest. Kept in sync so client-side validation matches the
// server's authoritative rules.
export function normalize(value: string): string {
	const v = value.trim();
	if (v === "") return "";
	const chars = [...v];
	return chars[0].toUpperCase() + chars.slice(1).join("").toLowerCase();
}

// Zod schema for a single answer given the current letter. Mirrors
// engine.IsRuleValid: non-empty, 1–30 chars, starts with the round letter — or,
// in last-letter mode, ends with it.
function answerSchema(letter: string, lastLetter: boolean) {
	const upper = letter.toUpperCase();
	return z
		.string()
		.transform(normalize)
		.refine((n) => n.length >= 1 && n.length <= 30, {
			message: "1–30 Zeichen",
		})
		.refine(
			(n) =>
				lastLetter ? n.slice(-1).toUpperCase() === upper : n.startsWith(upper),
			{
				message: lastLetter
					? `muss mit ${upper} enden`
					: `muss mit ${upper} beginnen`,
			},
		);
}

// True when a field has content that breaks the rules (wrong letter / length).
// An empty field is "not yet filled", not wrong, so it returns false and gets no
// red border. Drives the per-field validity indicator once a field is blurred.
export function isFieldInvalid(
	value: string,
	letter: string,
	lastLetter = false,
): boolean {
	if (value.trim() === "") return false;
	return !answerSchema(letter, lastLetter).safeParse(value).success;
}

export interface AnswerValidation {
	valid: boolean;
	reason?: string;
}

// Validates that *every* category has a rule-valid answer for the given letter.
// Returns the first human-readable reason when something is off so the buzz
// button can explain why it is disabled.
export function validateAnswers(
	categories: Category[],
	answers: Record<string, string>,
	letter: string,
	lastLetter = false,
): AnswerValidation {
	const schema = answerSchema(letter, lastLetter);
	for (const cat of categories) {
		const raw = answers[cat.id] ?? "";
		if (raw.trim() === "") {
			return {
				valid: false,
				reason: "Fülle alle Kategorien aus, um zu buzzern.",
			};
		}
		const result = schema.safeParse(raw);
		if (!result.success) {
			const msg = result.error.issues[0]?.message ?? "ungültig";
			return { valid: false, reason: `„${cat.name}" ${msg}.` };
		}
	}
	return { valid: true };
}
