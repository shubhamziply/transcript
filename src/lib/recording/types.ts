export type SpeakerLabel = string;

export interface AudioChunk {
	id: string;
	audio: Int16Array;
	sampleRate: number;
	startedAtMs: number;
	durationMs: number;
}

export interface TranscribedChunk {
	chunkId: string;
	speaker: SpeakerLabel;
	text: string;
	startedAtMs: number;
	durationMs: number;
}

export type RecorderStatus =
	| "idle"
	| "loading"
	| "ready"
	| "recording"
	| "error";

export interface RecorderError {
	code: "permission" | "load" | "unknown";
	message: string;
}
