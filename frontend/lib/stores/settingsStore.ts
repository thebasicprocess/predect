import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Settings {
  agentCount: number;
  rounds: number;
  defaultDomain: string;
  defaultTimeHorizon: string;
  newsApiKey: string;
  gNewsApiKey: string;
  alphaVantageKey: string;

  setAgentCount: (n: number) => void;
  setRounds: (n: number) => void;
  setDefaultDomain: (d: string) => void;
  setDefaultTimeHorizon: (h: string) => void;
  setNewsApiKey: (k: string) => void;
  setGNewsApiKey: (k: string) => void;
  setAlphaVantageKey: (k: string) => void;
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      agentCount: 8,
      rounds: 5,
      defaultDomain: "general",
      defaultTimeHorizon: "6 months",
      newsApiKey: "",
      gNewsApiKey: "",
      alphaVantageKey: "",

      setAgentCount: (agentCount) => set({ agentCount }),
      setRounds: (rounds) => set({ rounds }),
      setDefaultDomain: (defaultDomain) => set({ defaultDomain }),
      setDefaultTimeHorizon: (defaultTimeHorizon) => set({ defaultTimeHorizon }),
      setNewsApiKey: (newsApiKey) => set({ newsApiKey }),
      setGNewsApiKey: (gNewsApiKey) => set({ gNewsApiKey }),
      setAlphaVantageKey: (alphaVantageKey) => set({ alphaVantageKey }),
    }),
    { name: "predect-settings" }
  )
);
