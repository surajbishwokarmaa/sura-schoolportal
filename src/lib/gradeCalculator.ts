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
