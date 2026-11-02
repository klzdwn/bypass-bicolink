import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { url } = req.body;
  if (!url || !url.includes('bicolink')) return res.status(400).json({ error: 'URL Bicolink required' });

  let browser;
  try {
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    // Buka link Bicolink
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Tunggu 8 detik buat nunggu iklan/timer selesai
    await page.waitForTimeout(8000); 

    // Trik: Cari semua tombol atau link, klik satu per satu
    const elements = await page.$$('button, a, .btn, [role="button"]');
    
    for (const el of elements) {
      try {
        // Cek apakah elemen beneran kelihatan dan bisa diklik
        const isVisible = await el.isVisible();
        if (isVisible) {
          await el.click();
          // Kasih jeda bentar abis klik
          await page.waitForTimeout(3000); 
          
          // Cek apakah URL udah berubah (berarti bypass berhasil)
          if (page.url() !== url) break; 
        }
      } catch (e) {
        // Abaikan kalau elemen nggak bisa diklik, lanjut ke elemen berikutnya
      }
    }

    // Ambil URL akhir
    const finalUrl = page.url();

    // Kalau masih sama, berarti bener-bener gagal
    if (finalUrl === url || finalUrl.includes('bicolink.com')) {
      return res.status(422).json({ error: 'Gagal bypass. Bicolink mungkin pakai captcha atau timer super lama.' });
    }

    return res.status(200).json({ success: true, destination: finalUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
