import type { DataProvider } from "./types";
import { moodleProvider } from "./moodle";

const providers: Record<string, DataProvider> = {
  [moodleProvider.id]: moodleProvider,
};

export function getProvider(id: string): DataProvider | undefined {
  return providers[id];
}

export function getAllProviders(): DataProvider[] {
  return Object.values(providers);
}

export const primaryProvider = moodleProvider;

