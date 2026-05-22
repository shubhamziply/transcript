import { StatusCode } from "@tavali-ai/shared-utils/enums";
import { startEncounter } from "@tavali-ai/shared-utils/service";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
	RecorderError,
	RecorderStatus,
	TranscribedChunk,
} from "@/lib/recording/types";
import { useAudioRecorder } from "@/lib/recording/useAudioRecorder";
import { cn } from "@/lib/utils";
import { useTranscriptStore } from "@/store/useTranscriptStore";

// ── Entity types & styles ────────────────────────────────────────────────────

type EntityType = "tooth" | "tooth-ref" | "surface" | "procedure";

interface DetectedEntity {
	id: string;
	label: string;
	code?: string;
	type: EntityType;
}

const entityStyles: Record<
	EntityType,
	{ chip: string; text: string; codeText: string }
> = {
	tooth: {
		chip: "bg-blue-100",
		text: "text-blue-700",
		codeText: "text-blue-500",
	},
	"tooth-ref": {
		chip: "bg-violet-100",
		text: "text-violet-600",
		codeText: "text-violet-400",
	},
	surface: {
		chip: "bg-emerald-100",
		text: "text-emerald-700",
		codeText: "text-emerald-500",
	},
	procedure: {
		chip: "bg-amber-100",
		text: "text-amber-700",
		codeText: "text-amber-500",
	},
};

const STATIC_ENTITIES: DetectedEntity[] = [
	{ id: "e1", label: "Tooth #14", type: "tooth" },
	{ id: "e2", label: "MO Surfaces", type: "surface" },
	{ id: "e3", label: "D2750 Crown PFM", code: "D2750", type: "procedure" },
	{ id: "e4", label: "Tooth #3", type: "tooth-ref" },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function WaveformBars() {
	const bars = [6, 10, 8, 4, 10, 7, 9];
	return (
		<div className="flex items-end gap-[2px] h-[14px]" aria-hidden>
			{bars.map((h, i) => (
				<span
					key={`bar-${i}-${h}`}
					className="w-[3px] rounded-full bg-green-500 animate-waveform"
					style={{ height: `${h}px`, animationDelay: `${i * 100}ms` }}
				/>
			))}
		</div>
	);
}

interface RecordingBarProps {
	status: RecorderStatus;
	isSpeechActive: boolean;
	elapsedSeconds: number;
	pendingCount: number;
	error: RecorderError | null;
	isToggling: boolean;
	onToggle: () => void;
}

function RecordingBar({
	status,
	isSpeechActive,
	elapsedSeconds,
	pendingCount,
	error,
	isToggling,
	onToggle,
}: RecordingBarProps) {
	const isRecording = status === "recording";
	const isVadLoading = status === "loading";
	const isDisabled = isToggling || isVadLoading;

	const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
	const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(
		2,
		"0",
	);
	const seconds = String(elapsedSeconds % 60).padStart(2, "0");

	const label = error
		? error.code === "permission"
			? "Mic blocked"
			: "Error"
		: isToggling
			? isRecording
				? "Stopping…"
				: "Connecting…"
			: isVadLoading
				? "Loading…"
				: isRecording
					? isSpeechActive
						? "Listening"
						: "Recording"
					: "Idle";

	return (
		<div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 bg-white">
			{isRecording && isSpeechActive ? (
				<WaveformBars />
			) : (
				<div className="flex items-end gap-[2px] h-[14px]" aria-hidden>
					{[6, 10, 8, 4, 11, 7, 9].map((h) => (
						<span
							key={`bar-static-${h}`}
							className={cn(
								"w-[3px] rounded-full",
								isRecording ? "bg-green-300" : "bg-gray-300",
							)}
							style={{ height: `${h}px` }}
						/>
					))}
				</div>
			)}
			<span
				className={cn(
					"text-sm font-medium flex-1",
					error ? "text-red-600" : "text-gray-800",
				)}
			>
				{label}
			</span>
			{isRecording && !isToggling && (
				<span className="inline-block size-2 rounded-full bg-red-500 animate-pulse" />
			)}
			{pendingCount > 0 && (
				<span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
					{pendingCount} pending
				</span>
			)}
			<span className="text-sm text-gray-400 tabular-nums">
				{hours}:{minutes}:{seconds}
			</span>
			<button
				type="button"
				onClick={onToggle}
				disabled={isDisabled}
				className={cn(
					"ml-1 flex items-center justify-center rounded-full size-7 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
					isRecording
						? "bg-red-100 text-red-600 hover:bg-red-200"
						: "bg-green-100 text-green-600 hover:bg-green-200",
				)}
				aria-label={isRecording ? "Stop recording" : "Start recording"}
			>
				{isToggling ? (
					<svg
						className="size-3.5 animate-spin"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<title>Loading</title>
						<circle
							className="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						/>
						<path
							className="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						/>
					</svg>
				) : isRecording ? (
					<svg
						className="size-3"
						viewBox="0 0 12 12"
						fill="currentColor"
						aria-hidden="true"
					>
						<title>Stop</title>
						<rect x="2" y="2" width="8" height="8" rx="1" />
					</svg>
				) : (
					<svg
						className="size-3"
						viewBox="0 0 12 12"
						fill="currentColor"
						aria-hidden="true"
					>
						<title>Record</title>
						<circle cx="6" cy="6" r="4" />
					</svg>
				)}
			</button>
		</div>
	);
}

function TranscriptItem({ chunk }: { chunk: TranscribedChunk }) {
	const parsed = parseInt(chunk.speaker.replace(/\D/g, ""), 10);
	const speakerIndex = Number.isNaN(parsed) ? 0 : parsed;
	const speakerLabel = `Speaker ${speakerIndex}`;
	const speakerColor =
		speakerIndex === 0
			? "text-blue-600"
			: speakerIndex === 1
				? "text-emerald-600"
				: "text-amber-600";
	const totalSeconds = Math.floor(chunk.startedAtMs / 1000);
	const time = `+${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;

	return (
		<div className="px-4 py-4">
			<div className="flex items-center gap-2 mb-1.5">
				<span className={cn("text-sm font-semibold", speakerColor)}>
					{speakerLabel}
				</span>
				<span className="inline-block size-1.5 rounded-full bg-green-500" />
				<span className="text-xs text-gray-400">{time}</span>
			</div>
			<p className="text-[17px] leading-relaxed text-gray-900">{chunk.text}</p>
		</div>
	);
}

function DetectedEntities({
	entities,
	onRemove,
}: {
	entities: DetectedEntity[];
	onRemove: (id: string) => void;
}) {
	return (
		<div className="border-t border-gray-100 bg-white px-4 pt-3 pb-4">
			<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2.5">
				Detected Entities
			</p>
			<div className="flex flex-wrap gap-2">
				{entities.map((entity) => {
					const s = entityStyles[entity.type];
					return (
						<span
							key={entity.id}
							className={cn(
								"inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium",
								s.chip,
								s.text,
							)}
						>
							{entity.label}
							{entity.code && (
								<span className={cn("ml-0.5 text-xs", s.codeText)}>
									({entity.code})
								</span>
							)}
							<button
								type="button"
								onClick={() => onRemove(entity.id)}
								className={cn(
									"ml-1 text-base leading-none hover:opacity-60 transition-opacity cursor-pointer",
									s.text,
								)}
								aria-label={`Remove ${entity.label}`}
							>
								×
							</button>
						</span>
					);
				})}
			</div>
		</div>
	);
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function TranscriptPanel() {
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [isToggling, setIsToggling] = useState(false);
	const [encounterError, setEncounterError] = useState<string | null>(null);
	const [entities, setEntities] = useState<DetectedEntity[]>(STATIC_ENTITIES);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const { chunks, setChairsideId, clearSession } = useTranscriptStore();
	const recorder = useAudioRecorder();
	const isRecording = recorder.status === "recording";

	useEffect(() => {
		if (isRecording) {
			tickRef.current = setInterval(
				() => setElapsedSeconds((s) => s + 1),
				1000,
			);
		} else {
			if (tickRef.current) {
				clearInterval(tickRef.current);
				tickRef.current = null;
			}
		}
		return () => {
			if (tickRef.current) {
				clearInterval(tickRef.current);
				tickRef.current = null;
			}
		};
	}, [isRecording]);

	const removeEntity = (id: string) =>
		setEntities((prev) => prev.filter((e) => e.id !== id));

	const handleToggle = async () => {
		setIsToggling(true);
		setEncounterError(null);
		try {
			if (isRecording) {
				await recorder.finalize();
				await recorder.stop();
			} else {
				const id = uuidv4();
				const response = await startEncounter({ chairside_id: id });
				if (response.status === StatusCode.SuccessOK) {
					clearSession();
					recorder.reset();
					setElapsedSeconds(0);
					setChairsideId(response.data.chairside_id);
					await recorder.start();
				} else {
					setEncounterError("Failed to start session. Please try again.");
				}
			}
		} catch {
			setEncounterError("Something went wrong. Please try again.");
		} finally {
			setIsToggling(false);
		}
	};

	return (
		<div className="flex flex-col w-[375px] h-full rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100">
			<div className="px-3 py-3 bg-gray-100">
				<div className="flex rounded-xl bg-gray-200/80 p-1">
					<button
						type="button"
						className="flex-1 py-2 rounded-lg bg-white shadow-sm text-sm font-semibold text-gray-900"
					>
						Transcript
					</button>
				</div>
			</div>

			<RecordingBar
				status={recorder.status}
				isSpeechActive={recorder.isSpeechActive}
				elapsedSeconds={elapsedSeconds}
				pendingCount={recorder.pendingCount}
				error={recorder.error}
				isToggling={isToggling}
				onToggle={handleToggle}
			/>

			{recorder.error && (
				<div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">
					{recorder.error.code === "permission"
						? "Microphone permission denied. Please allow mic access and try again."
						: recorder.error.message}
				</div>
			)}
			{encounterError && (
				<div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">
					{encounterError}
				</div>
			)}

			<ScrollArea className="h-[400px]">
				<div className="divide-y divide-gray-50">
					{chunks.length === 0 ? (
						<div className="px-4 py-6 text-center text-sm text-gray-400">
							{isRecording
								? "Listening… start speaking to see transcript."
								: "Start recording to begin transcript."}
						</div>
					) : (
						chunks.map((chunk) => (
							<TranscriptItem key={chunk.chunkId} chunk={chunk} />
						))
					)}
				</div>
			</ScrollArea>

			<DetectedEntities entities={entities} onRemove={removeEntity} />
		</div>
	);
}
