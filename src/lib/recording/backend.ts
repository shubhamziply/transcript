import { StatusCode } from "@tavali-ai/shared-utils/enums";
import type { TranscribeChunkResponseModel } from "@tavali-ai/shared-utils/models";
import { transcribeChunk as transcribeChunkApi } from "@tavali-ai/shared-utils/service";
import type { AudioChunk } from "./types";

export async function transcribeChunkViaService(
	chunk: AudioChunk,
	chairsideId: string,
	chunkNumber: number,
): Promise<TranscribeChunkResponseModel> {
	const pcmBlob = new Blob([chunk.audio.buffer as ArrayBuffer], {
		type: "audio/pcm",
	});
	const form = new FormData();
	form.append("chairside_id", chairsideId);
	form.append("chunk_number", String(chunkNumber));
	form.append("is_last", "false");
	form.append("audio", pcmBlob, `${chunk.id}.pcm`);

	const response = await transcribeChunkApi(form);
	if (response.status !== StatusCode.SuccessOK) {
		throw new Error(`Transcription failed: ${response.message}`);
	}
	return response.data;
}

export async function finalizeTranscription(
	chairsideId: string,
	chunkNumber: number,
): Promise<TranscribeChunkResponseModel> {
	// Silent 10ms PCM buffer (160 samples × 2 bytes at 16kHz) required by the API
	const silentAudio = new Int16Array(160);
	const silentBlob = new Blob([silentAudio.buffer], { type: "audio/pcm" });

	const form = new FormData();
	form.append("chairside_id", chairsideId);
	form.append("chunk_number", String(chunkNumber));
	form.append("is_last", "true");
	form.append("audio", silentBlob, "final.pcm");

	const response = await transcribeChunkApi(form);
	if (response.status !== StatusCode.SuccessOK) {
		throw new Error(`Finalize failed: ${response.message}`);
	}
	return response.data;
}
