#!/usr/bin/env node
// Renders a Bforever receipt from a JSON file into a PNG (and the HTML used to draw it).
//
//   node tools/receipt/make-receipt.js business/receipts/BF-0001.json
//
// Writes BF-0001.png next to the JSON. All money math (subtotal, discount,
// total, paid, balance) is done here, never by hand.

const fs = require('fs');
const path = require('path');

const THEMES = {
  maroon:  { ink: '#5a1a2b', accent: '#b08a3e', paper: '#fbf6ee', soft: '#f3e7d6', text: '#2b1d1a' },
  emerald: { ink: '#14463a', accent: '#b8955a', paper: '#f7f5ee', soft: '#e5ece4', text: '#1b2622' },
  rose:    { ink: '#8a3b55', accent: '#c2996b', paper: '#fdf6f5', soft: '#f6e4e4', text: '#2e1f22' },
  royal:   { ink: '#232d5c', accent: '#b8955a', paper: '#f8f6f1', soft: '#e6e7f0', text: '#1b1d2a' },
  noir:    { ink: '#1d1b1a', accent: '#a8874a', paper: '#faf8f4', soft: '#ece7de', text: '#1d1b1a' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Indian digit grouping: 150000 -> 1,50,000
function inr(n) {
  const neg = n < 0; n = Math.abs(Math.round(n * 100) / 100);
  const [whole, frac] = n.toFixed(2).split('.');
  const last3 = whole.slice(-3), rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (neg ? '-' : '') + '₹' + grouped + (frac === '00' ? '' : '.' + frac);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function compute(r) {
  const items = (r.items || []).map((it) => {
    const qty = Number(it.qty ?? 1), rate = Number(it.rate);
    if (!Number.isFinite(rate)) throw new Error(`Item "${it.name}" has no valid rate`);
    return { ...it, qty, rate, amount: qty * rate };
  });
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const discount = Number(r.discount || 0);
  const total = subtotal - discount;
  const payments = (r.payments || []).map((p) => ({ ...p, amount: Number(p.amount) }));
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { items, subtotal, discount, total, payments, paid, balance: total - paid };
}

function render(r, settings, fontDir) {
  const t = THEMES[r.theme || settings.theme || 'maroon'] || THEMES.maroon;
  const c = compute(r);
  const lang = r.language || settings.language || 'both'; // both | en | ur
  const L = (en, ur) =>
    lang === 'en' ? `<span class="en">${en}</span>`
    : lang === 'ur' ? `<span class="ur">${ur}</span>`
    : `<span class="en">${en}</span><span class="ur">${ur}</span>`;
  const f = (file) => 'file://' + path.join(fontDir, file);
  const biz = settings.business || {};
  const paidInFull = c.balance <= 0 && c.total > 0;

  const itemRows = c.items.map((it) => `
    <tr>
      <td class="item">
        ${it.name ? `<div class="iname">${esc(it.name)}</div>` : ''}
        ${it.name_ur ? `<div class="iname-ur" dir="rtl">${esc(it.name_ur)}</div>` : ''}
        ${it.details ? `<div class="idet" dir="auto">${esc(it.details)}</div>` : ''}
      </td>
      <td class="num">${it.qty}</td>
      <td class="num">${inr(it.rate)}</td>
      <td class="num strong">${inr(it.amount)}</td>
    </tr>`).join('');

  const payRows = c.payments.map((p) => `
    <div class="pay"><span>${fmtDate(p.date)}${p.method ? ' · ' + esc(p.method) : ''}${p.note ? ' · ' + esc(p.note) : ''}</span><span>${inr(p.amount)}</span></div>`).join('');

  const contact = [biz.phone && `☎ ${esc(biz.phone)}`, biz.instagram && `◎ ${esc(biz.instagram)}`, biz.city && esc(biz.city)].filter(Boolean).join('<span class="dot">•</span>');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:Corm;src:url(${f('cormorant-garamond-latin-500-normal.woff2')});font-weight:500}
  @font-face{font-family:Corm;src:url(${f('cormorant-garamond-latin-600-normal.woff2')});font-weight:600}
  @font-face{font-family:Corm;src:url(${f('cormorant-garamond-latin-700-normal.woff2')});font-weight:700}
  @font-face{font-family:Corm;src:url(${f('cormorant-garamond-latin-500-italic.woff2')});font-weight:500;font-style:italic}
  @font-face{font-family:Jost;src:url(${f('jost-latin-400-normal.woff2')});font-weight:400}
  @font-face{font-family:Jost;src:url(${f('jost-latin-500-normal.woff2')});font-weight:500}
  @font-face{font-family:Nastaliq;src:url(${f('noto-nastaliq-urdu-arabic-400-normal.woff2')});font-weight:400}
  @font-face{font-family:Nastaliq;src:url(${f('noto-nastaliq-urdu-arabic-700-normal.woff2')});font-weight:700}
  :root{--ink:${t.ink};--accent:${t.accent};--paper:${t.paper};--soft:${t.soft};--text:${t.text}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:900px;background:var(--paper);font-family:Jost,Nastaliq,sans-serif;color:var(--text)}
  .page{position:relative;margin:28px;padding:56px 60px 44px;border:1.5px solid var(--accent);outline:1px solid var(--accent);outline-offset:-10px}
  .corner{position:absolute;width:34px;height:34px;border:2px solid var(--accent)}
  .tl{top:-7px;left:-7px;border-right:0;border-bottom:0}.tr{top:-7px;right:-7px;border-left:0;border-bottom:0}
  .bl{bottom:-7px;left:-7px;border-right:0;border-top:0}.br{bottom:-7px;right:-7px;border-left:0;border-top:0}
  .ur{font-family:Nastaliq;direction:rtl;unicode-bidi:isolate}
  .en+.ur{margin-left:10px;opacity:.8;font-size:.92em}
  header{text-align:center}
  .brand{font-family:Corm;font-weight:600;font-size:76px;letter-spacing:6px;color:var(--ink);line-height:1}
  .brand-ur{font-family:Nastaliq;font-size:26px;color:var(--ink);margin-top:14px;line-height:1.9}
  .tag{font-family:Corm;font-style:italic;font-size:22px;color:var(--accent);margin-top:2px;letter-spacing:1px}
  .rule{display:flex;align-items:center;gap:14px;margin:26px 0 30px;color:var(--accent)}
  .rule:before,.rule:after{content:"";flex:1;height:1px;background:var(--accent)}
  .rule span{font-size:14px;letter-spacing:6px;font-weight:500;color:var(--ink)}
  .meta{display:flex;justify-content:space-between;gap:30px;margin-bottom:30px}
  .label{font-size:13px;letter-spacing:2.5px;text-transform:uppercase;color:var(--accent);font-weight:500;margin-bottom:6px}
  .label .ur{text-transform:none;letter-spacing:0;font-size:15px}
  .val{font-size:22px;line-height:1.6}
  .val.big{font-family:Corm;font-weight:600;font-size:30px;color:var(--ink);line-height:1.3}
  .right{text-align:right}
  table{width:100%;border-collapse:collapse}
  th{font-size:12.5px;letter-spacing:2.5px;text-transform:uppercase;font-weight:500;color:var(--paper);background:var(--ink);padding:12px 14px;text-align:left}
  th .ur{text-transform:none;letter-spacing:0;font-size:14px;opacity:.85}
  th.num{text-align:right}
  td{padding:16px 14px;border-bottom:1px solid var(--soft);vertical-align:top;font-size:19px}
  td.num{text-align:right;white-space:nowrap}
  .strong{font-weight:500;color:var(--ink)}
  .iname{font-family:Corm;font-weight:600;font-size:25px;color:var(--ink);line-height:1.2}
  .iname-ur{font-family:Nastaliq;font-size:20px;line-height:2;color:var(--ink);text-align:left}
  .idet{font-size:15.5px;opacity:.75;margin-top:4px;line-height:1.7;unicode-bidi:plaintext}
  .totals{margin:22px 0 0 auto;width:440px}
  .trow{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;font-size:19px}
  .trow.grand{border-top:1.5px solid var(--accent);margin-top:8px;padding-top:14px;font-family:Corm;font-weight:700;font-size:32px;color:var(--ink)}
  .trow.grand .label{margin:0}
  .pays{margin-top:6px;padding:10px 0 4px;border-top:1px dashed var(--accent)}
  .pay{display:flex;justify-content:space-between;font-size:15.5px;opacity:.8;padding:3px 0}
  .balance{margin-top:14px;background:var(--ink);color:var(--paper);padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
  .balance .label{color:var(--paper);opacity:.85;margin:0}
  .balance .amt{font-family:Corm;font-weight:700;font-size:34px}
  .stamp{margin-top:14px;text-align:center;border:2px solid var(--ink);color:var(--ink);padding:10px;font-family:Corm;font-weight:700;font-size:26px;letter-spacing:5px}
  .stamp .ur{font-size:20px;letter-spacing:0;margin-left:12px}
  .delivery{margin-top:26px;background:var(--soft);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;font-size:19px}
  .note{margin-top:30px;text-align:center;font-family:Corm;font-style:italic;font-size:24px;color:var(--ink);line-height:1.5}
  .note-ur{font-family:Nastaliq;font-style:normal;font-size:21px;line-height:2.1;margin-top:4px}
  footer{margin-top:30px;padding-top:18px;border-top:1px solid var(--accent);text-align:center;font-size:16px;letter-spacing:1px;color:var(--ink)}
  .dot{margin:0 12px;color:var(--accent)}
  ${r.custom_css || ''}
  </style></head><body><div class="page">
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <header>
      <div class="brand">${esc(biz.name || 'BFOREVER')}</div>
      <div class="tag">${esc(biz.tagline || 'Couture · Bridal & Occasion Wear')}</div>
      ${lang !== 'en' ? `<div class="brand-ur">${esc(biz.name_ur || 'بی فارایور')}</div>` : ''}
    </header>
    <div class="rule"><span>${lang === 'ur' ? '<span class="ur" style="letter-spacing:0;font-size:18px">رسید</span>' : 'RECEIPT'}</span></div>

    <div class="meta">
      <div>
        <div class="label">${L('Billed to', 'گاہک')}</div>
        <div class="val big" dir="auto">${esc(r.customer?.name)}</div>
        ${r.customer?.phone ? `<div class="val">${esc(r.customer.phone)}</div>` : ''}
        ${r.customer?.city ? `<div class="val" dir="auto">${esc(r.customer.city)}</div>` : ''}
      </div>
      <div class="right">
        <div class="label">${L('Receipt no.', 'رسید نمبر')}</div>
        <div class="val big">${esc(r.receipt_no)}</div>
        <div class="label" style="margin-top:12px">${L('Date', 'تاریخ')}</div>
        <div class="val">${fmtDate(r.date)}</div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th>${L('Item', 'تفصیل')}</th><th class="num">${L('Qty', 'تعداد')}</th>
        <th class="num">${L('Rate', 'قیمت')}</th><th class="num">${L('Amount', 'رقم')}</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals">
      ${c.discount ? `<div class="trow"><span class="label">${L('Subtotal', 'کل')}</span><span>${inr(c.subtotal)}</span></div>
      <div class="trow"><span class="label">${L('Discount', 'رعایت')}</span><span>− ${inr(c.discount)}</span></div>` : ''}
      <div class="trow grand"><span class="label">${L('Total', 'کل رقم')}</span><span>${inr(c.total)}</span></div>
      ${c.payments.length ? `<div class="pays">
        <div class="trow" style="padding:0 0 4px"><span class="label">${L('Received', 'وصول شدہ')}</span><span class="strong">${inr(c.paid)}</span></div>
        ${payRows}</div>` : ''}
      ${paidInFull
        ? `<div class="stamp">PAID IN FULL${lang !== 'en' ? '<span class="ur">مکمل ادائیگی</span>' : ''}</div>`
        : c.payments.length ? `<div class="balance"><span class="label">${L('Balance due', 'باقی رقم')}</span><span class="amt">${inr(c.balance)}</span></div>` : ''}
    </div>

    ${r.delivery_date ? `<div class="delivery"><span class="label" style="margin:0">${L('Delivery', 'ڈیلیوری')}</span><span class="strong">${fmtDate(r.delivery_date)}</span></div>` : ''}

    <div class="note">
      ${lang !== 'ur' ? `<div>${esc(r.note ?? settings.thank_you ?? 'Thank you for choosing Bforever. Made with love, just for you.')}</div>` : ''}
      ${lang !== 'en' ? `<div class="note-ur">${esc(r.note_ur ?? settings.thank_you_ur ?? 'بی فارایور پر اعتماد کرنے کا شکریہ۔ یہ لباس خاص آپ کے لیے، محبت سے تیار کیا گیا ہے۔')}</div>` : ''}
    </div>
    ${contact ? `<footer>${contact}</footer>` : ''}
  </div></body></html>`;
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) { console.error('Usage: node make-receipt.js <receipt.json>'); process.exit(1); }
  const repo = path.resolve(__dirname, '..', '..');
  const r = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const settingsPath = path.join(repo, 'business', 'receipt-settings.json');
  const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
  const html = render(r, settings, path.join(__dirname, 'fonts'));

  const base = jsonPath.replace(/\.json$/, '');
  const htmlPath = path.join(require('os').tmpdir(), path.basename(base) + '.html');
  fs.writeFileSync(htmlPath, html);

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2 });
  await page.goto('file://' + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: base + '.png', fullPage: true });
  await browser.close();

  const c = compute(r);
  console.log(JSON.stringify({ png: base + '.png', total: c.total, paid: c.paid, balance: c.balance }));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
