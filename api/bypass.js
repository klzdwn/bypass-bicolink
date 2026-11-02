// api/bypass.js
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  // Cuma izinin POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url || !url.includes('bicolink')) {
    return res.status(400).json({ error: 'URL Bicolink valid required' });
  }

  let browser;
  try {
    // Launch Chromium yang udah dioptimasi buat serverless
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    // Blokir resource berat biar cepet & hemat memory
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Buka halaman Bicolink
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // ============================================================
    // INI BAGIAN YANG LU HARUS ISI SENDIRI
    // Gua nggak tau struktur DOM Bicolink yang sekarang.
    // Lu harus inspect element di browser, cari selector tombol/elemen
    // yang memicu redirect ke tujuan akhir, lalu tulis logikanya di sini.
    //
    // Contoh (BAKAL GAGAL kalau selector-nya salah):
    // await page.click('#tombol-final');
    // await page.waitForTimeout(3000);
    // ============================================================

    // Setelah lu trigger bypass-nya, ambil URL akhir
    // Kalau Bicolink redirect, page.url() bakal berubah
    // Tapi kalau redirect-nya di tab baru, lu perlu handle 'popup' event
    const finalUrl = page.url();

    // Kalau URL masih sama dengan input, berarti bypass gagal
    if (finalUrl === url) {
      return res.status(422).json({ 
        error: 'Bypass failed. Selector logic not implemented or Bicolink changed.' 
      });
    }

    return res.status(200).json({ success: true, destination: finalUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
