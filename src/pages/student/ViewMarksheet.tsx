import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, GraduationCap } from 'lucide-react';
import { Label } from '@/components/ui/label';

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
  theory_marks: number;
  practical_marks: number;
  total_marks: number;
  grade: string;
  gpa: number;
}

const ViewMarksheet = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<'first_term' | 'second_term' | 'third_term'>('first_term');
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
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    if (data) {
      setStudentData(data);
    }
    setLoading(false);
  };

  const fetchResults = async () => {
    if (!studentData) return;

    const { data } = await supabase
      .from('results')
      .select('*')
      .eq('student_id', studentData.id)
      .eq('term', selectedTerm)
      .eq('status', 'approved')
      .order('subject');

    if (data) {
      setResults(data as Result[]);
    }
  };

  const calculateOverallGPA = () => {
    if (results.length === 0) return 0;
    const totalGPA = results.reduce((sum, r) => sum + r.gpa, 0);
    return (totalGPA / results.length).toFixed(2);
  };

  const calculateTotalMarks = () => {
    return results.reduce((sum, r) => sum + r.total_marks, 0);
  };

  const getTermDisplay = () => {
    if (selectedTerm === 'first_term') return 'First Term';
    if (selectedTerm === 'second_term') return 'Second Term';
    return 'Third Term';
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading marksheet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8 print:py-4">
        <div className="no-print mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/student')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-48">
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
            <Button onClick={handlePrint}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        <Card className="p-8 max-w-4xl mx-auto bg-white">
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-primary pb-6">
            <div className="flex items-center justify-center gap-4 mb-4">
              <GraduationCap className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">
              Buddha Deep English Boarding School
            </h1>
            <p className="text-sm text-muted-foreground">Academic Progress Report</p>
            <p className="text-lg font-semibold mt-2">{getTermDisplay()} - Academic Year 2025</p>
          </div>

          {/* Student Information */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <div className="flex">
                <span className="font-semibold min-w-[120px]">Student Name:</span>
                <span>{studentData?.name}</span>
              </div>
              <div className="flex">
                <span className="font-semibold min-w-[120px]">Roll Number:</span>
                <span>{studentData?.roll_no}</span>
              </div>
              <div className="flex">
                <span className="font-semibold min-w-[120px]">Class:</span>
                <span>{studentData?.class}</span>
              </div>
              <div className="flex">
                <span className="font-semibold min-w-[120px]">Section:</span>
                <span>{studentData?.section}</span>
              </div>
            </div>
            {studentData?.photo_url && (
              <div className="flex justify-end">
                <img
                  src={studentData.photo_url}
                  alt={studentData.name}
                  className="w-32 h-32 object-cover rounded-lg border-2 border-primary"
                />
              </div>
            )}
          </div>

          {/* Results Table */}
          {results.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-primary/10">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">S.N.</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Subject</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Theory</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Practical</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Total</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold">GPA</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="border border-gray-300 px-4 py-2 text-center">{index + 1}</td>
                        <td className="border border-gray-300 px-4 py-2">{result.subject}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{result.theory_marks}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{result.practical_marks}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center font-semibold">{result.total_marks}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{result.gpa}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          <span className="px-3 py-1 bg-primary/10 text-primary rounded font-semibold">
                            {result.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5 font-bold">
                      <td colSpan={4} className="border border-gray-300 px-4 py-3 text-right">Overall Total:</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">{calculateTotalMarks()}</td>
                      <td colSpan={2} className="border border-gray-300 px-4 py-3 text-center">
                        GPA: {calculateOverallGPA()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Grading Scale */}
              <div className="mb-8 p-4 bg-muted/30 rounded-lg">
                <h3 className="font-semibold mb-3">Grading Scale:</h3>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>A+ (4.0): 90-100</div>
                  <div>A (3.6): 80-89</div>
                  <div>B+ (3.2): 70-79</div>
                  <div>B (2.8): 60-69</div>
                  <div>C+ (2.4): 50-59</div>
                  <div>C (2.0): 40-49</div>
                  <div>D (1.6): 35-39</div>
                  <div>E (0.8): Below 35</div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-8 mt-12 pt-6 border-t-2">
                <div className="text-center">
                  <div className="h-16 border-b border-gray-400 mb-2"></div>
                  <p className="font-semibold">Class Teacher</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-gray-400 mb-2"></div>
                  <p className="font-semibold">Principal</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-gray-400 mb-2"></div>
                  <p className="font-semibold">Parent/Guardian</p>
                </div>
              </div>

              <div className="text-center mt-6 text-sm text-muted-foreground">
                <p>Date of Issue: {new Date().toLocaleDateString()}</p>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No results available for {getTermDisplay()}</p>
              <p className="text-sm text-muted-foreground mt-2">Results will appear here once your teacher publishes them.</p>
            </div>
          )}
        </Card>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .container {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ViewMarksheet;
