import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, AlertCircle, User, Edit, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LogoutConfirmDialog } from '@/components/LogoutConfirmDialog';

interface Student {
  id: string;
  name: string;
  roll_no: string;
  photo_url: string | null;
}

interface ResultEntry {
  student_id: string;
  theory_marks: number;
  practical_marks: number;
}

interface ClassData {
  id: string;
  name: string;
  sections: string[] | null;
}

interface SubjectData {
  id: string;
  name: string;
  theory_full_marks: number;
  practical_full_marks: number;
  total_marks: number;
}

const ResultEntry = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'first_term' | 'second_term' | 'third_term' | 'final_term'>('first_term');
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<SubjectData | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [submittedTerms, setSubmittedTerms] = useState<string[]>([]);

  // Get sections for selected class from database
  const availableSections = classes.find(c => c.name === selectedClass)?.sections || [];

  useEffect(() => {
    if (!user || userRole !== 'teacher') {
      navigate('/auth/teacher');
      return;
    }
    fetchTeacherData();
    fetchClasses();
  }, [user, userRole]);

  // Reset section when class changes and fetch subjects
  useEffect(() => {
    setSelectedSection('');
    setSelectedSubject('');
    setStudents([]);
    setResults([]);
    setSubmittedTerms([]);
    setIsEditMode(false);
    
    if (selectedClass) {
      const classData = classes.find(c => c.name === selectedClass);
      if (classData) {
        setSelectedClassId(classData.id);
        fetchSubjectsForClass(classData.id);
      }
    }
  }, [selectedClass, classes]);

  // Check which terms are already submitted when subject changes
  useEffect(() => {
    if (selectedClass && selectedSection && selectedSubject && teacherData) {
      checkSubmittedTerms();
    }
  }, [selectedClass, selectedSection, selectedSubject, teacherData]);

  const checkSubmittedTerms = async () => {
    if (!selectedClass || !selectedSubject || !teacherData) return;
    
    try {
      const { data, error } = await supabase
        .from('results')
        .select('term')
        .eq('class', selectedClass)
        .eq('subject', selectedSubject)
        .eq('teacher_id', teacherData.id);
      
      if (error) throw error;
      
      const uniqueTerms = [...new Set(data?.map(r => r.term) || [])];
      setSubmittedTerms(uniqueTerms);
    } catch (error) {
      console.error('Error checking submitted terms:', error);
    }
  };

  // Update current subject when subject selection changes
  useEffect(() => {
    const subject = subjects.find(s => s.name === selectedSubject);
    setCurrentSubject(subject || null);
  }, [selectedSubject, subjects]);

  // Fetch students when all selections are made
  useEffect(() => {
    if (selectedClass && selectedSection && selectedSubject) {
      fetchStudents();
    }
  }, [selectedClass, selectedSection, selectedSubject, selectedTerm]);

  const fetchTeacherData = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setTeacherData(data);
      }
    } catch (error: any) {
      console.error('Error fetching teacher data:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, sections')
        .order('name');
      
      if (error) throw error;
      
      if (data) setClasses(data);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchSubjectsForClass = async (classId: string) => {
    if (!teacherData?.subjects || teacherData.subjects.length === 0) {
      setSubjects([]);
      return;
    }

    try {
      // First get all subjects for this class
      const { data: allSubjects, error } = await supabase
        .from('subjects')
        .select('id, name, theory_full_marks, practical_full_marks, total_marks')
        .eq('class_id', classId)
        .order('name');

      if (error) throw error;

      if (allSubjects && allSubjects.length > 0) {
        // Filter by teacher's assigned subjects (case-insensitive)
        const teacherSubjectsLower = teacherData.subjects.map((s: string) => s.toLowerCase());
        const matchingSubjects = allSubjects.filter(subj => 
          teacherSubjectsLower.includes(subj.name.toLowerCase())
        );

        if (matchingSubjects.length > 0) {
          setSubjects(matchingSubjects);
          // Auto-select first subject if only one assigned
          if (matchingSubjects.length === 1) {
            setSelectedSubject(matchingSubjects[0].name);
          }
        } else {
          setSubjects([]);
          toast({
            title: 'No Subjects Found',
            description: `Your assigned subjects (${teacherData.subjects.join(', ')}) are not configured for this class yet.`,
            variant: 'destructive'
          });
        }
      } else {
        setSubjects([]);
        toast({
          title: 'No Subjects Found',
          description: 'No subjects configured for this class. Please ask admin to add subjects.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error fetching subjects:', error);
      setSubjects([]);
    }
  };

  const fetchStudents = async () => {
    if (!selectedClass || !selectedSection || !selectedSubject) {
      setStudents([]);
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, roll_no, photo_url')
        .eq('class', selectedClass)
        .eq('section', selectedSection)
        .eq('is_active', true)
        .order('roll_no');

      if (studentsError) throw studentsError;

      if (!studentsData || studentsData.length === 0) {
        toast({
          title: 'No Students Found',
          description: `No students found in ${selectedClass} - ${selectedSection}`,
        });
        setStudents([]);
        setResults([]);
        setLoading(false);
        return;
      }

      setStudents(studentsData);

      // Check if results already exist for this class, section, subject, and term
      const { data: existingResults, error: resultsError } = await supabase
        .from('results')
        .select('student_id, theory_marks, practical_marks')
        .eq('class', selectedClass)
        .eq('subject', selectedSubject)
        .eq('term', selectedTerm);

      if (resultsError) {
        console.error('Error fetching existing results:', resultsError);
      }

      // Check if this term has existing results - if so, enable edit mode
      const hasExistingResults = existingResults && existingResults.length > 0;
      setIsEditMode(hasExistingResults);

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
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch students',
        variant: 'destructive'
      });
      setStudents([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateGradeAndGPA = (totalMarks: number) => {
    if (totalMarks >= 90) return { grade: 'A+', gpa: 4.0 };
    if (totalMarks >= 80) return { grade: 'A', gpa: 3.6 };
    if (totalMarks >= 70) return { grade: 'B+', gpa: 3.2 };
    if (totalMarks >= 60) return { grade: 'B', gpa: 2.8 };
    if (totalMarks >= 50) return { grade: 'C+', gpa: 2.4 };
    if (totalMarks >= 40) return { grade: 'C', gpa: 2.0 };
    if (totalMarks >= 35) return { grade: 'D', gpa: 1.6 };
    return { grade: 'NG', gpa: 0.8 };
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
      const resultsToInsert = await Promise.all(
        results.map(async r => {
          try {
            // Call AI calculation edge function
            const { data: calcData, error: calcError } = await supabase.functions.invoke('calculate-result', {
              body: {
                theoryMarks: r.theory_marks,
                practicalMarks: r.practical_marks,
                fullMarks: currentSubject?.total_marks || 100
              }
            });

            if (calcError) throw calcError;

            return {
              student_id: r.student_id,
              teacher_id: teacherData.id,
              class: selectedClass,
              subject: selectedSubject,
              term: selectedTerm,
              theory_marks: r.theory_marks,
              practical_marks: r.practical_marks,
              total_marks: calcData.totalMarks,
              grade: calcData.grade,
              gpa: calcData.gpa,
              remarks: calcData.remarks,
              status: 'approved' as const
            };
          } catch (aiError) {
            console.error('AI calculation failed for student, using fallback:', aiError);
            // Fallback to local calculation
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
          }
        })
      );

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

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Filter classes that teacher is assigned to
  const teacherClasses = teacherData?.classes_assigned || [];
  const theoryMax = currentSubject?.theory_full_marks || 75;
  const practicalMax = currentSubject?.practical_full_marks || 25;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Button variant="ghost" onClick={() => navigate('/teacher')} className="mb-4 sm:mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Result Entry</h1>

        <Card className="p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map((className: string) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Section</Label>
              <Select 
                value={selectedSection} 
                onValueChange={setSelectedSection} 
                disabled={!selectedClass || availableSections.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={availableSections.length === 0 ? "No sections available" : "Select Section"} />
                </SelectTrigger>
                <SelectContent>
                  {availableSections.map((section: string) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClass && availableSections.length === 0 && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No sections configured for this class
                </p>
              )}
            </div>

            {/* Subject Tabs - Auto-loaded based on teacher's assignment */}
            <div className="sm:col-span-2 lg:col-span-2">
              <Label>Your Subject(s)</Label>
              {subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {subjects.map((subject) => (
                    <Button
                      key={subject.id}
                      type="button"
                      variant={selectedSubject === subject.name ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSubject(subject.name)}
                      className="transition-all"
                    >
                      {subject.name}
                    </Button>
                  ))}
                </div>
              ) : selectedClass ? (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  No subjects found for your assignment in this class
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  Select a class to see your subjects
                </p>
              )}
            </div>

            <div>
              <Label>Term</Label>
              <Select value={selectedTerm} onValueChange={(v: any) => setSelectedTerm(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_term">
                    <div className="flex items-center gap-2">
                      First Term
                      {submittedTerms.includes('first_term') && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Submitted
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="second_term">
                    <div className="flex items-center gap-2">
                      Second Term
                      {submittedTerms.includes('second_term') && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Submitted
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="third_term">
                    <div className="flex items-center gap-2">
                      Third Term
                      {submittedTerms.includes('third_term') && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Submitted
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="final_term">
                    <div className="flex items-center gap-2">
                      Final Exam
                      {submittedTerms.includes('final_term') && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Submitted
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Edit mode indicator */}
          {isEditMode && selectedClass && selectedSection && selectedSubject && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm flex items-center gap-2">
              <Edit className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700 dark:text-amber-400">
                <strong>Edit Mode:</strong> Results for this term have already been submitted. You are now editing existing marks.
              </span>
            </div>
          )}

          {currentSubject && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
              <span className="font-medium">Subject: </span>{currentSubject.name} | 
              <span className="ml-2">Theory: {currentSubject.theory_full_marks}</span> | 
              <span className="ml-2">Practical: {currentSubject.practical_full_marks}</span> | 
              <span className="ml-2 font-medium">Total: {currentSubject.total_marks}</span>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading students...</p>
            </div>
          )}

          {!loading && students.length === 0 && selectedClass && selectedSection && selectedSubject && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No students found. Please check your selections.</p>
            </div>
          )}

          {!loading && !selectedClass && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please select a class to begin</p>
            </div>
          )}

          {!loading && selectedClass && !selectedSection && availableSections.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please select a section</p>
            </div>
          )}

          {!loading && students.length > 0 && (
            <>
              {/* Mobile: Card-style layout */}
              <div className="block lg:hidden space-y-4">
                {students.map((student) => {
                  const result = results.find(r => r.student_id === student.id);
                  const total = (result?.theory_marks || 0) + (result?.practical_marks || 0);
                  const { grade, gpa } = calculateGradeAndGPA(total);

                  return (
                    <Card key={student.id} className="p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar className="w-12 h-12 border-2 border-primary/20">
                          <AvatarImage src={student.photo_url || ''} alt={student.name} />
                          <AvatarFallback className="bg-primary/10">
                            <User className="w-6 h-6 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-semibold">{student.name}</h4>
                          <p className="text-sm text-muted-foreground">Roll: {student.roll_no}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium">
                            {grade}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Theory ({theoryMax})</Label>
                          <Input
                            type="number"
                            min="0"
                            max={theoryMax}
                            value={result?.theory_marks || 0}
                            onChange={(e) => updateResult(student.id, 'theory_marks', e.target.value)}
                            className="text-center"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Practical ({practicalMax})</Label>
                          <Input
                            type="number"
                            min="0"
                            max={practicalMax}
                            value={result?.practical_marks || 0}
                            onChange={(e) => updateResult(student.id, 'practical_marks', e.target.value)}
                            className="text-center"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <span>Total: <strong>{total}</strong></span>
                        <span>GPA: <strong>{gpa.toFixed(1)}</strong></span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4">Photo</th>
                      <th className="text-left py-3 px-4">Roll</th>
                      <th className="text-left py-3 px-4">Name</th>
                      <th className="text-center py-3 px-4">Theory ({theoryMax})</th>
                      <th className="text-center py-3 px-4">Practical ({practicalMax})</th>
                      <th className="text-center py-3 px-4">Total</th>
                      <th className="text-center py-3 px-4">Grade</th>
                      <th className="text-center py-3 px-4">GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const result = results.find(r => r.student_id === student.id);
                      const total = (result?.theory_marks || 0) + (result?.practical_marks || 0);
                      const { grade, gpa } = calculateGradeAndGPA(total);

                      return (
                        <tr key={student.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <Avatar className="w-10 h-10 border-2 border-primary/20">
                              <AvatarImage src={student.photo_url || ''} alt={student.name} />
                              <AvatarFallback className="bg-primary/10 text-xs">
                                <User className="w-5 h-5 text-primary" />
                              </AvatarFallback>
                            </Avatar>
                          </td>
                          <td className="py-3 px-4 font-medium">{student.roll_no}</td>
                          <td className="py-3 px-4">{student.name}</td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              min="0"
                              max={theoryMax}
                              value={result?.theory_marks || 0}
                              onChange={(e) => updateResult(student.id, 'theory_marks', e.target.value)}
                              className="w-20 mx-auto text-center"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              min="0"
                              max={practicalMax}
                              value={result?.practical_marks || 0}
                              onChange={(e) => updateResult(student.id, 'practical_marks', e.target.value)}
                              className="w-20 mx-auto text-center"
                            />
                          </td>
                          <td className="text-center py-3 px-4 font-semibold">{total}</td>
                          <td className="text-center py-3 px-4">
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium">
                              {grade}
                            </span>
                          </td>
                          <td className="text-center py-3 px-4 font-medium">{gpa.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveResults} disabled={loading} size="lg">
                  {isEditMode ? <Edit className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {loading ? 'Saving...' : isEditMode ? 'Update Results' : 'Save Results'}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <LogoutConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        onConfirm={handleLogout}
      />
    </div>
  );
};

export default ResultEntry;
