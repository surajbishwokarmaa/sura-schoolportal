import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudent } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, GraduationCap, Clock, Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { generateMarksheetPDF } from '@/lib/pdfGenerator';
import { calculateOverallGPA, getGradeColor, getGradeFromMarks, getFinalRemarks, getCurrentAcademicYear } from '@/lib/gradeCalculator';
import { useToast } from '@/hooks/use-toast';

interface StudentData {
  id: string;
  name: string;
  roll_no: string;
  class: string;
  section: string;
  photo_url: string | null;
}

interface SubjectInfo {
  id: string;
  name: string;
  theory_full_marks: number;
  practical_full_marks: number;
  total_marks: number;
}

interface Result {
  subject: string;
  theory_marks: number | null;
  practical_marks: number | null;
  total_marks: number | null;
  grade: string | null;
  gpa: number | null;
}

interface DisplayResult extends Result {
  isPending: boolean;
  theoryFull: number;
  practicalFull: number;
  totalFull: number;
  theoryGrade: string;
  practicalGrade: string;
  totalGrade: string;
}

const ViewMarksheet = () => {
  const { user, userRole } = useAuth();
  const { selectedStudent, allStudents, hasMultipleStudents, isLoading: studentContextLoading, setSelectedStudent, clearStudentSelection } = useStudent();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectInfo[]>([]);
  const [displayResults, setDisplayResults] = useState<DisplayResult[]>([]);
  const [allSubjectsComplete, setAllSubjectsComplete] = useState<boolean>(false);
  const [selectedTerm, setSelectedTerm] = useState<'first_term' | 'second_term' | 'third_term' | 'final_term'>('first_term');
  const [loading, setLoading] = useState(true);

  const academicYear = getCurrentAcademicYear();

  useEffect(() => {
    if (!user || userRole !== 'student') {
      navigate('/auth/student');
      return;
    }
    
    // Wait for context to finish loading
    if (studentContextLoading) {
      return;
    }
    
    // If multiple students and none selected, just show picker
    if (hasMultipleStudents && !selectedStudent) {
      setLoading(false);
      return;
    }
    
    if (selectedStudent) {
      setStudentData({
        id: selectedStudent.id,
        name: selectedStudent.name,
        roll_no: selectedStudent.roll_no,
        class: selectedStudent.class,
        section: selectedStudent.section,
        photo_url: selectedStudent.photo_url
      });
      setLoading(false);
    } else if (allStudents.length === 1) {
      const student = allStudents[0];
      setStudentData({
        id: student.id,
        name: student.name,
        roll_no: student.roll_no,
        class: student.class,
        section: student.section,
        photo_url: student.photo_url
      });
      setLoading(false);
    } else {
      fetchStudentData();
    }
  }, [user, userRole, selectedStudent, hasMultipleStudents, studentContextLoading, allStudents]);

  useEffect(() => {
    if (studentData) {
      fetchSubjectsAndResults();
    }
  }, [studentData, selectedTerm]);

  const fetchStudentData = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setStudentData(data);
      } else {
        toast({
          title: 'No Student Record',
          description: 'No student record found for your account',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error fetching student data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch student data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectsAndResults = async () => {
    if (!studentData) return;

    try {
      // First, get the class_id for the student's class
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('name', studentData.class)
        .maybeSingle();

      if (classError) throw classError;

      // Get ALL subjects for this class
      let subjects: SubjectInfo[] = [];
      if (classData) {
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, name, theory_full_marks, practical_full_marks, total_marks')
          .eq('class_id', classData.id)
          .order('name');

        if (!subjectsError && subjectsData) {
          subjects = subjectsData;
          setAllSubjects(subjectsData);
        }
      }

      // Get student's results for this term
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('student_id', studentData.id)
        .eq('term', selectedTerm)
        .order('subject');

      if (resultsError) throw resultsError;

      const resultsList = (resultsData || []) as Result[];
      setResults(resultsList);

      // Create display results with all subjects - showing pending for missing ones
      const display: DisplayResult[] = subjects.map(subject => {
        // Case-insensitive match for results
        const existingResult = resultsList.find(
          r => r.subject.toLowerCase() === subject.name.toLowerCase()
        );

        if (existingResult) {
          // Calculate grades for each component
          const theoryGrade = existingResult.theory_marks !== null 
            ? getGradeFromMarks(existingResult.theory_marks, subject.theory_full_marks)
            : '-';
          const practicalGrade = existingResult.practical_marks !== null
            ? getGradeFromMarks(existingResult.practical_marks, subject.practical_full_marks)
            : '-';
          const totalGrade = existingResult.total_marks !== null
            ? getGradeFromMarks(existingResult.total_marks, subject.total_marks)
            : '-';

          return {
            subject: subject.name,
            theory_marks: existingResult.theory_marks,
            practical_marks: existingResult.practical_marks,
            total_marks: existingResult.total_marks,
            grade: existingResult.grade,
            gpa: existingResult.gpa,
            isPending: false,
            theoryFull: subject.theory_full_marks,
            practicalFull: subject.practical_full_marks,
            totalFull: subject.total_marks,
            theoryGrade,
            practicalGrade,
            totalGrade
          };
        } else {
          return {
            subject: subject.name,
            theory_marks: null,
            practical_marks: null,
            total_marks: null,
            grade: null,
            gpa: null,
            isPending: true,
            theoryFull: subject.theory_full_marks,
            practicalFull: subject.practical_full_marks,
            totalFull: subject.total_marks,
            theoryGrade: '-',
            practicalGrade: '-',
            totalGrade: '-'
          };
        }
      });

      setDisplayResults(display);

      // Check if ALL subjects have results
      const isComplete = subjects.length > 0 && display.every(d => !d.isPending);
      setAllSubjectsComplete(isComplete);

    } catch (error: any) {
      console.error('Error fetching results:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch results',
        variant: 'destructive'
      });
    }
  };

  const calculateOverallMetrics = () => {
    // Only calculate if ALL subjects are complete
    if (!allSubjectsComplete) {
      return { gpa: 0, totalMarks: 0, maxMarks: 0, percentage: 0, remarks: '' };
    }

    const completedResults = displayResults.filter(r => !r.isPending);
    if (completedResults.length === 0) return { gpa: 0, totalMarks: 0, maxMarks: 0, percentage: 0, remarks: '' };
    
    const totalMarks = completedResults.reduce((sum, r) => sum + (r.total_marks || 0), 0);
    const maxMarks = completedResults.reduce((sum, r) => sum + r.totalFull, 0);
    const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
    const validResults = completedResults.filter(r => r.gpa !== null).map(r => ({ gpa: r.gpa as number, grade: r.grade ?? undefined }));
    const gpa = validResults.length > 0 ? calculateOverallGPA(validResults) : 0;
    
    // Check if all subjects are passing
    const allPassing = completedResults.every(r => r.grade !== 'NG');
    const remarks = getFinalRemarks(percentage, allPassing);

    return { gpa, totalMarks, maxMarks, percentage, remarks };
  };

  const getTermDisplay = () => {
    const termMap: Record<string, string> = {
      'first_term': 'First Term',
      'second_term': 'Second Term',
      'third_term': 'Third Term',
      'final_term': 'Final Exam'
    };
    return termMap[selectedTerm] || 'First Term';
  };

  const handleDownloadPDF = async () => {
    if (!studentData || !allSubjectsComplete) {
      toast({
        title: 'Cannot Download',
        description: 'Results are incomplete. Please wait until all subjects are graded.',
        variant: 'destructive'
      });
      return;
    }

    const metrics = calculateOverallMetrics();
    const completedResults = displayResults.filter(r => !r.isPending);
    
    await generateMarksheetPDF({
      student: {
        name: studentData.name,
        rollNo: studentData.roll_no,
        class: studentData.class,
        section: studentData.section
      },
      results: completedResults.map(r => ({
        subject: r.subject,
        theoryMarks: r.theory_marks || 0,
        practicalMarks: r.practical_marks || 0,
        totalMarks: r.total_marks || 0,
        grade: r.grade || 'N/A',
        gpa: r.gpa || 0
      })),
      term: getTermDisplay(),
      academicYear: academicYear,
      overallGPA: metrics.gpa,
      totalMarks: metrics.totalMarks,
      percentage: metrics.percentage,
      schoolInfo: {
        name: 'Buddha Deep English Boarding School',
        address: 'Kathmandu, Nepal'
      }
    });
  };

  const handleStudentSelect = (student: typeof selectedStudent) => {
    setSelectedStudent(student);
  };

  const handleSwitchStudent = () => {
    clearStudentSelection();
  };

  const metrics = calculateOverallMetrics();
  const completedCount = displayResults.filter(r => !r.isPending).length;
  const totalSubjects = allSubjects.length;

  if (loading || studentContextLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Show student picker for parents with multiple children
  if (hasMultipleStudents && !selectedStudent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate('/student')} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Choose Student</h1>
            <p className="text-muted-foreground">Select which student's marksheet to view</p>
          </div>

          <div className="max-w-2xl mx-auto grid gap-4">
            {allStudents.map((student) => (
              <Card
                key={student.id}
                className="p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/50"
                onClick={() => handleStudentSelect(student)}
              >
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{student.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Roll: {student.roll_no}</span>
                      <span>Class: {student.class}</span>
                      <span>Section: {student.section}</span>
                    </div>
                  </div>
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="no-print mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/student')} className="self-start">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            {hasMultipleStudents && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSwitchStudent}
              >
                <Users className="w-4 h-4 mr-2" />
                Switch Student
              </Button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-full sm:w-48">
              <Select value={selectedTerm} onValueChange={(v: any) => setSelectedTerm(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_term">First Term</SelectItem>
                  <SelectItem value="second_term">Second Term</SelectItem>
                  <SelectItem value="third_term">Third Term</SelectItem>
                  <SelectItem value="final_term">Final Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleDownloadPDF} disabled={!allSubjectsComplete} className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              {allSubjectsComplete ? 'Download PDF' : 'Results Incomplete'}
            </Button>
          </div>
        </div>

        <Card className="p-4 sm:p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center border-b-2 border-border pb-4 sm:pb-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Buddha Deep English Boarding School</h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-1">Kathmandu, Nepal</p>
            <h2 className="text-lg sm:text-xl font-semibold mt-4 bg-muted py-2 px-4 rounded">
              Student Marksheet - {getTermDisplay()}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">Academic Year: {academicYear}</p>
          </div>

          {/* Student Info */}
          {studentData && (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-6 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm sm:text-base">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                  <span className="font-semibold min-w-[120px]">Student Name:</span>
                  <span>{studentData.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                  <span className="font-semibold min-w-[120px]">Roll Number:</span>
                  <span>{studentData.roll_no}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                  <span className="font-semibold min-w-[120px]">Class:</span>
                  <span>{studentData.class}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                  <span className="font-semibold min-w-[120px]">Section:</span>
                  <span>{studentData.section}</span>
                </div>
              </div>
            </div>
          )}

          {/* Results Status - Show when not all subjects are complete */}
          {!allSubjectsComplete && totalSubjects > 0 && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-amber-800 dark:text-amber-200 font-medium">
                    Result will be published after all subject marks are submitted
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    {completedCount} of {totalSubjects} subjects completed. Some subject teachers have not submitted marks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results Table - Show all subjects with GRADES instead of numbers */}
          {displayResults.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-6 sm:mb-8">
                <table className="w-full border-collapse text-sm sm:text-base">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-2 sm:p-3 text-left">S.N.</th>
                      <th className="border border-border p-2 sm:p-3 text-left">Subject</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Theory Grade</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Practical Grade</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Total Grade</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayResults.map((result, index) => (
                      <tr key={index} className={`hover:bg-muted/50 ${result.isPending ? 'bg-muted/30' : ''}`}>
                        <td className="border border-border p-2 sm:p-3">{index + 1}</td>
                        <td className="border border-border p-2 sm:p-3 capitalize">
                          {result.subject}
                        </td>
                        <td className={`border border-border p-2 sm:p-3 text-center font-bold ${result.isPending ? 'text-muted-foreground' : getGradeColor(result.theoryGrade)}`}>
                          {result.isPending ? '-' : result.theoryGrade}
                        </td>
                        <td className={`border border-border p-2 sm:p-3 text-center font-bold ${result.isPending ? 'text-muted-foreground' : getGradeColor(result.practicalGrade)}`}>
                          {result.isPending ? '-' : result.practicalGrade}
                        </td>
                        <td className={`border border-border p-2 sm:p-3 text-center font-bold ${result.isPending ? 'text-muted-foreground' : getGradeColor(result.totalGrade)}`}>
                          {result.isPending ? '-' : result.totalGrade}
                        </td>
                        <td className="border border-border p-2 sm:p-3 text-center">
                          {result.isPending ? (
                            <span className="text-amber-600 dark:text-amber-400 text-xs font-medium px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded">
                              Pending
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400 text-xs font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded">
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary - Only shown when all subjects are complete */}
              {allSubjectsComplete ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6 p-4 sm:p-6 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Overall GPA</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary">{metrics.gpa.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Percentage</p>
                    <p className="text-2xl sm:text-3xl font-bold">{metrics.percentage.toFixed(2)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Final Grade</p>
                    <p className={`text-2xl sm:text-3xl font-bold ${getGradeColor(getGradeFromMarks(metrics.totalMarks, metrics.maxMarks))}`}>
                      {getGradeFromMarks(metrics.totalMarks, metrics.maxMarks)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Remarks</p>
                    <p className="text-xl sm:text-2xl font-bold text-secondary">{metrics.remarks}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-6 bg-muted/30 rounded-lg text-center">
                  <p className="text-muted-foreground">
                    GPA, Percentage, Grade, and Remarks will be displayed after all subjects are completed.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Subjects Found</h3>
              <p className="text-muted-foreground">
                No subjects have been configured for your class yet.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ViewMarksheet;
