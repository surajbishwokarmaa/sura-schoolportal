import { calculateSubjectGrade, calculateOverallGPA } from './gradeCalculator';

export interface RankingSubject {
  id: string; name: string; subject_type: string;
  theory_full_marks: number; practical_full_marks: number; total_marks: number;
  credit_hours: number; theory_pass_percentage: number; practical_pass_percentage: number;
}
export interface RankingResult {
  student_id: string; subject_id: string | null; subject: string;
  theory_marks: number | null; practical_marks: number | null; status: string | null;
}

export function matchesRankingSubject(result: Pick<RankingResult, 'subject_id' | 'subject'>, subject: Pick<RankingSubject, 'id' | 'name'>) {
  return result.subject_id ? result.subject_id === subject.id : result.subject.toLowerCase() === subject.name.toLowerCase();
}

export function buildSectionRanking(students: { id: string; name: string; roll_no: string }[], subjects: RankingSubject[], results: RankingResult[]) {
  const grouped = new Map<string, RankingResult[]>();
  for (const r of results) grouped.set(r.student_id, [...(grouped.get(r.student_id) || []), r]);
  const rows = students.map(student => {
    const entries = grouped.get(student.id) || [];
    // Compulsory subjects are required; optional subjects count only when taken.
    const expected = subjects.filter(s => s.subject_type !== 'optional' || entries.some(r => matchesRankingSubject(r, s)));
    const graded = expected.map(s => {
      const r = entries.find(r => matchesRankingSubject(r, s));
      if (!r || r.status !== 'approved' || r.theory_marks === null || r.practical_marks === null) return null;
      return { ...calculateSubjectGrade(r.theory_marks, r.practical_marks, s), creditHours: s.credit_hours, total: r.theory_marks + r.practical_marks, full: s.total_marks };
    });
    const complete = expected.length > 0 && graded.every(r => r !== null);
    const present = graded.filter(r => r !== null);
    const total = present.reduce((sum, r) => sum + r.total, 0);
    const full = present.reduce((sum, r) => sum + r.full, 0);
    const passing = complete && present.every(r => r.isPassing);
    return { ...student, complete, completed: present.length, expected: expected.length, total, percentage: full > 0 ? total / full * 100 : 0, passing, gpa: calculateOverallGPA(present), rank: null as number | null };
  });
  const ready = rows.length > 0 && rows.every(r => r.complete);
  if (ready) {
    const ordered = rows.filter(r => r.passing).sort((a, b) => b.percentage - a.percentage);
    ordered.forEach((row, index) => { row.rank = index > 0 && row.percentage === ordered[index - 1].percentage ? ordered[index - 1].rank : index + 1; });
  }
  return { ready, rows: rows.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || Number(a.roll_no) - Number(b.roll_no)) };
}