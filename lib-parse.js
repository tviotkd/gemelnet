// lib/parse.js
// Fetches one mygemel.net category page and extracts every comparison table
// on it into rows of [company, category, jun, year, y3, y5].
//
// Page structure (confirmed from a live snapshot, Aug 2026):
//   <h2>or<h3>קטגוריה/מסלול</h2>
//   <table> ... rows of חברה | תשואה חודש נוכחי | שנה | 3 שנים | 5 שנים ... </table>
// repeated for every track on the page. Company names are the first cell of
// each row; numeric cells carry a trailing "%" and are parsed as floats.

import * as cheerio from 'cheerio';

const PRODUCT_PAGES = {
  policy: 'https://www.mygemel.net/%D7%A4%D7%95%D7%9C%D7%99%D7%A1%D7%95%D7%AA-%D7%97%D7%99%D7%A1%D7%9B%D7%95%D7%9F',
  gemel_lehaskaa: 'https://www.mygemel.net/%D7%A7%D7%95%D7%A4%D7%AA-%D7%92%D7%9E%D7%9C-%D7%9C%D7%94%D7%A9%D7%A7%D7%A2%D7%94',
  hishtalmut: 'https://www.mygemel.net/%D7%A7%D7%A8%D7%A0%D7%95%D7%AA-%D7%94%D7%A9%D7%AA%D7%9C%D7%9E%D7%95%D7%AA',
  pension: 'https://www.mygemel.net/%D7%A4%D7%A0%D7%A1%D7%99%D7%94',
  gemel_regular: 'https://www.mygemel.net/%D7%A7%D7%95%D7%A4%D7%95%D7%AA-%D7%92%D7%9E%D7%9C',
  child_savings: 'https://www.mygemel.net/%D7%97%D7%99%D7%A1%D7%9B%D7%95%D7%9F-%D7%9C%D7%9B%D7%9C-%D7%99%D7%9C%D7%93',
};

function parsePercent(text) {
  const t = (text || '').replace(/[%,\s]/g, '').replace(/^\+/, '');
  if (t === '' || t === '-' || t === '—') return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

// Parses one page's HTML into { category: [[company, jun, year, y3, y5], ...] }
export function parsePageHtml(html) {
  const $ = cheerio.load(html);
  const result = [];
  $('table').each((_, table) => {
    const $table = $(table);
    // heading is the nearest preceding h2/h3
    let heading = null;
    let el = $table.prevAll('h2, h3').first();
    if (el.length) heading = el.text().trim();
    if (!heading) {
      // fall back to walking up parents and checking siblings
      heading = $table.closest('div').prevAll('h2, h3').first().text().trim() || 'ללא כותרת';
    }

    const rows = [];
    $table.find('tr').each((__, tr) => {
      const cells = $(tr).find('td, th').map((___, c) => $(c).text().trim()).get();
      if (cells.length < 2) return;
      const company = cells[0];
      if (!company || /^(חברה|קופה|גוף)/.test(company)) return; // skip header rows
      const nums = cells.slice(1).map(parsePercent);
      rows.push([company, ...nums.slice(0, 4)]);
    });
    if (rows.length) result.push({ heading, rows });
  });
  return result;
}

export async function fetchAndParseProduct(productKey) {
  const url = PRODUCT_PAGES[productKey];
  if (!url) throw new Error(`unknown product: ${productKey}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KD-InsBot/1.0)' } });
  if (!res.ok) throw new Error(`fetch failed for ${productKey}: ${res.status}`);
  const html = await res.text();
  return parsePageHtml(html);
}

export { PRODUCT_PAGES };
