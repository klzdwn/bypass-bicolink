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

    // Tunggu 5 detik buat nunggu iklan/timer
    await page.waitForTimeout(5000); 

    // Ambil screenshot pertama
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    
    // Upload screenshot ke 0x0.st biar bisa dilihat dari HP
    const formData = new FormData();
    formData.append('file', new Blob([screenshotBuffer], { type: 'image/png' }), 'bicolink.png');
    
    let imageUrl = '';
    try {
      const uploadRes = await fetch('https://0x0.st', { method: 'POST', body: formData });
      imageUrl = await uploadRes.text();
    } catch (e) {
      imageUrl = 'Gagal upload gambar';
    }

    // Trik: Cari semua tombol atau link, klik satu per satu
    const elements = await page.$$('button, a, .btn, [role="button"]');
    for (const el of elements) {
      try {
        if (await el.isVisible()) {
          await el.click();
          await page.waitForTimeout(2000); 
          if (page.url() !== url) break; 
        }
      } catch (e) {}
    }

    const finalUrl = page.url();

    if (finalUrl === url || finalUrl.includes('bicolink.com')) {
      return res.status(422).json({ 
        error: 'Gagal bypass. Cek screenshot untuk lihat tampilan Bicolink.',
        screenshot: imageUrl.trim()
      });
    }

    return res.status(200).json({ success: true, destination: finalUrl, screenshot: imageUrl.trim() });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
