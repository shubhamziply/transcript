import { create } from "zustand";
import type { TranscribedChunk } from "@/lib/recording/types";

interface TranscriptStore {
	chairsideId: string | null;
	chunks: TranscribedChunk[];
	setChairsideId: (id: string) => void;
	addChunk: (chunk: TranscribedChunk) => void;
	clearSession: () => void;
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
	chairsideId: null,
	chunks: [],
	setChairsideId: (id) => set({ chairsideId: id }),
	addChunk: (chunk) => set((state) => ({ chunks: [...state.chunks, chunk] })),
	clearSession: () => set({ chairsideId: null, chunks: [] }),
}));
