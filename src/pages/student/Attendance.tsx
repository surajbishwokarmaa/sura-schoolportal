import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudent } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, addMonths, subMonths, isToday } from 'date-fns';

type Rec = { date: string; status: 'present' | 'absent' | 'late' | 'leave' };
const COLORS: Record<string, string> = {
  present: 'hsl(var(--primary))', absent: 'hsl(var(--destructive))',
  late: 'hsl(var(--secondary-foreground))', leave: 'hsl(var(--muted-foreground))',
};
const CELL: Record<string, string> = {
  present: 'bg-primary text-primary-foreground', absent: 'bg-destructive text-destructive-foreground',
  late: 'bg-secondary text-secondary-foreground ring-2 ring-primary/40', leave: 'bg-muted text-muted-foreground',
};

export default function StudentAttendance() {
  const { user, userRole, loading } = useAuth();
  const { selectedStudent } = useStudent();
  const navigate = useNavigate();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [month, setMonth] = useState(new Date());

  useEffect(() => {
    if (!loading && (!user || userRole !== 'student')) navigate('/');
  }, [user, userRole, loading]);

  useEffect(() => {
    if (!selectedStudent) return;
    supabase.from('attendance').select('date, status').eq('student_id', selectedStudent.id)
      .order('date').limit(1000).then(({ data }) => setRecs((data || []) as Rec[]));
  }, [selectedStudent]);

  const byDate = useMemo(() => Object.fromEntries(recs.map(r => [r.date, r.status])), [recs]);
  const totals = useMemo(() => {
    const t = { present: 0, absent: 0, late: 0, leave: 0 };
    recs.forEach(r => t[r.status]++);
    return t;
  }, [recs]);
  const total = recs.length;
  const pct = total ? Math.round(((totals.present + totals.late) / total) * 100) : 0;

  const monthly = useMemo(() => {
    const m: Record<string, any> = {};
    recs.forEach(r => {
      const k = r.date.slice(0, 7);
      m[k] ||= { month: format(new Date(r.date), 'MMM'), present: 0, absent: 0, late: 0, leave: 0 };
      m[k][r.status]++;
    });
    return Object.keys(m).sort().slice(-6).map(k => m[k]);
  }, [recs]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const pad = getDay(startOfMonth(month));

  return (
    <DashboardLayout title="My Attendance" subtitle={selectedStudent?.name}>
      <Button variant="ghost" onClick={() => navigate('/student')} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[['Attendance', `${pct}%`], ['Present', totals.present], ['Absent', totals.absent], ['Late / Leave', `${totals.late} / ${totals.leave}`]].map(([l, v], i) => (
          <Card key={l as string} className="p-4 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft /></Button>
          <h3 className="font-semibold">{format(month, 'MMMM yyyy')}</h3>
          <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button>
        </div>
        <div key={month.toISOString()} className="grid grid-cols-7 gap-1 text-center text-sm">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-muted-foreground font-medium py-1">{d}</div>)}
          {Array.from({ length: pad }).map((_, i) => <div key={'p' + i} />)}
          {days.map((d, i) => {
            const st = byDate[format(d, 'yyyy-MM-dd')];
            return (
              <div key={i} style={{ animationDelay: `${i * 15}ms` }}
                className={`aspect-square flex items-center justify-center rounded-lg animate-scale-in ${st ? CELL[st] : 'bg-card border'} ${isToday(d) ? 'ring-2 ring-ring' : ''}`}>
                {format(d, 'd')}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          {Object.keys(CELL).map(k => <span key={k} className="flex items-center gap-1 capitalize"><span className={`w-3 h-3 rounded ${CELL[k]}`} />{k}</span>)}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Overall</h3>
          {total ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={Object.entries(totals).filter(([, v]) => v).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} isAnimationActive>
                  {Object.entries(totals).filter(([, v]) => v).map(([k]) => <Cell key={k} fill={COLORS[k]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-center py-12">No attendance yet</p>}
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Last 6 months</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              {Object.keys(COLORS).map(k => <Bar key={k} dataKey={k} stackId="a" fill={COLORS[k]} />)}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </DashboardLayout>
  );
}
