/**
 * Remove alt attributes from all <img> tags in listed Vue files.
 * Usage: node remove-all-img-alt.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
	'src/views/HomePage.vue',
	'src/views/MyOrders.vue',
	'src/views/OrderDetail.vue',
	'src/views/OrderDetailNew.vue',
	'src/views/OrderDetailNew2.vue',
	'src/views/OrderDetailNew3.vue',
];

const ALT_RE = /(<img[^>]*?)\s+alt=["'][^"']*["']([^>]*>)/g;

for (const rel of files) {
	const filePath = path.join(__dirname, rel);
	if (!fs.existsSync(filePath)) {
		console.warn(`Skip (missing): ${rel}`);
		continue;
	}
	const content = fs.readFileSync(filePath, 'utf8');
	const count = (content.match(/(<img[^>]*?)\s+alt=["'][^"']*["']/g) || []).length;
	if (count === 0) {
		console.log(`${rel}: no alt tags`);
		continue;
	}
	const backup = `${filePath}.backup-alt`;
	if (!fs.existsSync(backup)) {
		fs.writeFileSync(backup, content);
	}
	const replaced = content.replace(ALT_RE, '$1$2');
	fs.writeFileSync(filePath, replaced);
	console.log(`${rel}: removed ${count} alt tag(s)`);
}

console.log('Done.');
