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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, Edit2, Save } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type Status = 'present' | 'absent' | 'late' | 'leave';
const STATUSES: { v: Status; label: string; cls: string }[] = [
  { v: 'present', label: 'P', cls: 'bg-primary text-primary-foreground' },
  { v: 'absent', label: 'A', cls: 'bg-destructive text-destructive-foreground' },
  { v: 'late', label: 'L', cls: 'bg-secondary text-secondary-foreground' },
  { v: 'leave', label: 'Lv', cls: 'bg-muted text-foreground' },
];

interface Student {
  id: string; name: string; roll_no: string; parent_name: string | null;
  parent_phone: string; address: string | null; dob: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ClassTeacherPanel() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ct, setCt] = useState<{ cls: string; sec: string } | null | undefined>(undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) navigate('/auth/teacher');
    else if (user) loadTeacher();
  }, [user, userRole, loading]);

  const loadTeacher = async () => {
    const { data } = await supabase.from('teachers')
      .select('class_teacher_class, class_teacher_section').eq('user_id', user!.id).maybeSingle();
    if (data?.class_teacher_class && data.class_teacher_section) {
      const c = { cls: data.class_teacher_class, sec: data.class_teacher_section };
      setCt(c);
      const { data: st } = await supabase.from('students')
        .select('id, name, roll_no, parent_name, parent_phone, address, dob')
        .eq('class', c.cls).eq('section', c.sec).eq('is_active', true);
      setStudents((st || []).sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0)));
    } else setCt(null);
  };

  useEffect(() => { if (ct) loadAttendance(); }, [ct, date]);

  const loadAttendance = async () => {
    const { data } = await supabase.from('attendance').select('student_id, status')
      .eq('class', ct!.cls).eq('section', ct!.sec).eq('date', date);
    const m: Record<string, Status> = {};
    (data || []).forEach(r => { m[r.student_id] = r.status as Status; });
    setMarks(m);
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0 };
    Object.values(marks).forEach(s => c[s]++);
    return c;
  }, [marks]);

  const markAll = (s: Status) => setMarks(Object.fromEntries(students.map(st => [st.id, s])));

  const save = async () => {
    if (!ct) return;
    if (date > today()) { toast({ title: 'Cannot mark future dates', variant: 'destructive' }); return; }
    setSaving(true);
    const rows = Object.entries(marks).map(([student_id, status]) => ({
      student_id, status, date, class: ct.cls, section: ct.sec, marked_by: user!.id,
    }));
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' });
    setSaving(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Attendance saved', description: `${rows.length} students for ${date}` });
  };

  const saveStudent = async () => {
    if (!editing) return;
    const phone = editing.parent_phone.replace(/\D/g, '');
    if (editing.name.trim().length < 2 || phone.length < 10) {
      toast({ title: 'Check name and phone', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('students').update({
      name: editing.name.trim().slice(0, 100), parent_name: editing.parent_name?.slice(0, 100) || null,
      parent_phone: phone, address: editing.address?.slice(0, 255) || null, dob: editing.dob || null,
    }).eq('id', editing.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Student updated' }); setEditing(null); loadTeacher(); }
  };

  if (loading || ct === undefined) return <LoadingSpinner />;

  return (
    <DashboardLayout title="My Class" subtitle={ct ? `${ct.cls} - ${ct.sec}` : undefined}>
      <Button variant="ghost" onClick={() => navigate('/teacher')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>
      {!ct ? (
        <Card className="p-8 text-center text-muted-foreground">
          You are not set as a class teacher. Ask the admin to set your position to "Class Teacher".
        </Card>
      ) : (
        <Tabs defaultValue="attendance">
          <TabsList className="mb-4"><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="students">Students ({students.length})</TabsTrigger></TabsList>
          <TabsContent value="attendance">
            <Card className="p-4 mb-4 flex flex-wrap items-end gap-3">
              <div><Label>Date</Label><Input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} /></div>
              <Button variant="outline" onClick={() => markAll('present')}><Check className="w-4 h-4 mr-1" />All present</Button>
              <div className="flex gap-2 text-sm">
                <Badge>P {counts.present}</Badge><Badge variant="destructive">A {counts.absent}</Badge>
                <Badge variant="secondary">L {counts.late}</Badge><Badge variant="outline">Lv {counts.leave}</Badge>
              </div>
              <Button onClick={save} disabled={saving || !Object.keys(marks).length} className="ml-auto">
                <Save className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save'}
              </Button>
            </Card>
            <div className="space-y-2">
              {students.map(s => (
                <Card key={s.id} className="p-3 flex items-center gap-3">
                  <span className="w-8 text-muted-foreground text-sm">{s.roll_no}</span>
                  <span className="flex-1 font-medium truncate">{s.name}</span>
                  <div className="flex gap-1">
                    {STATUSES.map(st => (
                      <button key={st.v} type="button" aria-label={st.v}
                        onClick={() => setMarks(m => ({ ...m, [s.id]: st.v }))}
                        className={`w-9 h-9 rounded-md text-xs font-semibold border transition ${marks[s.id] === st.v ? st.cls : 'bg-background'}`}>
                        {st.label}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
              {!students.length && <p className="text-muted-foreground text-center py-8">No students in this class.</p>}
            </div>
          </TabsContent>
          <TabsContent value="students">
            <div className="grid gap-3 sm:grid-cols-2">
              {students.map(s => (
                <Card key={s.id} className="p-4 flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.roll_no}. {s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.parent_name || '-'} · {s.parent_phone}</p>
                    <p className="text-sm text-muted-foreground truncate">{s.address || ''}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...s })}><Edit2 className="w-4 h-4" /></Button>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Parent name</Label><Input value={editing.parent_name || ''} onChange={e => setEditing({ ...editing, parent_name: e.target.value })} /></div>
              <div><Label>Parent phone</Label><Input value={editing.parent_phone} onChange={e => setEditing({ ...editing, parent_phone: e.target.value })} /></div>
              <div><Label>Address</Label><Input value={editing.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></div>
              <div><Label>Date of birth</Label><Input type="date" value={editing.dob || ''} onChange={e => setEditing({ ...editing, dob: e.target.value })} /></div>
              <Button className="w-full" onClick={saveStudent}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
