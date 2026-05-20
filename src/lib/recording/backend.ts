import type { AudioChunk, SpeakerLabel, TranscribedChunk } from "./types";

export interface TranscribeOptions {
	endpoint?: string;
	signal?: AbortSignal;
}

export async function transcribeChunk(
	chunk: AudioChunk,
	opts: TranscribeOptions = {},
): Promise<TranscribedChunk> {
	if (opts.endpoint) {
		return postChunkToBackend(chunk, opts.endpoint, opts.signal);
	}
	return mockTranscribe(chunk);
}

async function postChunkToBackend(
	chunk: AudioChunk,
	endpoint: string,
	signal?: AbortSignal,
): Promise<TranscribedChunk> {
	// Raw PCM: 16-bit signed int, 16000 Hz, mono, little-endian, no header
	const pcmBlob = new Blob([chunk.audio.buffer as ArrayBuffer], { type: "audio/pcm" });
	const form = new FormData();
	form.append("audio", pcmBlob, `${chunk.id}.pcm`);
	form.append("chunkId", chunk.id);
	form.append("startedAtMs", String(chunk.startedAtMs));
	form.append("durationMs", String(chunk.durationMs));
	form.append("sampleRate", String(chunk.sampleRate));

	const res = await fetch(endpoint, { method: "POST", body: form, signal });
	if (!res.ok) {
		throw new Error(`Transcription failed: ${res.status} ${res.statusText}`);
	}
	const data = (await res.json()) as {
		speaker: SpeakerLabel;
		text: string;
	};
	return {
		chunkId: chunk.id,
		speaker: data.speaker,
		text: data.text,
		startedAtMs: chunk.startedAtMs,
		durationMs: chunk.durationMs,
	};
}

const MOCK_PHRASES = [
	"Good morning, how are you feeling today?",
	"I've been having some sensitivity on my upper left side.",
	"Let me take a look at that.",
	"It's been bothering me for about a week.",
	"I see some decay on the mesial surface.",
	"Will my insurance cover this?",
	"We'll need to do a crown to restore the tooth.",
	"How long will the procedure take?",
];

async function mockTranscribe(chunk: AudioChunk): Promise<TranscribedChunk> {
	await new Promise((r) => setTimeout(r, 250 + Math.random() * 400));
	const speaker = mockSpeakerFromAudio(chunk.audio, chunk.sampleRate);
	const text = MOCK_PHRASES[Math.floor(Math.random() * MOCK_PHRASES.length)];
	return {
		chunkId: chunk.id,
		speaker,
		text,
		startedAtMs: chunk.startedAtMs,
		durationMs: chunk.durationMs,
	};
}

function mockSpeakerFromAudio(
	samples: Int16Array,
	sampleRate: number,
): SpeakerLabel {
	let crossings = 0;
	for (let i = 1; i < samples.length; i++) {
		if (samples[i - 1] < 0 !== samples[i] < 0) crossings++;
	}
	const zcr = crossings / (samples.length / sampleRate);
	if (zcr < 1500) return "Speaker 1";
	if (zcr < 2500) return "Speaker 2";
	return "Speaker 3";
}
