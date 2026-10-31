import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/pagedQuery';
import { getCurrentAcademicYear } from '@/lib/gradeCalculator';
import { buildSectionRanking, RankingResult, RankingSubject } from '@/lib/sectionRanking';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function SectionResults({ className, section, students }: { className: string; section: string; students: { id: string; name: string; roll_no: string }[] }) {
  const [term, setTerm] = useState<'first_term' | 'second_term' | 'third_term' | 'final_term'>('first_term');
  const [year, setYear] = useState(getCurrentAcademicYear());
  const [subjects, setSubjects] = useState<RankingSubject[]>([]);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    (async () => {
      const { data: cls, error: classError } = await supabase.from('classes').select('id').eq('name', className).single();
      if (classError) throw classError;
      const { data: sub, error: subError } = await supabase.from('subjects').select('*').eq('class_id', cls.id);
      if (subError) throw subError;
      const rows = await fetchAllPages((from, to) => supabase.from('results').select('student_id,subject_id,subject,theory_marks,practical_marks,status,students!inner(section)')
        .eq('class', className).eq('students.section', section).eq('term', term).eq('academic_year_bs', year).order('id').range(from, to));
      if (active) { setSubjects(sub || []); setResults(rows); }
    })().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [className, section, term, year, refresh]);
  const ranking = useMemo(() => buildSectionRanking(students, subjects, results), [students, subjects, results]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <div><Label htmlFor="rank-term">Exam</Label><select id="rank-term" className="h-10 w-full rounded-md border border-input bg-background px-3" value={term} onChange={e => setTerm(e.target.value as typeof term)}>
        <option value="first_term">First Term</option><option value="second_term">Second Term</option><option value="third_term">Third Term</option><option value="final_term">Final Exam</option>
      </select></div>
      <div className="w-28"><Label htmlFor="rank-year">Year (BS)</Label><Input id="rank-year" value={year} inputMode="numeric" maxLength={4} onChange={e => setYear(e.target.value.replace(/\D/g, ''))} /></div>
      <Button variant="outline" size="icon" aria-label="Refresh results" onClick={() => setRefresh(v => v + 1)}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    {error ? <p role="alert" className="text-destructive">{error}</p> : loading ? <p className="py-8 text-muted-foreground">Loading results…</p> : <>
      <p className="text-sm text-muted-foreground">{ranking.ready ? `${className} · ${section} · ${students.length} complete results` : 'Positions pending — all students’ required subject marks must be submitted.'}</p>
      {ranking.rows.map(r => <Card key={r.id} className="p-4">
        <div className="flex items-center gap-3"><span className="w-10 shrink-0 text-center text-xl font-bold text-primary">{r.rank ?? '—'}</span>
          <div className="flex-1 min-w-0"><p className="font-semibold break-words">{r.name}</p><p className="text-xs text-muted-foreground">Roll {r.roll_no} · {r.completed}/{r.expected} subjects</p></div>
          <Badge variant={!r.complete ? 'secondary' : r.passing ? 'default' : 'destructive'}>{!r.complete ? 'Pending' : r.passing ? 'Graded' : 'NG'}</Badge>
        </div>
        {r.complete && <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm"><span>Total: {r.total}</span><span>{r.percentage.toFixed(2)}%</span><span>GPA: {r.passing ? r.gpa.toFixed(2) : '—'}</span></div>}
      </Card>)}
    </>}
  </div>;
}