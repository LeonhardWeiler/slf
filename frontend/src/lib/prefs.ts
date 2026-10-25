import { create } from "zustand";
import { storage } from "./storage";

interface Prefs {
	sound: boolean;
	music: number;
	sfx: number;
	haptics: boolean;
	calm: boolean;
}

const KEY = "slf:prefs";
const defaults: Prefs = {
	sound: true,
	music: 0.7,
	sfx: 0.8,
	haptics: true,
	calm: false,
};

function load(): Prefs {
	try {
		return { ...defaults, ...JSON.parse(storage.get(KEY) ?? "{}") };
	} catch {
		return defaults;
	}
}

export const usePrefs = create<Prefs>(load);

export const prefs = {
	get: usePrefs.getState,
	set(patch: Partial<Prefs>) {
		usePrefs.setState(patch);
		storage.set(KEY, JSON.stringify(usePrefs.getState()));
	},
};
