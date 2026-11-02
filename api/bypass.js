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
      headless: true, // Tetap headless, tapi kita manipulasi user agent-nya
    });

    const context = await browser.newContext({
      // Nyamar jadi HP Android (Samsung Galaxy)
      userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
    });

    const page = await context.newPage();
    
    // Buka link Bicolink
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Tunggu 15 detik
    await page.waitForTimeout(15000); 

    // TRIK AGRESIF: Eksekusi JavaScript langsung di dalam halaman untuk ngeklik semua tombol
    await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, .btn, [role="button"], input[type="submit"]');
      for (const el of elements) {
        const text = (el.innerText || el.value || '').toLowerCase();
        // Jangan klik tombol support/telegram
        if (text.includes('support') || text.includes('bantuan') || text.includes('daftar')) continue;
        
        // Paksa klik
        try { el.click(); } catch (e) {}
      }
    });

    // Tunggu bentar buat proses redirect
    await page.waitForTimeout(5000); 

    const finalUrl = page.url();

    if (finalUrl === url || finalUrl.includes('bicolink.com') || finalUrl.includes('t.me')) {
      // Kalau gagal, ambil potongan HTML-nya buat kita cek
      const pageTitle = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200)); // Ambil 200 huruf pertama
      
      return res.status(422).json({ 
        error: 'Gagal bypass. Cek detail di bawah.',
        debug_title: pageTitle,
        debug_text: bodyText
      });
    }

    return res.status(200).json({ success: true, destination: finalUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
