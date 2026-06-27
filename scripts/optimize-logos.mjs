/**
 * Generate size-optimized brand PNGs from source assets in public/.
 * Run: node scripts/optimize-logos.mjs
 */
import sharp from 'sharp';
import { statSync, unlinkSync } from 'fs';
import { join } from 'path';

const PUBLIC = join(process.cwd(), 'public');
const SRC_ICON = join(PUBLIC, 'logo-icon.png');
const SRC_LOGO = join(PUBLIC, 'logo.png');

async function writePng(input, output, width, height) {
	const pipeline = sharp(input).resize(width, height, {
		fit: 'contain',
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	});
	const tmp = `${output}.tmp`;
	await pipeline.png({ compressionLevel: 9, palette: true }).toFile(tmp);
	await sharp(tmp).toFile(output);
	unlinkSync(tmp);
	const bytes = statSync(output).size;
	console.log(`${output.replace(PUBLIC + '/', '')}: ${width}x${height}, ${bytes} bytes`);
}

async function writeLogoWidth(input, output, width) {
	const meta = await sharp(input).metadata();
	const height = Math.round((meta.height / meta.width) * width);
	const tmp = `${output}.tmp`;
	await sharp(input)
		.resize(width, height, { fit: 'inside', withoutEnlargement: true })
		.png({ compressionLevel: 9, palette: true })
		.toFile(tmp);
	await sharp(tmp).toFile(output);
	unlinkSync(tmp);
	const bytes = statSync(output).size;
	console.log(`${output.replace(PUBLIC + '/', '')}: ${width}x${height}, ${bytes} bytes`);
}

async function writeMaskableIcon(input, output, size) {
	const iconSize = Math.round(size * 0.62);
	const offset = Math.round((size - iconSize) / 2);
	const icon = await sharp(input)
		.resize(iconSize, iconSize, {
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png()
		.toBuffer();
	const tmp = `${output}.tmp`;
	await sharp({
		create: {
			width: size,
			height: size,
			channels: 4,
			background: { r: 26, g: 47, b: 58, alpha: 1 },
		},
	})
		.composite([{ input: icon, top: offset, left: offset }])
		.png({ compressionLevel: 9, palette: true })
		.toFile(tmp);
	await sharp(tmp).toFile(output);
	unlinkSync(tmp);
	const bytes = statSync(output).size;
	console.log(`${output.replace(PUBLIC + '/', '')}: ${size}x${size} maskable, ${bytes} bytes`);
}

async function main() {
	await writePng(SRC_ICON, join(PUBLIC, 'logo-icon-32.png'), 32, 32);
	await writePng(SRC_ICON, join(PUBLIC, 'logo-icon-192.png'), 192, 192);
	await writeMaskableIcon(SRC_ICON, join(PUBLIC, 'logo-icon-192-maskable.png'), 192);
	await writePng(SRC_ICON, join(PUBLIC, 'logo-icon-512.png'), 512, 512);
	await writeLogoWidth(SRC_LOGO, join(PUBLIC, 'logo.png'), 560);
	await writePng(SRC_ICON, join(PUBLIC, 'logo-pdf-icon.png'), 64, 64);
	await writeLogoWidth(SRC_LOGO, join(PUBLIC, 'logo-pdf.png'), 400);
	await writePng(SRC_ICON, join(PUBLIC, 'favicon-32x32.png'), 32, 32);
	await writePng(SRC_ICON, join(PUBLIC, 'apple-touch-icon.png'), 180, 180);

	// Replace legacy full-size files with optimized versions
	await writePng(SRC_ICON, join(PUBLIC, 'logo-icon.png'), 192, 192);
	await writeLogoWidth(SRC_LOGO, join(PUBLIC, 'logo.png'), 560);

	for (const file of ['favicon.png', 'logo-white.png']) {
		try {
			unlinkSync(join(PUBLIC, file));
			console.log(`removed ${file}`);
		} catch {
			// already gone
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
