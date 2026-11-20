#!/usr/bin/env node
// Reads business/sales/*.csv and prints, as JSON:
//  - outstanding balance per order and per customer
//  - sales booked and money received per month
//  - the next receipt number
//
//   node tools/sales-report.js

const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '..', 'business', 'sales');

function readCsv(file) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8').trim();
  const [head, ...lines] = text.split('\n');
  const cols = head.split(',');
  return lines.filter(Boolean).map((line) => {
    const vals = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { vals.push(cur); cur = ''; }
      else cur += ch;
    }
    vals.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, (vals[i] ?? '').trim()]));
  });
}

const orders = readCsv('orders.csv');
const payments = readCsv('payments.csv');

const paidBy = {};
for (const p of payments) paidBy[p.receipt_no] = (paidBy[p.receipt_no] || 0) + Number(p.amount_inr);

const outstanding = orders
  .filter((o) => o.status !== 'cancelled')
  .map((o) => ({ receipt_no: o.receipt_no, customer: o.customer_name, total: Number(o.total_inr), paid: paidBy[o.receipt_no] || 0 }))
  .map((o) => ({ ...o, balance: o.total - o.paid }))
  .filter((o) => o.balance !== 0);

const byCustomer = {};
for (const o of outstanding) byCustomer[o.customer] = (byCustomer[o.customer] || 0) + o.balance;

const months = {};
const m = (d) => d.slice(0, 7);
for (const o of orders) if (o.status !== 'cancelled') {
  (months[m(o.date)] ??= { booked: 0, received: 0, orders: 0 });
  months[m(o.date)].booked += Number(o.total_inr); months[m(o.date)].orders++;
}
for (const p of payments) {
  (months[m(p.date)] ??= { booked: 0, received: 0, orders: 0 });
  months[m(p.date)].received += Number(p.amount_inr);
}

const nums = orders.map((o) => Number(o.receipt_no.replace(/\D/g, ''))).filter(Number.isFinite);
const next = 'BF-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');

console.log(JSON.stringify({
  next_receipt_no: next,
  total_outstanding: outstanding.reduce((s, o) => s + o.balance, 0),
  outstanding_by_customer: byCustomer,
  outstanding_orders: outstanding,
  by_month: months,
}, null, 2));
