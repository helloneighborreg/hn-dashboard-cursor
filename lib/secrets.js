/**
 * Symmetric encryption for secrets stored at rest (e.g. the Plaid access_token).
 *
 * Uses AES-256-GCM with a key derived from BANK_TOKEN_ENC_KEY. Stored values are
 * tagged with a version prefix so reads can transparently handle legacy plaintext
 * rows written before encryption was enabled.
 *
 * If BANK_TOKEN_ENC_KEY is unset, values are stored as-is (back-compat). Set the env
 * var to any strong random string to enable encryption — it is hashed to 32 bytes.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function getKey() {
	const raw = (process.env.BANK_TOKEN_ENC_KEY || '').trim();
	if (!raw) return null;
	return createHash('sha256').update(raw).digest();
}

export function secretsEncryptionEnabled() {
	return Boolean(getKey());
}

export function encryptSecret(plaintext) {
	if (plaintext == null || plaintext === '') return plaintext;
	const value = String(plaintext);
	if (value.startsWith(PREFIX)) return value; // already encrypted
	const key = getKey();
	if (!key) return value; // back-compat: no key configured
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(value) {
	if (value == null || value === '') return value;
	const s = String(value);
	if (!s.startsWith(PREFIX)) return value; // legacy plaintext
	const key = getKey();
	if (!key) {
		throw new Error('BANK_TOKEN_ENC_KEY is required to decrypt stored credentials.');
	}
	const [ivB64, tagB64, dataB64] = s.slice(PREFIX.length).split(':');
	const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
	decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
	const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
	return dec.toString('utf8');
}
