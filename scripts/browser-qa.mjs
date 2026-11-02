import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('.qa', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [name, width, height] of [['phone', 375, 812], ['desktop', 1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.route('https://api.frankfurter.dev/**', async (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        date: '2026-11-02', base: 'USD', quote: 'EGP', rate: 50,
      }) }));
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.getByText('1 USD = 50.0000 EGP').waitFor();
    await page.getByLabel('Unit Price').fill('100');
    await page.getByLabel('Profit %').fill('30');
    await page.getByRole('button', { name: 'Calculate Final Price' }).click();
    await page.locator('.final-number').getByText('6,500.00').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error(`${name} viewport has horizontal overflow`);
    await page.screenshot({ path: `.qa/${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    if (await page.locator('html').getAttribute('data-theme') !== 'dark') {
      throw new Error(`${name} dark theme did not activate`);
    }
    await page.waitForTimeout(300);
    if (name === 'phone') await page.screenshot({ path: '.qa/phone-dark.png', fullPage: true });
    console.log(`${name}: calculation and responsive width passed`);
    await page.close();
  }
} finally { await browser.close(); }
