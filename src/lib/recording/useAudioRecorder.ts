import { MicVAD } from "@ricky0123/vad-web";
import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeChunk } from "./backend";
import type {
	AudioChunk,
	RecorderError,
	RecorderStatus,
	TranscribedChunk,
} from "./types";
import { float32ToInt16PCM } from "./wav";

const VAD_SAMPLE_RATE = 16000;

export interface UseAudioRecorderOptions {
	endpoint?: string;
	onTranscribed?: (result: TranscribedChunk) => void;
}

export interface UseAudioRecorderResult {
	status: RecorderStatus;
	error: RecorderError | null;
	isSpeechActive: boolean;
	chunks: TranscribedChunk[];
	pendingCount: number;
	start: () => Promise<void>;
	stop: () => Promise<void>;
	reset: () => void;
}

export function useAudioRecorder(
	options: UseAudioRecorderOptions = {},
): UseAudioRecorderResult {
	const { endpoint, onTranscribed } = options;

	const [status, setStatus] = useState<RecorderStatus>("idle");
	const [error, setError] = useState<RecorderError | null>(null);
	const [isSpeechActive, setIsSpeechActive] = useState(false);
	const [chunks, setChunks] = useState<TranscribedChunk[]>([]);
	const [pendingCount, setPendingCount] = useState(0);

	console.log({ pendingCount, chunks });

	const vadRef = useRef<MicVAD | null>(null);
	const sessionStartRef = useRef<number>(0);
	const speechStartRef = useRef<number>(0);
	const abortRef = useRef<AbortController | null>(null);

	const onTranscribedRef = useRef(onTranscribed);
	useEffect(() => {
		onTranscribedRef.current = onTranscribed;
	}, [onTranscribed]);

	const endpointRef = useRef(endpoint);
	useEffect(() => {
		endpointRef.current = endpoint;
	}, [endpoint]);

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
		console.log("audio chunk", float32ToInt16PCM(audio));

		console.log(
			`[VAD] 🔇 Speech ended — ${(durationMs / 1000).toFixed(2)}s, ${audio.length} samples, chunk id: ${chunk.id}`,
		);
		setIsSpeechActive(false);
		setPendingCount((c) => c + 1);

		const controller = abortRef.current;
		transcribeChunk(chunk, {
			endpoint: endpointRef.current,
			signal: controller?.signal,
		})
			.then((result) => {
				console.log(
					`[Transcribe] ✅ ${result.speaker}: "${result.text}" (${(result.durationMs / 1000).toFixed(2)}s)`,
				);
				setChunks((prev) => [...prev, result]);
				onTranscribedRef.current?.(result);
			})
			.catch((err) => {
				if (err instanceof DOMException && err.name === "AbortError") return;
				console.error("[Transcribe] ❌ Failed to transcribe chunk", err);
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
			abortRef.current = new AbortController();
			sessionStartRef.current = performance.now();
			const vad = await MicVAD.new({
				model: "v5",
				baseAssetPath: "/",
				onnxWASMBasePath: "/",
				onSpeechStart: () => {
					speechStartRef.current = performance.now();
					setIsSpeechActive(true);
					console.log("[VAD] 🎙️ Speech started");
				},
				onSpeechEnd: handleSpeechEnd,
				onVADMisfire: () => {
					setIsSpeechActive(false);
					console.log("[VAD] ⚡ Misfire (too short, ignored)");
				},
			});
			vadRef.current = vad;
			await vad.start();
			setStatus("recording");
			console.log("[Recorder] ▶️ Recording started — speak to generate chunks");
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
		abortRef.current?.abort();
		abortRef.current = null;
		await vad.destroy();
		setIsSpeechActive(false);
		setStatus("idle");
		console.log("[Recorder] ⏹️ Recording stopped");
	}, []);

	const reset = useCallback(() => {
		setChunks([]);
		setPendingCount(0);
		setError(null);
	}, []);

	useEffect(() => {
		return () => {
			vadRef.current?.destroy();
			vadRef.current = null;
			abortRef.current?.abort();
		};
	}, []);

	return {
		status,
		error,
		isSpeechActive,
		chunks,
		pendingCount,
		start,
		stop,
		reset,
	};
}
