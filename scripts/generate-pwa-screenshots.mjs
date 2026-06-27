/**
 * Generate PWA install-dialog screenshots from branded SVG mockups.
 * Run: node scripts/generate-pwa-screenshots.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const PUBLIC = join(process.cwd(), 'public');
const OUT_DIR = join(PUBLIC, 'screenshots');

const BRAND = {
	bg: '#F8FAFC',
	sidebar: '#1A2F3A',
	primary: '#5B9AB8',
	card: '#FFFFFF',
	border: '#E5E7EB',
	text: '#1F2937',
	muted: '#6B7280',
};

function desktopSvg() {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="${BRAND.bg}"/>
  <rect width="220" height="720" fill="${BRAND.sidebar}"/>
  <rect x="24" y="28" width="120" height="28" rx="6" fill="${BRAND.primary}" opacity="0.9"/>
  <rect x="16" y="88" width="188" height="36" rx="8" fill="${BRAND.primary}"/>
  <rect x="16" y="136" width="188" height="32" rx="8" fill="white" opacity="0.08"/>
  <rect x="16" y="176" width="188" height="32" rx="8" fill="white" opacity="0.08"/>
  <rect x="16" y="216" width="188" height="32" rx="8" fill="white" opacity="0.08"/>
  <rect x="16" y="256" width="188" height="32" rx="8" fill="white" opacity="0.08"/>
  <text x="252" y="56" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="${BRAND.text}">Dashboard</text>
  <rect x="252" y="84" width="996" height="120" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="276" y="108" width="180" height="16" rx="4" fill="${BRAND.muted}" opacity="0.35"/>
  <rect x="276" y="136" width="120" height="40" rx="8" fill="${BRAND.primary}" opacity="0.15"/>
  <rect x="276" y="224" width="310" height="180" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="300" y="248" width="140" height="14" rx="4" fill="${BRAND.text}" opacity="0.8"/>
  <rect x="300" y="276" width="260" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="300" y="296" width="220" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="300" y="316" width="180" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="586" y="224" width="310" height="180" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="610" y="248" width="140" height="14" rx="4" fill="${BRAND.text}" opacity="0.8"/>
  <rect x="610" y="276" width="260" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="610" y="296" width="220" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="920" y="224" width="328" height="380" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="944" y="248" width="160" height="14" rx="4" fill="${BRAND.text}" opacity="0.8"/>
  <rect x="944" y="280" width="280" height="48" rx="8" fill="${BRAND.bg}"/>
  <rect x="944" y="344" width="280" height="48" rx="8" fill="${BRAND.bg}"/>
  <rect x="944" y="408" width="280" height="48" rx="8" fill="${BRAND.bg}"/>
  <rect x="252" y="424" width="636" height="180" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="276" y="448" width="200" height="14" rx="4" fill="${BRAND.text}" opacity="0.8"/>
  <rect x="276" y="476" width="588" height="10" rx="3" fill="${BRAND.muted}" opacity="0.2"/>
  <rect x="276" y="496" width="588" height="10" rx="3" fill="${BRAND.muted}" opacity="0.2"/>
  <rect x="276" y="516" width="588" height="10" rx="3" fill="${BRAND.muted}" opacity="0.2"/>
</svg>`;
}

function mobileSvg() {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1334" viewBox="0 0 750 1334">
  <rect width="750" height="1334" fill="${BRAND.bg}"/>
  <rect width="750" height="88" fill="${BRAND.sidebar}"/>
  <rect x="20" y="28" width="100" height="24" rx="5" fill="${BRAND.primary}" opacity="0.9"/>
  <rect x="650" y="30" width="80" height="28" rx="8" fill="white" opacity="0.1"/>
  <text x="24" y="132" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="${BRAND.text}">Tasks</text>
  <rect x="24" y="156" width="702" height="148" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="44" y="180" width="220" height="14" rx="4" fill="${BRAND.text}" opacity="0.85"/>
  <rect x="44" y="206" width="180" height="10" rx="3" fill="${BRAND.muted}" opacity="0.3"/>
  <rect x="44" y="228" width="140" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="44" y="258" width="96" height="28" rx="8" fill="${BRAND.primary}" opacity="0.15"/>
  <rect x="24" y="320" width="702" height="148" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="44" y="344" width="240" height="14" rx="4" fill="${BRAND.text}" opacity="0.85"/>
  <rect x="44" y="370" width="200" height="10" rx="3" fill="${BRAND.muted}" opacity="0.3"/>
  <rect x="44" y="392" width="160" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="44" y="422" width="96" height="28" rx="8" fill="${BRAND.primary}" opacity="0.15"/>
  <rect x="24" y="484" width="702" height="148" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="44" y="508" width="200" height="14" rx="4" fill="${BRAND.text}" opacity="0.85"/>
  <rect x="44" y="534" width="180" height="10" rx="3" fill="${BRAND.muted}" opacity="0.3"/>
  <rect x="44" y="556" width="150" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
  <rect x="24" y="648" width="702" height="148" rx="16" fill="${BRAND.card}" stroke="${BRAND.border}"/>
  <rect x="44" y="672" width="210" height="14" rx="4" fill="${BRAND.text}" opacity="0.85"/>
  <rect x="44" y="698" width="190" height="10" rx="3" fill="${BRAND.muted}" opacity="0.3"/>
  <rect x="44" y="720" width="170" height="10" rx="3" fill="${BRAND.muted}" opacity="0.25"/>
</svg>`;
}

async function writeScreenshot(name, svg, width, height) {
	const output = join(OUT_DIR, name);
	await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(output);
	console.log(`${output.replace(PUBLIC + '/', '')}: ${width}x${height}`);
}

async function main() {
	mkdirSync(OUT_DIR, { recursive: true });
	await writeScreenshot('desktop.png', desktopSvg(), 1280, 720);
	await writeScreenshot('mobile.png', mobileSvg(), 750, 1334);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
