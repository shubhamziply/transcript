import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
	RecorderError,
	RecorderStatus,
	TranscribedChunk,
} from "@/lib/recording/types";
import { useAudioRecorder } from "@/lib/recording/useAudioRecorder";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type EntityType = "tooth" | "tooth-ref" | "surface" | "procedure";

interface DetectedEntity {
	id: string;
	label: string;
	code?: string;
	type: EntityType;
}

interface TextSegment {
	text: string;
	entityType?: EntityType;
}

interface TranscriptMessage {
	id: string;
	speaker: "doctor" | "patient";
	speakerName: string;
	time: string;
	segments: TextSegment[];
}

// ── Style map ────────────────────────────────────────────────────────────────

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

// ── Static data ──────────────────────────────────────────────────────────────

const MESSAGES: TranscriptMessage[] = [
	{
		id: "m1",
		speaker: "doctor",
		speakerName: "Dr. Martinez",
		time: "9:15 AM",
		segments: [{ text: "Good morning Sarah. How are you feeling today?" }],
	},
	{
		id: "m2",
		speaker: "patient",
		speakerName: "Patient",
		time: "9:15 AM",
		segments: [
			{
				text: "Good morning. I have been having some sensitivity on my upper left side when I eat cold foods.",
			},
		],
	},
	{
		id: "m3",
		speaker: "doctor",
		speakerName: "Dr. Martinez",
		time: "9:18 AM",
		segments: [
			{ text: "Let me take a look. I see on " },
			{ text: "tooth fourteen", entityType: "tooth" },
			{ text: " there is some decay on the " },
			{ text: "mesial and occlusal", entityType: "surface" },
			{ text: " surfaces. We will need to do a " },
			{ text: "crown", entityType: "procedure" },
			{ text: " to restore this tooth properly." },
		],
	},
	{
		id: "m4",
		speaker: "patient",
		speakerName: "Patient",
		time: "9:19 AM",
		segments: [{ text: "Will that be covered by my insurance?" }],
	},
	{
		id: "m5",
		speaker: "doctor",
		speakerName: "Dr. Martinez",
		time: "9:20 AM",
		segments: [
			{ text: "Most plans cover about 50% for a " },
			{ text: "D2750", entityType: "procedure" },
			{
				text: " crown. Let me have my front desk check your specific coverage and benefits.",
			},
		],
	},
];

const INITIAL_ENTITIES: DetectedEntity[] = [
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
	onToggle: () => void;
}

function RecordingBar({
	status,
	isSpeechActive,
	elapsedSeconds,
	pendingCount,
	error,
	onToggle,
}: RecordingBarProps) {
	const isRecording = status === "recording";
	const isLoading = status === "loading";

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
		: isLoading
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
			{isRecording && (
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
				disabled={isLoading}
				className={cn(
					"ml-1 flex items-center justify-center rounded-full size-7 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
					isRecording
						? "bg-red-100 text-red-600 hover:bg-red-200"
						: "bg-green-100 text-green-600 hover:bg-green-200",
				)}
				aria-label={isRecording ? "Stop recording" : "Start recording"}
			>
				{isRecording ? (
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

function InlineEntityChip({ text, type }: { text: string; type: EntityType }) {
	const s = entityStyles[type];
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.9em] font-medium leading-snug mx-0.5",
				s.chip,
				s.text,
			)}
		>
			{text}
		</span>
	);
}

function MessageItem({ message }: { message: TranscriptMessage }) {
	const isDoctor = message.speaker === "doctor";
	return (
		<div className="px-4 py-4">
			<div className="flex items-center gap-2 mb-1.5">
				<span
					className={cn(
						"text-sm font-semibold",
						isDoctor ? "text-blue-600" : "text-gray-400",
					)}
				>
					{message.speakerName}
				</span>
				<span className="inline-block size-1.5 rounded-full bg-green-500" />
				<span className="text-xs text-gray-400">{message.time}</span>
			</div>
			<p className="text-[17px] leading-relaxed text-gray-900">
				{message.segments.map((seg, i) =>
					seg.entityType ? (
						<InlineEntityChip
							key={`seg-${i}-${seg.text}`}
							text={seg.text}
							type={seg.entityType}
						/>
					) : (
						<span key={`seg-${i}-${seg.text}`}>{seg.text}</span>
					),
				)}
			</p>
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

function LiveMessageItem({ chunk }: { chunk: TranscribedChunk }) {
	const speakerNum = parseInt(chunk.speaker.replace(/\D/g, ""), 10) || 1;
	const speakerColor =
		speakerNum === 1
			? "text-blue-600"
			: speakerNum === 2
				? "text-emerald-600"
				: "text-amber-600";
	const time = formatChunkTime(chunk.startedAtMs);
	return (
		<div className="px-4 py-4">
			<div className="flex items-center gap-2 mb-1.5">
				<span className={cn("text-sm font-semibold", speakerColor)}>
					{chunk.speaker}
				</span>
				<span className="inline-block size-1.5 rounded-full bg-green-500" />
				<span className="text-xs text-gray-400">{time}</span>
			</div>
			<p className="text-[17px] leading-relaxed text-gray-900">{chunk.text}</p>
		</div>
	);
}

function formatChunkTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `+${m}:${String(s).padStart(2, "0")}`;
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function TranscriptPanel() {
	const [entities, setEntities] = useState<DetectedEntity[]>(INITIAL_ENTITIES);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const recorder = useAudioRecorder();
	const isRecording = recorder.status === "recording";

	useEffect(() => {
		if (isRecording) {
			tickRef.current = setInterval(
				() => setElapsedSeconds((s) => s + 1),
				1000,
			);
		} else if (tickRef.current) {
			clearInterval(tickRef.current);
			tickRef.current = null;
		}
		return () => {
			if (tickRef.current) {
				clearInterval(tickRef.current);
				tickRef.current = null;
			}
		};
	}, [isRecording]);

	const handleToggle = async () => {
		if (isRecording) {
			await recorder.stop();
		} else {
			setElapsedSeconds(0);
			recorder.reset();
			await recorder.start();
		}
	};

	const removeEntity = (id: string) =>
		setEntities((prev) => prev.filter((e) => e.id !== id));

	const showLive = recorder.chunks.length > 0 || isRecording;

	return (
		<div className="flex flex-col w-[375px] h-full rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100">
			{/* Segmented header */}
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
				onToggle={handleToggle}
			/>

			{recorder.error && (
				<div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">
					{recorder.error.code === "permission"
						? "Microphone permission denied. Please allow mic access and try again."
						: recorder.error.message}
				</div>
			)}

			<ScrollArea className="h-[400px]">
				<div className="divide-y divide-gray-50">
					{showLive ? (
						recorder.chunks.length === 0 ? (
							<div className="px-4 py-6 text-center text-sm text-gray-400">
								Listening… start speaking to see transcript.
							</div>
						) : (
							recorder.chunks.map((chunk) => (
								<LiveMessageItem key={chunk.chunkId} chunk={chunk} />
							))
						)
					) : (
						MESSAGES.map((msg) => <MessageItem key={msg.id} message={msg} />)
					)}
				</div>
			</ScrollArea>

			<DetectedEntities entities={entities} onRemove={removeEntity} />
		</div>
	);
}
