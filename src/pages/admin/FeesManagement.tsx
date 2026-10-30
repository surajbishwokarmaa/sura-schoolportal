import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Printer, Wallet } from 'lucide-react';
import { printBill } from '@/lib/printBill';

interface Cls { name: string; sections: string[] }
interface St { id: string; name: string; roll_no: string; class: string; section: string }
interface Inv { id: string; student_id: string; title: string; amount: number; due_date: string | null; bill_no: string }
interface Pay { id: string; invoice_id: string; student_id: string; amount: number; paid_on: string; method: string; receipt_no: string }

const sel = 'w-full h-10 rounded-md border border-input bg-background px-3 text-sm';

export default function FeesManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Cls[]>([]);
  const [cls, setCls] = useState(''); const [sec, setSec] = useState('');
  const [students, setStudents] = useState<St[]>([]);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);
  const [feeOpen, setFeeOpen] = useState<{ studentId?: string } | null>(null);
  const [fee, setFee] = useState({ title: '', amount: '', due: '' });
  const [payFor, setPayFor] = useState<St | null>(null);
  const [pay, setPay] = useState({ invoiceId: '', amount: '', method: 'cash' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) navigate('/auth/admin');
    else if (user) supabase.from('classes').select('name, sections').order('display_order').then(({ data }) => setClasses((data || []) as Cls[]));
  }, [user, userRole, loading]);

  const load = async () => {
    if (!cls || !sec) return;
    const { data: st } = await supabase.from('students').select('id, name, roll_no, class, section')
      .eq('class', cls).eq('section', sec).eq('is_active', true);
    const list = (st || []).sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0));
    setStudents(list);
    const ids = list.map(s => s.id);
    if (!ids.length) { setInvs([]); setPays([]); return; }
    const [{ data: i }, { data: p }] = await Promise.all([
      supabase.from('fee_invoices').select('*').in('student_id', ids),
      supabase.from('fee_payments').select('*').in('student_id', ids),
    ]);
    setInvs((i || []) as Inv[]); setPays((p || []) as Pay[]);
  };
  useEffect(() => { load(); }, [cls, sec]);

  const sum = (id: string) => {
    const total = invs.filter(i => i.student_id === id).reduce((a, i) => a + Number(i.amount), 0);
    const paid = pays.filter(p => p.student_id === id).reduce((a, p) => a + Number(p.amount), 0);
    return { total, paid, due: total - paid };
  };
  const classTotals = useMemo(() => {
    const total = invs.reduce((a, i) => a + Number(i.amount), 0);
    const paid = pays.reduce((a, p) => a + Number(p.amount), 0);
    return { total, paid, due: total - paid };
  }, [invs, pays]);

  const addFee = async () => {
    const amount = Number(fee.amount);
    if (!fee.title.trim() || !(amount > 0) || amount > 10000000) { toast({ title: 'Enter title and a valid amount', variant: 'destructive' }); return; }
    const targets = feeOpen?.studentId ? [feeOpen.studentId] : students.map(s => s.id);
    if (!targets.length) return;
    setBusy(true);
    const rows = targets.map(student_id => ({ student_id, title: fee.title.trim().slice(0, 120), amount, due_date: fee.due || null, created_by: user!.id }));
    let error = null;
    for (let i = 0; i < rows.length && !error; i += 500) ({ error } = await supabase.from('fee_invoices').insert(rows.slice(i, i + 500)));
    setBusy(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: `Fee added for ${rows.length} student(s)` }); setFeeOpen(null); setFee({ title: '', amount: '', due: '' }); load(); }
  };

  const invPaid = (id: string) => pays.filter(p => p.invoice_id === id).reduce((a, p) => a + Number(p.amount), 0);

  const recordPay = async () => {
    const inv = invs.find(i => i.id === pay.invoiceId);
    const amount = Number(pay.amount);
    if (!inv || !(amount > 0)) { toast({ title: 'Choose a bill and amount', variant: 'destructive' }); return; }
    if (amount > Number(inv.amount) - invPaid(inv.id)) { toast({ title: 'Amount is more than the due', variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = await supabase.from('fee_payments').insert({ invoice_id: inv.id, student_id: inv.student_id, amount, method: pay.method, received_by: user!.id });
    setBusy(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Payment recorded' }); setPayFor(null); setPay({ invoiceId: '', amount: '', method: 'cash' }); load(); }
  };

  const bill = (s: St, i: Inv) => printBill({
    billNo: i.bill_no, title: i.title, studentName: s.name, className: `${s.class} ${s.section}`, rollNo: s.roll_no,
    amount: Number(i.amount), paid: invPaid(i.id), dueDate: i.due_date, payments: pays.filter(p => p.invoice_id === i.id),
  });

  return (
    <DashboardLayout title="Fees & Bills">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      <Card className="p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div><Label>Class</Label><select className={sel} value={cls} onChange={e => { setCls(e.target.value); setSec(''); }}>
          <option value="">Select</option>{classes.map(c => <option key={c.name}>{c.name}</option>)}</select></div>
        <div><Label>Section</Label><select className={sel} value={sec} onChange={e => setSec(e.target.value)}>
          <option value="">Select</option>{(classes.find(c => c.name === cls)?.sections || []).map(s => <option key={s}>{s}</option>)}</select></div>
        <Button disabled={!students.length} onClick={() => setFeeOpen({})} className="col-span-2"><Plus className="w-4 h-4 mr-1" />Add fee to whole section</Button>
      </Card>
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold">Rs. {classTotals.total}</p></Card>
          <Card className="p-3"><p className="text-xs text-muted-foreground">Collected</p><p className="font-bold text-primary">Rs. {classTotals.paid}</p></Card>
          <Card className="p-3"><p className="text-xs text-muted-foreground">Due</p><p className="font-bold text-destructive">Rs. {classTotals.due}</p></Card>
        </div>
      )}
      <div className="space-y-2">
        {students.map(s => {
          const t = sum(s.id);
          return (
            <Card key={s.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-8 text-sm text-muted-foreground">{s.roll_no}</span>
                <span className="flex-1 font-medium truncate">{s.name}</span>
                <Badge variant={t.due > 0 ? 'destructive' : 'default'}>Due Rs. {t.due}</Badge>
                <Button size="sm" variant="outline" onClick={() => setFeeOpen({ studentId: s.id })}><Plus className="w-4 h-4" /></Button>
                <Button size="sm" onClick={() => setPayFor(s)} disabled={t.due <= 0}><Wallet className="w-4 h-4 mr-1" />Pay</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {invs.filter(i => i.student_id === s.id).map(i => (
                  <Button key={i.id} size="sm" variant="ghost" className="h-7 text-xs" onClick={() => bill(s, i)}>
                    <Printer className="w-3 h-3 mr-1" />{i.title} (Rs. {i.amount})
                  </Button>
                ))}
              </div>
            </Card>
          );
        })}
        {cls && sec && !students.length && <p className="text-center text-muted-foreground py-8">No students.</p>}
      </div>

      <Dialog open={!!feeOpen} onOpenChange={o => !o && setFeeOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{feeOpen?.studentId ? 'Add fee to student' : `Add fee to ${cls} ${sec} (${students.length})`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input placeholder="e.g. Monthly fee - Baisakh" value={fee.title} onChange={e => setFee({ ...fee, title: e.target.value })} /></div>
            <div><Label>Amount (Rs.)</Label><Input type="number" min="1" value={fee.amount} onChange={e => setFee({ ...fee, amount: e.target.value })} /></div>
            <div><Label>Due date</Label><Input type="date" value={fee.due} onChange={e => setFee({ ...fee, due: e.target.value })} /></div>
            <Button className="w-full" disabled={busy} onClick={addFee}>{busy ? 'Saving...' : 'Add fee'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payFor} onOpenChange={o => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment — {payFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bill</Label><select className={sel} value={pay.invoiceId} onChange={e => {
              const i = invs.find(x => x.id === e.target.value);
              setPay({ ...pay, invoiceId: e.target.value, amount: i ? String(Number(i.amount) - invPaid(i.id)) : '' });
            }}>
              <option value="">Select</option>
              {invs.filter(i => i.student_id === payFor?.id && Number(i.amount) - invPaid(i.id) > 0).map(i =>
                <option key={i.id} value={i.id}>{i.title} — due Rs. {Number(i.amount) - invPaid(i.id)}</option>)}
            </select></div>
            <div><Label>Amount</Label><Input type="number" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} /></div>
            <div><Label>Method</Label><select className={sel} value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}>
              <option value="cash">Cash</option><option value="bank">Bank</option><option value="esewa">eSewa</option><option value="khalti">Khalti</option></select></div>
            <Button className="w-full" disabled={busy} onClick={recordPay}>{busy ? 'Saving...' : 'Record payment'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
