import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText } from 'lucide-react';

interface Result {
  id: string;
  student_id: string;
  subject: string;
  term: string;
  theory_marks: number;
  practical_marks: number;
  total_marks: number;
  grade: string;
  gpa: number;
  students: {
    name: string;
    roll_no: string;
  };
}

const ViewResults = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  
  const [teacherData, setTeacherData] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'first_term' | 'second_term' | 'third_term'>('first_term');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || userRole !== 'teacher') {
      navigate('/auth/teacher');
      return;
    }
    fetchTeacherData();
  }, [user, userRole]);

  const fetchTeacherData = async () => {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    if (data) setTeacherData(data);
  };

  const fetchResults = async () => {
    if (!selectedClass || !selectedSubject || !teacherData) return;

    setLoading(true);
    const { data } = await supabase
      .from('results')
      .select(`
        *,
        students (name, roll_no)
      `)
      .eq('teacher_id', teacherData.id)
      .eq('class', selectedClass)
      .eq('subject', selectedSubject)
      .eq('term', selectedTerm)
      .order('students(roll_no)');

    if (data) setResults(data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedClass && selectedSubject && teacherData) {
      fetchResults();
    }
  }, [selectedClass, selectedSubject, selectedTerm, teacherData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/teacher')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-3xl font-bold mb-8">View Results</h1>

        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {teacherData?.classes_assigned.map((className: string) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {teacherData?.subjects.map((subject: string) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Term</Label>
              <Select value={selectedTerm} onValueChange={(v: any) => setSelectedTerm(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_term">First Term</SelectItem>
                  <SelectItem value="second_term">Second Term</SelectItem>
                  <SelectItem value="third_term">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading results...</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Roll No</th>
                    <th className="text-left py-3 px-4">Student Name</th>
                    <th className="text-center py-3 px-4">Theory</th>
                    <th className="text-center py-3 px-4">Practical</th>
                    <th className="text-center py-3 px-4">Total</th>
                    <th className="text-center py-3 px-4">Grade</th>
                    <th className="text-center py-3 px-4">GPA</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{result.students.roll_no}</td>
                      <td className="py-3 px-4">{result.students.name}</td>
                      <td className="text-center py-3 px-4">{result.theory_marks}</td>
                      <td className="text-center py-3 px-4">{result.practical_marks}</td>
                      <td className="text-center py-3 px-4 font-medium">{result.total_marks}</td>
                      <td className="text-center py-3 px-4">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                          {result.grade}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 font-medium">{result.gpa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && results.length === 0 && selectedClass && selectedSubject && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No results found for the selected filters</p>
            </div>
          )}

          {!selectedClass && !selectedSubject && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Please select class and subject to view results</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ViewResults;
