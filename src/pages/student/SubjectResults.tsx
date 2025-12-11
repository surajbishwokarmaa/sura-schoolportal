import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, BookOpen, TrendingUp, Award } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getGradeColor } from '@/lib/gradeCalculator';
import { useToast } from '@/hooks/use-toast';

interface StudentData {
  id: string;
  name: string;
  class: string;
  section: string;
}

interface Result {
  id: string;
  subject: string;
  theory_marks: number | null;
  practical_marks: number | null;
  total_marks: number | null;
  grade: string | null;
  gpa: number | null;
  remarks: string | null;
}

const SubjectResults = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [results, setResults] = useState<Result[]>([]);
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
        .select('id, name, class, section')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      setStudentData(data);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to fetch student data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    if (!studentData) return;

    try {
      const { data, error } = await supabase
        .from('results')
        .select('id, subject, theory_marks, practical_marks, total_marks, grade, gpa, remarks')
        .eq('student_id', studentData.id)
        .eq('term', selectedTerm)
        .order('subject');

      if (error) throw error;
      setResults(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to fetch results', variant: 'destructive' });
    }
  };

  const getTermDisplay = (term: string) => {
    const termMap: Record<string, string> = {
      'first_term': 'First Term',
      'second_term': 'Second Term',
      'third_term': 'Third Term',
      'final_term': 'Final Exam'
    };
    return termMap[term] || term;
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate('/student')} className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
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
        </div>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Subject-wise Results</h1>
          <p className="text-muted-foreground mt-1">{getTermDisplay(selectedTerm)} - Academic Year 2081-2082</p>
        </div>

        {results.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Results Available</h3>
            <p className="text-muted-foreground">Results for this term have not been published yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {results.map((result) => (
              <Card key={result.id} className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">{result.subject}</h3>
                  </div>
                  <span className={`text-2xl font-bold ${getGradeColor(result.grade || '')}`}>
                    {result.grade || '-'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Theory Marks</span>
                    <span className="font-semibold">{result.theory_marks ?? '-'} / 75</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Practical Marks</span>
                    <span className="font-semibold">{result.practical_marks ?? '-'} / 25</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                    <span className="text-sm font-medium">Total Marks</span>
                    <span className="font-bold text-lg">{result.total_marks ?? '-'} / 100</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">GPA</span>
                  </div>
                  <span className="font-bold text-primary">{result.gpa?.toFixed(1) ?? '-'}</span>
                </div>

                {result.remarks && (
                  <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Remarks:</span> {result.remarks}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <Card className="mt-6 p-4 sm:p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Subjects</p>
                <p className="text-2xl font-bold">{results.length}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Marks</p>
                <p className="text-2xl font-bold">
                  {results.reduce((sum, r) => sum + (r.total_marks || 0), 0)}
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Percentage</p>
                <p className="text-2xl font-bold">
                  {((results.reduce((sum, r) => sum + (r.total_marks || 0), 0) / (results.length * 100)) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Overall GPA</p>
                <p className="text-2xl font-bold text-primary">
                  {(results.reduce((sum, r) => sum + (r.gpa || 0), 0) / results.length).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SubjectResults;
