import { expect, it } from "bun:test";
import { storage } from "./storage";

it("keeps values in memory when localStorage throws", () => {
	const real = globalThis.localStorage;
	const blocked = new Proxy(real, {
		get() {
			throw new DOMException("blocked", "SecurityError");
		},
	});
	Object.defineProperty(globalThis, "localStorage", {
		value: blocked,
		configurable: true,
	});
	try {
		expect(storage.get("k")).toBeNull();
		storage.set("k", "v");
		expect(storage.get("k")).toBe("v");
		expect(storage.keys()).toEqual(["k"]);
		storage.remove("k");
		expect(storage.get("k")).toBeNull();
	} finally {
		Object.defineProperty(globalThis, "localStorage", {
			value: real,
			configurable: true,
		});
	}
});
