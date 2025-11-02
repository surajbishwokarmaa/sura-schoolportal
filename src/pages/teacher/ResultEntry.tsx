import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  roll_no: string;
}

interface ResultEntry {
  student_id: string;
  theory_marks: number;
  practical_marks: number;
}

const ResultEntry = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'first_term' | 'second_term' | 'third_term'>('first_term');
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || userRole !== 'teacher') {
      navigate('/auth/teacher');
      return;
    }
    fetchTeacherData();
    fetchClasses();
  }, [user, userRole]);

  const fetchTeacherData = async () => {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    if (data) setTeacherData(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .order('name');
    
    if (data) setClasses(data);
  };

  const fetchStudents = async () => {
    if (!selectedClass || !selectedSection || !selectedSubject) return;

    setLoading(true);

    const { data: studentsData } = await supabase
      .from('students')
      .select('id, name, roll_no')
      .eq('class', selectedClass)
      .eq('section', selectedSection)
      .eq('is_active', true)
      .order('roll_no');

    if (studentsData) {
      setStudents(studentsData);

      // Check if results already exist for this class, section, subject, and term
      const { data: existingResults } = await supabase
        .from('results')
        .select('student_id, theory_marks, practical_marks')
        .eq('class', selectedClass)
        .eq('subject', selectedSubject)
        .eq('term', selectedTerm);

      // Map existing results or default to 0
      const resultsMap = new Map(
        existingResults?.map(r => [r.student_id, r]) || []
      );

      setResults(studentsData.map(s => {
        const existing = resultsMap.get(s.id);
        return {
          student_id: s.id,
          theory_marks: existing?.theory_marks || 0,
          practical_marks: existing?.practical_marks || 0
        };
      }));
    }

    setLoading(false);
  };

  useEffect(() => {
    if (selectedClass && selectedSection && selectedSubject) {
      fetchStudents();
    }
  }, [selectedClass, selectedSection, selectedSubject, selectedTerm]);

  const calculateGradeAndGPA = (totalMarks: number) => {
    if (totalMarks >= 90) return { grade: 'A+', gpa: 4.0 };
    if (totalMarks >= 80) return { grade: 'A', gpa: 3.6 };
    if (totalMarks >= 70) return { grade: 'B+', gpa: 3.2 };
    if (totalMarks >= 60) return { grade: 'B', gpa: 2.8 };
    if (totalMarks >= 50) return { grade: 'C+', gpa: 2.4 };
    if (totalMarks >= 40) return { grade: 'C', gpa: 2.0 };
    if (totalMarks >= 35) return { grade: 'D', gpa: 1.6 };
    return { grade: 'E', gpa: 0.8 };
  };

  const updateResult = (studentId: string, field: 'theory_marks' | 'practical_marks', value: string) => {
    const numValue = parseFloat(value) || 0;
    setResults(prev => 
      prev.map(r => 
        r.student_id === studentId 
          ? { ...r, [field]: numValue }
          : r
      )
    );
  };

  const handleSaveResults = async () => {
    if (!selectedClass || !selectedSection || !selectedSubject || !teacherData) {
      toast({
        title: 'Error',
        description: 'Please select class, section, and subject',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const resultsToInsert = results.map(r => {
        const totalMarks = r.theory_marks + r.practical_marks;
        const { grade, gpa } = calculateGradeAndGPA(totalMarks);
        
        return {
          student_id: r.student_id,
          teacher_id: teacherData.id,
          class: selectedClass,
          subject: selectedSubject,
          term: selectedTerm,
          theory_marks: r.theory_marks,
          practical_marks: r.practical_marks,
          total_marks: totalMarks,
          grade,
          gpa,
          status: 'approved' as const
        };
      });

      const { error } = await supabase
        .from('results')
        .upsert(resultsToInsert, { 
          onConflict: 'student_id,subject,term',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Results saved successfully',
      });

      navigate('/teacher');
    } catch (error) {
      console.error('Error saving results:', error);
      toast({
        title: 'Error',
        description: 'Failed to save results',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedClassData = classes.find(c => c.name === selectedClass);
  const availableSubjects = teacherData?.subjects || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/teacher')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-3xl font-bold mb-8">Result Entry</h1>

        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              <Label>Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {selectedClassData?.sections.map((section: string) => (
                    <SelectItem key={section} value={section}>
                      {section}
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
                  {availableSubjects.map((subject: string) => (
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

          {students.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Roll No</th>
                      <th className="text-left py-3 px-4">Student Name</th>
                      <th className="text-center py-3 px-4">Theory Marks</th>
                      <th className="text-center py-3 px-4">Practical Marks</th>
                      <th className="text-center py-3 px-4">Total</th>
                      <th className="text-center py-3 px-4">Grade</th>
                      <th className="text-center py-3 px-4">GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => {
                      const result = results.find(r => r.student_id === student.id);
                      const total = (result?.theory_marks || 0) + (result?.practical_marks || 0);
                      const { grade, gpa } = calculateGradeAndGPA(total);

                      return (
                        <tr key={student.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{student.roll_no}</td>
                          <td className="py-3 px-4">{student.name}</td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              min="0"
                              max="75"
                              value={result?.theory_marks || 0}
                              onChange={(e) => updateResult(student.id, 'theory_marks', e.target.value)}
                              className="w-24 mx-auto"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              min="0"
                              max="25"
                              value={result?.practical_marks || 0}
                              onChange={(e) => updateResult(student.id, 'practical_marks', e.target.value)}
                              className="w-24 mx-auto"
                            />
                          </td>
                          <td className="text-center py-3 px-4 font-medium">{total}</td>
                          <td className="text-center py-3 px-4">
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                              {grade}
                            </span>
                          </td>
                          <td className="text-center py-3 px-4 font-medium">{gpa}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveResults} disabled={loading} size="lg">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Results'}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResultEntry;
