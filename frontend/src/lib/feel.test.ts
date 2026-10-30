import { describe, expect, it } from "bun:test";
import { PALETTES } from "./feel";

// lightness is CIE L* of a #rrggbb colour.
function lightness(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

describe("palettes", () => {
	it("keep the background mid-light so the dark wells and tiles stand out", () => {
		for (const [world, sets] of Object.entries(PALETTES))
			for (const [, top, bottom] of sets)
				for (const c of [top, bottom])
					expect([world, c, lightness(c) >= 45 && lightness(c) <= 80]).toEqual([
						world,
						c,
						true,
					]);
	});
});
