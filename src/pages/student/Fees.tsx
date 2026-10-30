import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudent } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer } from 'lucide-react';
import { printBill } from '@/lib/printBill';

interface Inv { id: string; title: string; amount: number; due_date: string | null; bill_no: string; created_at: string }
interface Pay { id: string; invoice_id: string; amount: number; paid_on: string; method: string; receipt_no: string }

export default function StudentFees() {
  const { user, userRole, loading } = useAuth();
  const { selectedStudent: s } = useStudent();
  const navigate = useNavigate();
  const [invs, setInvs] = useState<Inv[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);

  useEffect(() => { if (!loading && (!user || userRole !== 'student')) navigate('/'); }, [user, userRole, loading]);
  useEffect(() => {
    if (!s) return;
    supabase.from('fee_invoices').select('*').eq('student_id', s.id).order('created_at', { ascending: false }).then(({ data }) => setInvs((data || []) as Inv[]));
    supabase.from('fee_payments').select('*').eq('student_id', s.id).order('paid_on', { ascending: false }).then(({ data }) => setPays((data || []) as Pay[]));
  }, [s]);

  const paidFor = (id: string) => pays.filter(p => p.invoice_id === id).reduce((a, p) => a + Number(p.amount), 0);
  const totals = useMemo(() => {
    const total = invs.reduce((a, i) => a + Number(i.amount), 0);
    const paid = pays.reduce((a, p) => a + Number(p.amount), 0);
    return { total, paid, due: Math.max(0, total - paid) };
  }, [invs, pays]);

  return (
    <DashboardLayout title="Fees & Bills" subtitle={s?.name}>
      <Button variant="ghost" onClick={() => navigate('/student')} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-bold">Rs. {totals.total}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Paid</p><p className="text-xl font-bold text-primary">Rs. {totals.paid}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Due</p><p className="text-xl font-bold text-destructive">Rs. {totals.due}</p></Card>
      </div>
      <h3 className="font-semibold mb-2">Bills</h3>
      <div className="space-y-2 mb-6">
        {invs.map(i => {
          const paid = paidFor(i.id); const due = Number(i.amount) - paid;
          return (
            <Card key={i.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{i.title}</p>
                <p className="text-xs text-muted-foreground">{i.bill_no} {i.due_date && `· due ${i.due_date}`}</p>
              </div>
              <div className="text-right text-sm">
                <p>Rs. {i.amount}</p>
                {due <= 0 ? <Badge>Paid</Badge> : <Badge variant="destructive">Due Rs. {due}</Badge>}
              </div>
              <Button variant="outline" size="sm" onClick={() => s && printBill({
                billNo: i.bill_no, title: i.title, studentName: s.name, className: `${s.class} ${s.section}`,
                rollNo: s.roll_no, amount: Number(i.amount), paid, dueDate: i.due_date,
                payments: pays.filter(p => p.invoice_id === i.id),
              })}><Printer className="w-4 h-4 mr-1" />Bill</Button>
            </Card>
          );
        })}
        {!invs.length && <p className="text-muted-foreground text-center py-8">No fees yet.</p>}
      </div>
      {pays.length > 0 && (
        <>
          <h3 className="font-semibold mb-2">Payment history</h3>
          <div className="space-y-2">
            {pays.map(p => (
              <Card key={p.id} className="p-3 flex justify-between text-sm">
                <span>{p.paid_on} · {p.receipt_no} · {p.method}</span><span className="font-semibold">Rs. {p.amount}</span>
              </Card>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
