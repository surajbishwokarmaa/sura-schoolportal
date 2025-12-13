export interface GradeResult {
  grade: string;
  gpa: number;
  percentage: number;
  isPassing: boolean;
}

export function calculateGrade(marks: number, fullMarks: number = 100): GradeResult {
  const percentage = (marks / fullMarks) * 100;
  
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
  } else {
    grade = "NG";
    gpa = 0.8;
    isPassing = false;
  }

  return {
    grade,
    gpa,
    percentage: Math.round(percentage * 100) / 100,
    isPassing,
  };
}

export function calculateOverallGPA(results: Array<{ gpa: number }>): number {
  if (results.length === 0) return 0;
  const totalGPA = results.reduce((sum, r) => sum + r.gpa, 0);
  return Math.round((totalGPA / results.length) * 100) / 100;
}

// Calculate grade from marks for a specific component (theory/practical)
export function getGradeFromMarks(marks: number, fullMarks: number): string {
  const percentage = (marks / fullMarks) * 100;
  
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 40) return "C";
  return "NG";
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
  return "Needs Improvement";
}

// Get current academic year in single format (e.g., "2081")
export function getCurrentAcademicYear(): string {
  const now = new Date();
  // Nepal academic year: AD year + 56.7 approximately
  // The Nepali year is about 56-57 years ahead of AD
  const adYear = now.getFullYear();
  // Nepali new year starts around mid-April
  // Before mid-April, use current AD year + 56, after mid-April use AD year + 57
  const nepaliYear = adYear + 56 + (now.getMonth() >= 3 ? 1 : 0);
  return nepaliYear.toString();
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case "A+":
      return "text-green-600 dark:text-green-400";
    case "A":
      return "text-green-500 dark:text-green-300";
    case "B+":
      return "text-blue-600 dark:text-blue-400";
    case "B":
      return "text-blue-500 dark:text-blue-300";
    case "C+":
      return "text-yellow-600 dark:text-yellow-400";
    case "C":
      return "text-yellow-500 dark:text-yellow-300";
    case "NG":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}
