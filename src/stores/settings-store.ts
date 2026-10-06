import { create } from 'zustand';

import type { ProviderSettings, providerSettingsSchema } from '@/schemas/settings';
import type { z } from 'zod';

type SettingsState = {
  settings: ProviderSettings | null;
  save: (settings: ProviderSettings) => void;
  clear: () => void;
};

// In-memory for now. Persistence (expo-secure-store for the API key,
// AsyncStorage/MMKV for the rest) is the next step after init.
export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  save: (settings) => set({ settings }),
  clear: () => set({ settings: null }),
}));

export type SettingsInput = z.infer<typeof providerSettingsSchema>;
