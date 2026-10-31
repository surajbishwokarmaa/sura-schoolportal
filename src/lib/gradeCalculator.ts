import { getCurrentNepaliYear } from './nepaliDate';

export interface GradeResult {
  grade: string;
  gpa: number;
  percentage: number;
  isPassing: boolean;
}

export function calculateGrade(marks: number, fullMarks: number = 100): GradeResult {
  const percentage = fullMarks > 0 && Number.isFinite(marks) ? (marks / fullMarks) * 100 : 0;
  
  let grade: string;
  let gpa: number;
  let isPassing: boolean = true;

  if (percentage >= 90) {
    grade = "A+";
    gpa = 4.0;
  } else if (percentage >= 80) {
    grade = "A";
    gpa = 3.6;
  } else if (percentage >= 70) {
    grade = "B+";
    gpa = 3.2;
  } else if (percentage >= 60) {
    grade = "B";
    gpa = 2.8;
  } else if (percentage >= 50) {
    grade = "C+";
    gpa = 2.4;
  } else if (percentage >= 40) {
    grade = "C";
    gpa = 2.0;
  } else if (percentage >= 35) {
    grade = 'D';
    gpa = 1.6;
  } else {
    grade = "NG";
    gpa = 0;
    isPassing = false;
  }

  return {
    grade,
    gpa,
    percentage: Math.round(percentage * 100) / 100,
    isPassing,
  };
}

export function calculateOverallGPA(results: Array<{ gpa: number; creditHours?: number; grade?: string }>): number {
  if (results.length === 0) return 0;
  if (results.some(r => r.grade === 'NG')) return 0;
  const credits = results.reduce((sum, r) => sum + (r.creditHours ?? 1), 0);
  const totalGPA = results.reduce((sum, r) => sum + r.gpa * (r.creditHours ?? 1), 0);
  return credits > 0 ? Math.round(totalGPA / credits * 100) / 100 : 0;
}

export function calculateSubjectGrade(theory: number, practical: number, subject: { theory_full_marks: number; practical_full_marks: number; total_marks: number; theory_pass_percentage?: number; practical_pass_percentage?: number }): GradeResult {
  const result = calculateGrade(theory + practical, subject.total_marks);
  const theoryFail = subject.theory_full_marks > 0 && theory / subject.theory_full_marks * 100 < (subject.theory_pass_percentage ?? 0);
  const practicalFail = subject.practical_full_marks > 0 && practical / subject.practical_full_marks * 100 < (subject.practical_pass_percentage ?? 0);
  return theoryFail || practicalFail ? { ...result, grade: 'NG', gpa: 0, isPassing: false } : result;
}

// Calculate grade from marks for a specific component (theory/practical)
export function getGradeFromMarks(marks: number, fullMarks: number): string {
  if (fullMarks <= 0) return '—';
  return calculateGrade(marks, fullMarks).grade;
}

// Get final remarks based on percentage and pass status
export function getFinalRemarks(percentage: number, allPassing: boolean): string {
  if (!allPassing) return "Needs Improvement";
  if (percentage >= 90) return "Outstanding";
  if (percentage >= 80) return "Excellent";
  if (percentage >= 70) return "Very Good";
  if (percentage >= 60) return "Good";
  if (percentage >= 50) return "Satisfactory";
  if (percentage >= 40) return "Pass";
  if (percentage >= 35) return "Basic";
  return "Needs Improvement";
}

// Get current academic year in single format (e.g., "2081")
export function getCurrentAcademicYear(): string {
  return String(getCurrentNepaliYear());
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case "A+":
      return "text-primary";
    case "A":
      return "text-primary";
    case "B+":
      return "text-primary";
    case "B":
      return "text-primary";
    case "C+":
      return "text-muted-foreground";
    case "C":
      return "text-muted-foreground";
    case 'D':
      return 'text-muted-foreground';
    case "NG":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}
