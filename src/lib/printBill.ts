export interface BillData {
  billNo: string;
  title: string;
  studentName: string;
  className: string;
  rollNo: string;
  amount: number;
  paid: number;
  dueDate?: string | null;
  payments: { receipt_no: string; amount: number; paid_on: string; method: string }[];
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function printBill(b: BillData) {
  const w = window.open('', '_blank');
  if (!w) return;
  const rows = b.payments.map(p =>
    `<tr><td>${esc(p.receipt_no)}</td><td>${esc(p.paid_on)}</td><td>${esc(p.method)}</td><td style="text-align:right">Rs. ${Number(p.amount).toFixed(2)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html><head><title>Bill ${esc(b.billNo)}</title>
<style>body{font-family:Georgia,serif;padding:32px;max-width:720px;margin:auto}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #999;padding:6px;text-align:left}.r{text-align:right}.muted{color:#555}</style>
</head><body>
<h1>School Fee Bill</h1><p class="muted">Bill No: ${esc(b.billNo)}</p>
<p><b>Student:</b> ${esc(b.studentName)} &nbsp; <b>Class:</b> ${esc(b.className)} &nbsp; <b>Roll:</b> ${esc(b.rollNo)}</p>
<table><tr><th>Particular</th><th>Due date</th><th class="r">Amount</th></tr>
<tr><td>${esc(b.title)}</td><td>${esc(b.dueDate || '-')}</td><td class="r">Rs. ${b.amount.toFixed(2)}</td></tr>
<tr><td colspan="2"><b>Paid</b></td><td class="r">Rs. ${b.paid.toFixed(2)}</td></tr>
<tr><td colspan="2"><b>Due</b></td><td class="r"><b>Rs. ${Math.max(0, b.amount - b.paid).toFixed(2)}</b></td></tr></table>
${rows ? `<h3>Payments</h3><table><tr><th>Receipt</th><th>Date</th><th>Method</th><th class="r">Amount</th></tr>${rows}</table>` : ''}
<p class="muted" style="margin-top:40px">Printed on ${new Date().toLocaleDateString()}</p>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
