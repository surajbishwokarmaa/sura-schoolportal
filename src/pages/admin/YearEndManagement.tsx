import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowUpCircle, UserMinus, ListOrdered, History, Search, UserPlus } from 'lucide-react';

type Status = 'active' | 'graduated' | 'transferred' | 'dropped';
interface Student {
  id: string; name: string; class: string; section: string; roll_no: string;
  is_active: boolean | null; graduation_status: Status; parent_phone: string;
}
interface ClassRow { id: string; name: string; sections: string[] | null; display_order: number | null }
interface LogRow {
  id: string; student_name: string | null; action: string; from_class: string | null; to_class: string | null;
  from_roll: string | null; to_roll: string | null; created_at: string;
}

const GRADUATE = '__graduate__';
const SKIP = '__skip__';
const PAGE = 1000;
const SHOW_LIMIT = 150;

async function fetchAllStudents(): Promise<Student[]> {
  const out: Student[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('students')
      .select('id,name,class,section,roll_no,is_active,graduation_status,parent_phone')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data || []) as Student[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const rollNum = (r: string) => (/^\d+$/.test(r) ? parseInt(r, 10) : Number.MAX_SAFE_INTEGER);

const YearEndManagement = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // promote
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [holdBack, setHoldBack] = useState<Set<string>>(new Set());
  const [holdClass, setHoldClass] = useState<string>('');
  const [renumberAfter, setRenumberAfter] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // leave / rejoin
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'left'>('active');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [leaveStatus, setLeaveStatus] = useState<Status>('transferred');
  const [note, setNote] = useState('');

  // rolls
  const [rollClass, setRollClass] = useState('all');
  const [rollOrder, setRollOrder] = useState<'name' | 'current'>('name');

  // history
  const [logs, setLogs] = useState<LogRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [all, cls] = await Promise.all([
        fetchAllStudents(),
        supabase.from('classes').select('id,name,sections,display_order').order('display_order'),
      ]);
      if (cls.error) throw cls.error;
      const classRows = (cls.data || []) as ClassRow[];
      setStudents(all);
      setClasses(classRows);
      setMapping((prev) => {
        if (Object.keys(prev).length) return prev;
        const m: Record<string, string> = {};
        classRows.forEach((c, i) => {
          const n = c.name.toLowerCase();
          const terminal = n === 'class 12' || i === classRows.length - 1;
          m[c.name] = terminal ? GRADUATE : classRows[i + 1].name;
        });
        return m;
      });
    } catch (e) {
      toast({ title: 'Could not load data', description: (e as Error).message, variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('student_year_log')
      .select('id,student_name,action,from_class,to_class,from_roll,to_roll,created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs((data || []) as LogRow[]);
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'admin')) navigate('/auth/admin');
    else if (user && userRole === 'admin') { loadData(); loadLogs(); }
  }, [user, userRole, authLoading, navigate, loadData, loadLogs]);

  const active = useMemo(() => students.filter((s) => s.is_active && s.graduation_status === 'active'), [students]);
  const countByClass = useMemo(() => {
    const m: Record<string, number> = {};
    active.forEach((s) => { m[s.class] = (m[s.class] || 0) + 1; });
    return m;
  }, [active]);

  const summary = useMemo(() => {
    let promote = 0, graduate = 0;
    active.forEach((s) => {
      if (holdBack.has(s.id)) return;
      const to = mapping[s.class];
      if (!to || to === SKIP) return;
      if (to === GRADUATE) graduate++; else promote++;
    });
    return { promote, graduate, held: holdBack.size };
  }, [active, mapping, holdBack]);

  const runPromotion = async () => {
    setConfirmOpen(false);
    setBusy(true);
    const payload = Object.entries(mapping)
      .filter(([, to]) => to !== SKIP)
      .map(([from, to]) => ({ from, to: to === GRADUATE ? '' : to }));
    const { data, error } = await supabase.rpc('promote_students', {
      p_mapping: payload, p_hold_back: Array.from(holdBack), p_renumber: renumberAfter,
    });
    setBusy(false);
    setConfirmText('');
    if (error) {
      toast({ title: 'Promotion failed — nothing was changed', description: error.message, variant: 'destructive' });
      return;
    }
    const r = data as { promoted: number; graduated: number; held_back: number };
    toast({ title: 'New year started', description: `${r.promoted} promoted, ${r.graduated} graduated, ${r.held_back} kept in same class.` });
    setHoldBack(new Set());
    await loadData(); loadLogs();
  };

  const listStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => (filterStatus === 'active' ? s.is_active && s.graduation_status === 'active' : !s.is_active || s.graduation_status !== 'active'))
      .filter((s) => filterClass === 'all' || s.class === filterClass)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase() === q || s.parent_phone.includes(q))
      .sort((a, b) => a.class.localeCompare(b.class) || a.section.localeCompare(b.section) || rollNum(a.roll_no) - rollNum(b.roll_no));
  }, [students, search, filterClass, filterStatus]);

  const applyStatus = async (status: Status) => {
    if (!selected.size) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('set_students_status', {
      p_ids: Array.from(selected), p_status: status, p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Updated', description: `${data} student(s) ${status === 'active' ? 're-joined' : 'marked as ' + status}.` });
    setSelected(new Set()); setNote('');
    await loadData(); loadLogs();
  };

  const runRenumber = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('renumber_rolls', {
      p_class: rollClass === 'all' ? null : rollClass, p_section: null, p_order: rollOrder,
    });
    setBusy(false);
    if (error) { toast({ title: 'Roll update failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Roll numbers updated', description: `${data} students now have new roll numbers.` });
    await loadData(); loadLogs();
  };

  if (authLoading || loading) return <LoadingSpinner fullScreen />;

  const holdList = holdClass ? active.filter((s) => s.class === holdClass).sort((a, b) => a.section.localeCompare(b.section) || rollNum(a.roll_no) - rollNum(b.roll_no)) : [];
  const shown = listStudents.slice(0, SHOW_LIMIT);

  return (
    <DashboardLayout
      title="New Academic Year"
      subtitle="Promote classes, manage leavers & re-joins, and reset roll numbers"
      headerActions={<Button variant="outline" size="sm" onClick={() => navigate('/admin')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>}
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
        <Card className="p-3 text-center"><p className="text-xl sm:text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Active students</p></Card>
        <Card className="p-3 text-center"><p className="text-xl sm:text-2xl font-bold">{students.length - active.length}</p><p className="text-xs text-muted-foreground">Left / graduated</p></Card>
        <Card className="p-3 text-center"><p className="text-xl sm:text-2xl font-bold">{classes.length}</p><p className="text-xs text-muted-foreground">Classes</p></Card>
      </div>

      <Tabs defaultValue="promote">
        <TabsList className="grid grid-cols-4 w-full h-auto">
          <TabsTrigger value="promote" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2"><ArrowUpCircle className="h-4 w-4" />Promote</TabsTrigger>
          <TabsTrigger value="leave" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2"><UserMinus className="h-4 w-4" />Leave/Join</TabsTrigger>
          <TabsTrigger value="rolls" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2"><ListOrdered className="h-4 w-4" />Roll No.</TabsTrigger>
          <TabsTrigger value="history" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2"><History className="h-4 w-4" />History</TabsTrigger>
        </TabsList>

        {/* PROMOTE */}
        <TabsContent value="promote" className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">1. Where does each class go?</h3>
            <div className="space-y-2">
              {classes.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="w-28 sm:w-36 shrink-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{countByClass[c.name] || 0} students</p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <Select value={mapping[c.name] || SKIP} onValueChange={(v) => setMapping((m) => ({ ...m, [c.name]: v }))}>
                    <SelectTrigger className="flex-1 min-w-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {classes.filter((x) => x.name !== c.name).map((x) => <SelectItem key={x.id} value={x.name}>{x.name}</SelectItem>)}
                      <SelectItem value={GRADUATE}>🎓 Graduate (leaves school)</SelectItem>
                      <SelectItem value={SKIP}>Don't change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">2. Students who stay in the same class (failed / repeat)</h3>
            <Select value={holdClass} onValueChange={setHoldClass}>
              <SelectTrigger><SelectValue placeholder="Choose a class to pick students" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.name}>{c.name} ({countByClass[c.name] || 0})</SelectItem>)}</SelectContent>
            </Select>
            {holdClass && (
              <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
                {holdList.length === 0 && <p className="p-3 text-sm text-muted-foreground">No active students.</p>}
                {holdList.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 p-2 cursor-pointer">
                    <Checkbox checked={holdBack.has(s.id)} onCheckedChange={(v) => setHoldBack((prev) => { const n = new Set(prev); v ? n.add(s.id) : n.delete(s.id); return n; })} />
                    <span className="text-sm flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.section} · #{s.roll_no}</span>
                  </label>
                ))}
              </div>
            )}
            {holdBack.size > 0 && <p className="text-sm">{holdBack.size} student(s) will stay. <button className="underline text-primary" onClick={() => setHoldBack(new Set())}>Clear</button></p>}
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-medium text-sm">Give new roll numbers after promotion</p><p className="text-xs text-muted-foreground">Alphabetical by name, 1, 2, 3… in every section</p></div>
              <Switch checked={renumberAfter} onCheckedChange={setRenumberAfter} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{summary.promote} promote</Badge>
              <Badge variant="secondary">{summary.graduate} graduate</Badge>
              <Badge variant="outline">{summary.held} stay</Badge>
            </div>
            <Button className="w-full" size="lg" disabled={busy || summary.promote + summary.graduate === 0} onClick={() => setConfirmOpen(true)}>
              <ArrowUpCircle className="h-4 w-4 mr-2" />{busy ? 'Working…' : 'Start New Year & Promote'}
            </Button>
          </Card>
        </TabsContent>

        {/* LEAVE / REJOIN */}
        <TabsContent value="leave" className="space-y-4">
          <Card className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">New students: add them from <button className="underline text-primary" onClick={() => navigate('/admin/students')}>Manage Students</button> or <button className="underline text-primary" onClick={() => navigate('/admin/bulk-upload')}>Bulk Upload</button>.</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as 'active' | 'left'); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Current students</SelectItem><SelectItem value="left">Left / graduated</SelectItem></SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All classes</SelectItem>{classes.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, roll no. or phone" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{listStudents.length} found{listStudents.length > SHOW_LIMIT ? ` (showing ${SHOW_LIMIT})` : ''}</span>
              <button className="underline text-primary" onClick={() => setSelected(new Set(shown.map((s) => s.id)))}>Select shown</button>
            </div>
            <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
              {shown.map((s) => (
                <label key={s.id} className="flex items-center gap-3 p-2 cursor-pointer">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={(v) => setSelected((prev) => { const n = new Set(prev); v ? n.add(s.id) : n.delete(s.id); return n; })} />
                  <div className="flex-1 min-w-0"><p className="text-sm truncate">{s.name}</p><p className="text-xs text-muted-foreground">{s.class} {s.section} · #{s.roll_no}</p></div>
                  {s.graduation_status !== 'active' && <Badge variant="outline" className="text-xs">{s.graduation_status}</Badge>}
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <p className="font-medium text-sm">{selected.size} selected</p>
            <Input placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            {filterStatus === 'active' ? (
              <div className="flex gap-2">
                <Select value={leaveStatus} onValueChange={(v) => setLeaveStatus(v as Status)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="transferred">Transferred</SelectItem><SelectItem value="dropped">Dropped out</SelectItem><SelectItem value="graduated">Graduated</SelectItem></SelectContent>
                </Select>
                <Button variant="destructive" disabled={busy || !selected.size} onClick={() => applyStatus(leaveStatus)}><UserMinus className="h-4 w-4 mr-1" />Mark left</Button>
              </div>
            ) : (
              <Button className="w-full" disabled={busy || !selected.size} onClick={() => applyStatus('active')}><UserPlus className="h-4 w-4 mr-1" />Re-join school</Button>
            )}
            <p className="text-xs text-muted-foreground">Students who leave can no longer log in. Their old results are kept.</p>
          </Card>
        </TabsContent>

        {/* ROLLS */}
        <TabsContent value="rolls">
          <Card className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">Gives every current student a fresh roll number (1, 2, 3…) inside their class and section. Logins keep working.</p>
            <Label>Class</Label>
            <Select value={rollClass} onValueChange={setRollClass}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Whole school</SelectItem>{classes.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Order</Label>
            <Select value={rollOrder} onValueChange={(v) => setRollOrder(v as 'name' | 'current')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="name">Alphabetical by name</SelectItem><SelectItem value="current">Keep current order (close gaps)</SelectItem></SelectContent>
            </Select>
            <Button className="w-full" disabled={busy} onClick={runRenumber}><ListOrdered className="h-4 w-4 mr-2" />{busy ? 'Working…' : 'Update Roll Numbers'}</Button>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card className="p-2 sm:p-4">
            <div className="max-h-[32rem] overflow-y-auto divide-y">
              {logs.length === 0 && <p className="p-3 text-sm text-muted-foreground">No changes yet.</p>}
              {logs.map((l) => (
                <div key={l.id} className="p-2 text-sm flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.student_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.from_class}{l.to_class && l.to_class !== l.from_class ? ` → ${l.to_class}` : ''}
                      {l.from_roll !== l.to_roll && l.to_roll ? ` · roll ${l.from_roll} → ${l.to_roll}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-xs capitalize">{l.action.replace('_', ' ')}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(l.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmText(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start the new academic year?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary.promote} students move up, {summary.graduate} graduate and {summary.held} stay in the same class.
              This changes every student at once. Type <b>PROMOTE</b> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PROMOTE" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={confirmText !== 'PROMOTE'} onClick={runPromotion}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default YearEndManagement;
