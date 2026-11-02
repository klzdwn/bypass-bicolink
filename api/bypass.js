import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { url } = req.body;
  if (!url || !url.includes('bicolink')) return res.status(400).json({ error: 'URL Bicolink required' });

  let browser;
  try {
    // 1. Buka browser headless
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    // 2. Buka link Bicolink
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 3. Tunggu dan klik tombol secara otomatis
    // Kita coba cari tombol yang biasanya ada di safelink (lanjut, get link, dll)
    const possibleSelectors = [
      'button:has-text("Lanjut")',
      'button:has-text("Get Link")',
      'button:has-text("Buka")',
      'a:has-text("Lanjut")',
      'a:has-text("Get Link")',
      '#btn-submit',
      '.btn-primary'
    ];

    let clicked = false;
    for (const selector of possibleSelectors) {
      try {
        // Cek apakah tombol ada dan bisa diklik
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click();
          clicked = true;
          break;
        }
      } catch (e) {
        // Abaikan kalau nggak ketemu, lanjut cek selector lain
      }
    }

    // 4. Tunggu proses redirect
    if (clicked) {
      await page.waitForTimeout(5000); // Tunggu 5 detik buat loading
    }

    // 5. Ambil URL akhir
    const finalUrl = page.url();

    // Kalau URL nggak berubah, berarti script gagal ngeklik atau Bicolink ngubah sistem
    if (finalUrl === url) {
      return res.status(422).json({ error: 'Gagal bypass. Tombol nggak ketemu atau timer belum habis.' });
    }

    return res.status(200).json({ success: true, destination: finalUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
