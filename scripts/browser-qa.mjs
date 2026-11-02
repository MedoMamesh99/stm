import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('.qa', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [name, width, height] of [['narrow-phone', 320, 700], ['phone', 375, 812], ['desktop', 1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.route('https://api.frankfurter.dev/**', async (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        date: '2026-11-02', base: 'SAR', quote: 'EGP', rate: 12,
      }) }));
    await page.goto('http://127.0.0.1:4173/stm/', { waitUntil: 'networkidle' });
    if (await page.locator('.brand-title').textContent() !== 'STM') throw new Error(`${name} brand has extra text`);
    if (await page.locator('header .header-language button').count() !== 2) throw new Error(`${name} header language controls are missing`);
    if (await page.locator('footer .header-language').count() !== 0) throw new Error(`${name} footer language controls remain`);
    if (await page.locator('header .theme-toggle').textContent() !== '') throw new Error(`${name} theme control has visible text`);
    await page.getByText('1 SAR = 12.0000 EGP').waitFor();
    await page.getByLabel('Unit Price').fill('100');
    await page.getByLabel('Profit %').fill('30');
    await page.getByRole('button', { name: 'Calculate Final Price' }).click();
    await page.locator('.final-number').getByText('1,560.00').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error(`${name} viewport has horizontal overflow`);
    await page.screenshot({ path: `.qa/${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    if (await page.locator('html').getAttribute('data-theme') !== 'dark') {
      throw new Error(`${name} dark theme did not activate`);
    }
    await page.getByRole('button', { name: 'العربية' }).click();
    if (await page.locator('html').getAttribute('dir') !== 'rtl') {
      throw new Error(`${name} Arabic layout did not activate`);
    }
    await page.getByRole('textbox', { name: 'سعر الوحدة' }).waitFor();
    const rtlOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (rtlOverflow) throw new Error(`${name} Arabic viewport has horizontal overflow`);
    await page.waitForTimeout(300);
    if (name === 'phone') await page.screenshot({ path: '.qa/phone-dark.png', fullPage: true });
    console.log(`${name}: calculation and responsive width passed`);
    await page.close();
  }
} finally { await browser.close(); }
