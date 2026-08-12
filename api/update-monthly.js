// api/update-monthly.js
// Runs automatically on the 2nd of every month (see vercel.json) — mygemel.net
// itself updates around month-start, so this gives it a day's buffer.
// Scrapes all 6 product pages, normalizes every table into
// [company, category, jun, year, y3, y5] rows, and stores the result in
// Vercel Blob so the frontend can fetch it without hitting mygemel.net directly.

import { put } from '@vercel/blob';
import { fetchAndParseProduct, PRODUCT_PAGES } from '../lib/parse.js';

const LABELS = {
  policy: 'פוליסת חיסכון',
  gemel_lehaskaa: 'גמל להשקעה',
  hishtalmut: 'קרן השתלמות',
  pension: 'קרן פנסיה',
  gemel_regular: 'קופת גמל',
};

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const productData = {};
  const errors = [];

  for (const key of Object.keys(PRODUCT_PAGES)) {
    try {
      const tables = await fetchAndParseProduct(key);
      const returns = [];
      for (const { heading, rows } of tables) {
        for (const row of rows) {
          const [company, jun, year, y3, y5] = row;
          returns.push([company, heading, jun ?? null, year ?? null, y3 ?? null, y5 ?? null]);
        }
      }
      productData[key] = { label: LABELS[key], returns };
    } catch (err) {
      errors.push({ product: key, error: String(err) });
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'mygemel.net',
    productData,
  };

  try {
    const blob = await put('gemel-data.json', JSON.stringify(payload), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return res.status(200).json({ ok: true, url: blob.url, errors, updatedAt: payload.updatedAt });
  } catch (err) {
    return res.status(500).json({ error: String(err), errors });
  }
}
