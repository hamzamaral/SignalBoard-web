import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
const base = process.env.SB_WEB_URL || 'http://127.0.0.1:5173';

const shots = [
  { name: 'login', path: '/login', before: null },
  { name: 'dashboard', path: '/', afterLogin: true },
  { name: 'listings-public', path: '/listings', afterLogin: true },
  { name: 'listings-private', path: '/private', afterLogin: true },
  { name: 'pipeline', path: '/pipeline', afterLogin: true },
  { name: 'calendar', path: '/reminders', afterLogin: true },
  { name: 'profile', path: '/profile', afterLogin: true },
  { name: 'admin', path: '/admin', afterLogin: true },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, 'login.png'), fullPage: false });

await page.fill('input[type="email"], input[name="email"], input', 'admin@signalboard.local');
const password = page.locator('input[type="password"]');
await password.fill('Admin123!');
await page.getByRole('button', { name: /Giriş/i }).click();
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(800);

for (const shot of shots) {
  if (shot.name === 'login') continue;
  await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  // Prefer listing detail if dashboard has a link
  if (shot.name === 'dashboard') {
    await page.screenshot({ path: path.join(outDir, 'dashboard.png'), fullPage: false });
    const first = page.locator('a[href^="/listings/"]').first();
    if (await first.count()) {
      await first.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, 'listing-detail.png'), fullPage: false });
    }
    continue;
  }
  await page.screenshot({ path: path.join(outDir, `${shot.name}.png`), fullPage: false });
}

await browser.close();
console.log('Screenshots written to', outDir);
