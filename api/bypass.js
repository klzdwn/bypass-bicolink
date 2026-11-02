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

    // Tunggu 15 detik (kasih waktu timer/iklan selesai)
    await page.waitForTimeout(15000); 

    // --- FITUR MATA-MATA (SCREENSHOT) ---
    let imageUrl = 'Gagal mengambil gambar';
    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      const formData = new FormData();
      formData.append('file', new Blob([screenshotBuffer], { type: 'image/png' }), 'bicolink.png');
      
      const uploadRes = await fetch('https://0x0.st', { method: 'POST', body: formData });
      imageUrl = await uploadRes.text();
    } catch (e) {
      console.error('Upload error:', e);
    }
    // ------------------------------------

    // Coba klik tombol
    const originalUrl = url;
    const elements = await page.$$('button, a, .btn, [role="button"]');
    
    for (const el of elements) {
      try {
        const isVisible = await el.isVisible();
        if (!isVisible) continue;

        const text = (await el.innerText()).toLowerCase();
        const href = await el.getAttribute('href') || '';

        // Skip tombol yang bukan tujuan
        if (text.includes('support') || text.includes('bantuan') || text.includes('daftar') || text.includes('masuk') || href.includes('t.me')) {
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

    // Kalau gagal, kirim screenshot-nya ke web lu
    if (finalUrl === originalUrl || finalUrl.includes('bicolink.com') || finalUrl.includes('t.me')) {
      return res.status(422).json({ 
        error: 'Gagal bypass. Tombol tujuan asli belum muncul atau masih tersembunyi.',
        screenshot: imageUrl.trim()
      });
    }

    return res.status(200).json({ success: true, destination: finalUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
