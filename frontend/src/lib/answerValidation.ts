import { z } from "zod";
import type { Category } from "@/types/events";

// Go's strings.ToUpper/ToLower map rune by rune via unicode.ToUpper/ToLower, so
// the rune count never changes. JS toUpperCase/toLowerCase apply *full* Unicode
// case mapping, which can turn one code point into several ("ß" -> "SS",
// "İ" -> "i̇"). Exactly where they expand, Go's simple mapping has no
// single-rune equivalent and leaves the character alone - so we leave it alone
// too. Without this the mirror accepted "ßeta" for letter S (normalised to
// "SSeta") while the engine rejected it, and the buzz button lit up for an
// answer the server refused.
function mapCase(ch: string, upper: boolean): string {
	const mapped = upper ? ch.toUpperCase() : ch.toLowerCase();
	return [...mapped].length === 1 ? mapped : ch;
}

function upperRunes(s: string): string {
	return [...s].map((c) => mapCase(c, true)).join("");
}

function lowerRunes(s: string): string {
	return [...s].map((c) => mapCase(c, false)).join("");
}

// Mirror of the backend's game.Normalize (engine.go): trim, uppercase the first
// rune, lowercase the rest. Kept in sync so client-side validation matches the
// server's authoritative rules.
export function normalize(value: string): string {
	const v = value.trim();
	if (v === "") return "";
	const chars = [...v];
	return mapCase(chars[0], true) + lowerRunes(chars.slice(1).join(""));
}

// Zod schema for a single answer given the current letter. Mirrors
// engine.IsRuleValid: non-empty, 2-30 chars, starts with the round letter - or,
// in last-letter mode, ends with it. A single character is too short.
// The schema depends only on the round letter and the mode, both constant for a
// whole round - but the render path asks for it roughly 2n+1 times per render
// (per category for the done tick and the invalid border, plus validateAnswers)
// and re-renders on every keystroke. Building the chain each time was pure
// repeated work, so schemas are cached per (letter, mode). At most 52 entries
// ever, so the cache needs no eviction.
const schemaCache = new Map<string, ReturnType<typeof buildAnswerSchema>>();

function answerSchema(letter: string, lastLetter: boolean) {
	const key = `${lastLetter ? "L" : "F"}:${letter}`;
	let schema = schemaCache.get(key);
	if (!schema) {
		schema = buildAnswerSchema(letter, lastLetter);
		schemaCache.set(key, schema);
	}
	return schema;
}

function buildAnswerSchema(letter: string, lastLetter: boolean) {
	const upper = upperRunes(letter);
	return z
		.string()
		.transform(normalize)
		// Counted in code points, like the engine's len([]rune(n)) - `.length`
		// would count UTF-16 units and reject answers the server accepts.
		.refine(
			(n) => {
				const count = [...n].length;
				return count >= 2 && count <= 30;
			},
			{ message: "2-30 Zeichen" },
		)
		.refine(
			(n) => {
				const runes = [...n];
				// Zod runs every refinement, so this one also sees a value the length
				// check already rejected - including the empty string.
				if (runes.length === 0) return false;
				return lastLetter
					? mapCase(runes[runes.length - 1], true) === upper
					: upperRunes(n).startsWith(upper);
			},
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
