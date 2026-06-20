import { timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison to avoid leaking secrets via response timing. */
export function safeEqual(a, b) {
	const bufA = Buffer.from(String(a ?? ''), 'utf8');
	const bufB = Buffer.from(String(b ?? ''), 'utf8');
	// timingSafeEqual throws on length mismatch; compare against a same-length buffer
	// so the early return doesn't itself become a timing oracle on length.
	if (bufA.length !== bufB.length) {
		timingSafeEqual(bufA, bufA);
		return false;
	}
	return timingSafeEqual(bufA, bufB);
}
