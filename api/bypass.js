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

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // NUNGGU CLOUDFLARE SELESAI (Maksimal 30 detik)
    // Kita cek terus apakah tulisan "Just a moment..." atau "Secure Connection" masih ada
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const title = await page.title();
      if (!title.includes('Just a moment') && !title.includes('Attention Required')) {
        break; // Keluar dari loop kalau Cloudflare udah lolos
      }
    }

    // Coba klik tombol
    const originalUrl = url;
    const elements = await page.$$('button, a, .btn, [role="button"]');
    
    for (const el of elements) {
      try {
        const isVisible = await el.isVisible();
        if (!isVisible) continue;

        const text = (await el.innerText()).toLowerCase();
        const href = await el.getAttribute('href') || '';

        if (text.includes('support') || text.includes('bantuan') || text.includes('daftar') || href.includes('t.me')) {
          continue; 
        }

        await el.click();
        await page.waitForTimeout(3000); 
        
        const currentUrl = page.url();
        if (currentUrl !== originalUrl && !currentUrl.includes('bicolink.com')) {
          break; 
        }
      } catch (e) {}
    }

    const finalUrl = page.url();

    if (finalUrl === originalUrl || finalUrl.includes('bicolink.com') || finalUrl.includes('t.me')) {
      const pageTitle = await page.title();
      return res.status(422).json({ 
        error: 'Masih diblokir Cloudflare atau tombol tidak muncul.',
        debug_title: pageTitle,
        debug_text: 'Jika judulnya masih "Just a moment", berarti Vercel gagal menembus Cloudflare.'
      });
    }

    return res.status(200).json({ success: true, destination: finalUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
