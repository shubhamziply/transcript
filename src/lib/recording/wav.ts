/**
 * Converts a Float32Array of audio samples (range -1 to 1) to raw 16-bit
 * signed integer PCM: mono, 16000 Hz, little-endian, no container/header.
 */
export function float32ToInt16PCM(samples: Float32Array): Int16Array {
	const out = new Int16Array(samples.length);
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
	return out;
}
