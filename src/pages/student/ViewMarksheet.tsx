import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, GraduationCap, FileText } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { generateMarksheetPDF } from '@/lib/pdfGenerator';
import { calculateOverallGPA, getGradeColor } from '@/lib/gradeCalculator';
import { useToast } from '@/hooks/use-toast';

interface StudentData {
  id: string;
  name: string;
  roll_no: string;
  class: string;
  section: string;
  photo_url: string | null;
}

interface Result {
  subject: string;
  theory_marks: number | null;
  practical_marks: number | null;
  total_marks: number | null;
  grade: string | null;
  gpa: number | null;
}

const ViewMarksheet = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [totalSubjectsForClass, setTotalSubjectsForClass] = useState<number>(0);
  const [allSubjectsComplete, setAllSubjectsComplete] = useState<boolean>(false);
  const [selectedTerm, setSelectedTerm] = useState<'first_term' | 'second_term' | 'third_term' | 'final_term'>('first_term');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || userRole !== 'student') {
      navigate('/auth/student');
      return;
    }
    fetchStudentData();
  }, [user, userRole]);

  useEffect(() => {
    if (studentData) {
      fetchResults();
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

  const fetchResults = async () => {
    if (!studentData) return;

    try {
      // First, get the class_id for the student's class
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('name', studentData.class)
        .maybeSingle();

      if (classError) throw classError;

      // Get total subjects for this class
      let totalSubjects = 0;
      if (classData) {
        const { count, error: subjectCountError } = await supabase
          .from('subjects')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classData.id);

        if (!subjectCountError && count) {
          totalSubjects = count;
          setTotalSubjectsForClass(count);
        }
      }

      // Get student's results for this term
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('student_id', studentData.id)
        .eq('term', selectedTerm)
        .order('subject');

      if (error) throw error;

      if (data) {
        setResults(data as Result[]);
        // Check if all subjects have results
        const isComplete = totalSubjects > 0 && data.length >= totalSubjects;
        setAllSubjectsComplete(isComplete);
      }
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
    if (results.length === 0) return { gpa: 0, totalMarks: 0, percentage: 0 };
    
    const totalMarks = results.reduce((sum, r) => sum + (r.total_marks || 0), 0);
    const maxMarks = results.length * 100;
    const percentage = (totalMarks / maxMarks) * 100;
    const validResults = results.filter(r => r.gpa !== null).map(r => ({ gpa: r.gpa as number }));
    const gpa = validResults.length > 0 ? calculateOverallGPA(validResults) : 0;

    return { gpa, totalMarks, percentage };
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
    if (!studentData || results.length === 0 || !allSubjectsComplete) {
      toast({
        title: 'Cannot Download',
        description: allSubjectsComplete ? 'No results available to download' : 'Results are incomplete. Please wait until all subjects are graded.',
        variant: 'destructive'
      });
      return;
    }

    const metrics = calculateOverallMetrics();
    
    await generateMarksheetPDF({
      student: {
        name: studentData.name,
        rollNo: studentData.roll_no,
        class: studentData.class,
        section: studentData.section,
        photoUrl: studentData.photo_url
      },
      results: results.map(r => ({
        subject: r.subject,
        theoryMarks: r.theory_marks || 0,
        practicalMarks: r.practical_marks || 0,
        totalMarks: r.total_marks || 0,
        grade: r.grade || 'N/A',
        gpa: r.gpa || 0
      })),
      term: getTermDisplay(),
      academicYear: '2081-2082',
      overallGPA: metrics.gpa,
      totalMarks: metrics.totalMarks,
      percentage: metrics.percentage,
      schoolInfo: {
        name: 'School Management System',
        address: 'Kathmandu, Nepal'
      }
    });
  };

  const metrics = calculateOverallMetrics();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="no-print mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate('/student')} className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
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
            <Button onClick={handleDownloadPDF} disabled={results.length === 0 || !allSubjectsComplete} className="w-full sm:w-auto">
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
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">School Management System</h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-1">Kathmandu, Nepal</p>
            <h2 className="text-lg sm:text-xl font-semibold mt-4 bg-muted py-2 px-4 rounded">
              Student Marksheet - {getTermDisplay()}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">Academic Year: 2081-2082</p>
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
              {studentData.photo_url && (
                <div className="flex justify-center sm:justify-end">
                  <img
                    src={studentData.photo_url}
                    alt="Student"
                    className="w-24 h-28 sm:w-28 sm:h-32 object-cover border-2 border-border rounded"
                  />
                </div>
              )}
            </div>
          )}

          {/* Results Status */}
          {!allSubjectsComplete && results.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-amber-800 dark:text-amber-200 text-sm sm:text-base text-center">
                ⏳ Results are being processed. {results.length} of {totalSubjectsForClass} subjects completed.
                <br />
                <span className="text-xs sm:text-sm">Final marksheet will be available once all subjects are graded.</span>
              </p>
            </div>
          )}

          {/* Results Table - Only show when ALL subjects are complete */}
          {allSubjectsComplete && results.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-6 sm:mb-8">
                <table className="w-full border-collapse text-sm sm:text-base">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-2 sm:p-3 text-left">S.N.</th>
                      <th className="border border-border p-2 sm:p-3 text-left">Subject</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Theory</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Practical</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Total</th>
                      <th className="border border-border p-2 sm:p-3 text-center">Grade</th>
                      <th className="border border-border p-2 sm:p-3 text-center">GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="border border-border p-2 sm:p-3">{index + 1}</td>
                        <td className="border border-border p-2 sm:p-3">{result.subject}</td>
                        <td className="border border-border p-2 sm:p-3 text-center">{result.theory_marks ?? '-'}</td>
                        <td className="border border-border p-2 sm:p-3 text-center">{result.practical_marks ?? '-'}</td>
                        <td className="border border-border p-2 sm:p-3 text-center font-semibold">{result.total_marks ?? '-'}</td>
                        <td className={`border border-border p-2 sm:p-3 text-center font-bold ${getGradeColor(result.grade || '')}`}>
                          {result.grade || '-'}
                        </td>
                        <td className="border border-border p-2 sm:p-3 text-center">{result.gpa?.toFixed(1) ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary - Only shown when complete */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Marks Obtained</p>
                  <p className="text-2xl sm:text-3xl font-bold">{metrics.totalMarks}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Overall GPA</p>
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{metrics.gpa.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Percentage</p>
                  <p className="text-2xl sm:text-3xl font-bold">{metrics.percentage.toFixed(2)}%</p>
                </div>
              </div>
            </>
          ) : !allSubjectsComplete && results.length > 0 ? null : (
            <div className="text-center py-8 sm:py-12">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-base sm:text-lg text-muted-foreground">No results available for this term</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ViewMarksheet;
