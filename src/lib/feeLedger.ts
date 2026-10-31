export const formatNPR = (amount: number) => `Rs. ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildFeeLedger(invoices: { id: string; student_id: string; amount: number }[], payments: { invoice_id: string; student_id: string; amount: number }[]) {
  const byStudent = new Map<string, { total: number; paid: number; due: number }>();
  const byInvoice = new Map<string, number>();
  for (const invoice of invoices) {
    const entry = byStudent.get(invoice.student_id) || { total: 0, paid: 0, due: 0 };
    entry.total += Number(invoice.amount);
    byStudent.set(invoice.student_id, entry);
  }
  for (const payment of payments) {
    byInvoice.set(payment.invoice_id, (byInvoice.get(payment.invoice_id) || 0) + Number(payment.amount));
    const entry = byStudent.get(payment.student_id) || { total: 0, paid: 0, due: 0 };
    entry.paid += Number(payment.amount);
    byStudent.set(payment.student_id, entry);
  }
  for (const entry of byStudent.values()) entry.due = Math.max(0, entry.total - entry.paid);
  return { byStudent, byInvoice };
}