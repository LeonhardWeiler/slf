import { z } from "zod/mini";
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

export const LENGTH_ISSUE = "2-30 Zeichen";

function buildAnswerSchema(letter: string, lastLetter: boolean) {
	const upper = upperRunes(letter);
	return z.string().check(
		z.overwrite(normalize),
		// The letter check comes first so a wrong letter is the reported issue.
		z.refine(
			(n) => {
				const runes = [...n];
				if (runes.length === 0) return false;
				return lastLetter
					? mapCase(runes[runes.length - 1], true) === upper
					: upperRunes(n).startsWith(upper);
			},
			{
				message: lastLetter
					? `endet nicht auf ${upper}`
					: `beginnt nicht mit ${upper}`,
			},
		),
		// Counted in code points, like the engine's len([]rune(n)) - `.length`
		// would count UTF-16 units and reject answers the server accepts.
		z.refine(
			(n) => {
				const count = [...n].length;
				return count >= 2 && count <= 30;
			},
			{ message: LENGTH_ISSUE },
		),
	);
}

// The first rule a value breaks (wrong letter / length), undefined when it
// passes. An empty field is "not yet filled", not wrong, so it has no issue.
export function ruleIssue(
	value: string,
	letter: string,
	lastLetter = false,
): string | undefined {
	if (value.trim() === "") return undefined;
	const result = answerSchema(letter, lastLetter).safeParse(value);
	if (result.success) return undefined;
	return result.error.issues[0]?.message ?? "ungültig";
}

export interface AnswerValidation {
	valid: boolean;
	reason?: string;
}

// Validates that *every* category has a rule-valid answer for the given letter.
// Only an empty field gets a reason; a rule issue is shown at its field.
export function validateAnswers(
	categories: Category[],
	answers: Record<string, string>,
	letter: string,
	lastLetter = false,
): AnswerValidation {
	if (categories.some((c) => (answers[c.id] ?? "").trim() === "")) {
		return {
			valid: false,
			reason: "Fülle alle Kategorien aus, um zu buzzern.",
		};
	}
	return {
		valid: categories.every(
			(c) => !ruleIssue(answers[c.id], letter, lastLetter),
		),
	};
}
