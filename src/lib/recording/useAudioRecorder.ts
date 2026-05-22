import { MicVAD } from "@ricky0123/vad-web";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranscriptStore } from "@/store/useTranscriptStore";
import { finalizeTranscription, transcribeChunkViaService } from "./backend";
import type { AudioChunk, RecorderError, RecorderStatus } from "./types";
import { float32ToInt16PCM } from "./wav";

const VAD_SAMPLE_RATE = 16000;

const SPEAKER_LABEL_RE = /^spk_\d+$/;

function parseTranscript(transcript: string): Array<{ speaker: string; text: string }> {
	// Split on 2+ whitespace that precedes a speaker label (spk_0:, spk_1:, etc.)
	const parts = transcript.split(/\s{2,}(?=spk_\d+:)/);
	return parts
		.map((part) => {
			const colonIdx = part.indexOf(": ");
			if (colonIdx !== -1) {
				const speaker = part.slice(0, colonIdx).trim();
				if (SPEAKER_LABEL_RE.test(speaker)) {
					return { speaker, text: part.slice(colonIdx + 2).trim() };
				}
			}
			return { speaker: "spk_0", text: part.trim() };
		})
		.filter((s) => s.text.length > 0);
}

export interface UseAudioRecorderResult {
	status: RecorderStatus;
	error: RecorderError | null;
	isSpeechActive: boolean;
	pendingCount: number;
	start: () => Promise<void>;
	stop: () => Promise<void>;
	finalize: () => Promise<void>;
	reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
	const [status, setStatus] = useState<RecorderStatus>("idle");
	const [error, setError] = useState<RecorderError | null>(null);
	const [isSpeechActive, setIsSpeechActive] = useState(false);
	const [pendingCount, setPendingCount] = useState(0);

	const vadRef = useRef<MicVAD | null>(null);
	const sessionStartRef = useRef<number>(0);
	const speechStartRef = useRef<number>(0);
	const chunkNumberRef = useRef(1);
	const chunkTimingsRef = useRef<Map<number, number>>(new Map());

	const handleSpeechEnd = useCallback((audio: Float32Array) => {
		const now = performance.now();
		const durationMs = now - speechStartRef.current;

		const chunk: AudioChunk = {
			id: `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			audio: float32ToInt16PCM(audio),
			sampleRate: VAD_SAMPLE_RATE,
			startedAtMs: speechStartRef.current - sessionStartRef.current,
			durationMs,
		};

		setIsSpeechActive(false);

		const { chairsideId, addChunk } = useTranscriptStore.getState();
		if (!chairsideId) return;

		setPendingCount((c) => c + 1);

		const chunkNumber = chunkNumberRef.current++;
		chunkTimingsRef.current.set(chunkNumber, chunk.startedAtMs);

		transcribeChunkViaService(chunk, chairsideId, chunkNumber)
			.then((result) => {
				// Discard if the session changed while this request was in flight
				if (useTranscriptStore.getState().chairsideId !== chairsideId) return;
				if (!result.transcript) return;
				const segments = parseTranscript(result.transcript);
				const startedAtMs =
					chunkTimingsRef.current.get(result.chunk_number - 1) ?? 0;
				for (const [i, { speaker, text }] of segments.entries()) {
					addChunk({
						chunkId: `${result.chunk_number}-${i}`,
						speaker,
						text,
						startedAtMs,
						durationMs: chunk.durationMs,
					});
				}
			})
			.catch((err) => {
				console.error("[Transcribe] Failed to transcribe chunk", err);
			})
			.finally(() => {
				setPendingCount((c) => Math.max(0, c - 1));
			});
	}, []);

	const start = useCallback(async () => {
		if (vadRef.current) return;
		setError(null);
		setStatus("loading");
		try {
			sessionStartRef.current = performance.now();
			const vad = await MicVAD.new({
				model: "v5",
				baseAssetPath: "/",
				onnxWASMBasePath: "/",
				onSpeechStart: () => {
					speechStartRef.current = performance.now();
					setIsSpeechActive(true);
				},
				onSpeechEnd: handleSpeechEnd,
				onVADMisfire: () => {
					setIsSpeechActive(false);
				},
			});
			vadRef.current = vad;
			await vad.start();
			setStatus("recording");
		} catch (err) {
			const isPermission =
				err instanceof DOMException &&
				(err.name === "NotAllowedError" || err.name === "SecurityError");
			setError({
				code: isPermission ? "permission" : "load",
				message: err instanceof Error ? err.message : String(err),
			});
			setStatus("error");
		}
	}, [handleSpeechEnd]);

	const stop = useCallback(async () => {
		const vad = vadRef.current;
		if (!vad) return;
		vadRef.current = null;
		await vad.destroy();
		setIsSpeechActive(false);
		setStatus("idle");
	}, []);

	const finalize = useCallback(async () => {
		const { chairsideId, addChunk } = useTranscriptStore.getState();
		if (!chairsideId) return;
		const chunkNumber = chunkNumberRef.current++;
		const result = await finalizeTranscription(chairsideId, chunkNumber);
		if (!result.transcript) return;
		const segments = parseTranscript(result.transcript);
		const startedAtMs = chunkTimingsRef.current.get(result.chunk_number - 1) ?? 0;
		for (const [i, { speaker, text }] of segments.entries()) {
			addChunk({
				chunkId: `${result.chunk_number}-${i}`,
				speaker,
				text,
				startedAtMs,
				durationMs: 0,
			});
		}
	}, []);

	const reset = useCallback(() => {
		setPendingCount(0);
		setError(null);
		chunkNumberRef.current = 1;
		chunkTimingsRef.current.clear();
	}, []);

	useEffect(() => {
		return () => {
			vadRef.current?.destroy();
			vadRef.current = null;
		};
	}, []);

	return { status, error, isSpeechActive, pendingCount, start, stop, finalize, reset };
}
