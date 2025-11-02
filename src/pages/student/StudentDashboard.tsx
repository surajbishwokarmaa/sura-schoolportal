import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, BookOpen, FileText, Bell, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentData {
  id: string;
  name: string;
  roll_no: string;
  class: string;
  section: string;
  photo_url: string | null;
  parent_name: string | null;
  parent_phone: string;
}

interface Result {
  id: string;
  subject: string;
  term: string;
  theory_marks: number;
  practical_marks: number;
  total_marks: number;
  grade: string;
  gpa: number;
}

const StudentDashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || userRole !== 'student') {
      navigate('/auth/student');
      return;
    }

    fetchStudentData();
    fetchResults();
  }, [user, userRole, navigate]);

  const fetchStudentData = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setStudent(data);
    } catch (error) {
      console.error('Error fetching student data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load student information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) return;

      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/select-role');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Student Profile Card */}
        {student && (
          <Card className="p-6 mb-6">
            <div className="flex items-start gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={student.photo_url || ''} />
                <AvatarFallback className="text-2xl">
                  {student.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{student.name}</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Roll No:</span>
                    <span className="ml-2 font-medium">{student.roll_no}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Class:</span>
                    <span className="ml-2 font-medium">{student.class} - {student.section}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parent:</span>
                    <span className="ml-2 font-medium">{student.parent_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact:</span>
                    <span className="ml-2 font-medium">{student.parent_phone}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card 
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/student/marksheet')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">View Marksheet</h3>
                <p className="text-sm text-muted-foreground">Download report card</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">My Results</h3>
                <p className="text-sm text-muted-foreground">{results.length} records</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Bell className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">Notices</h3>
                <p className="text-sm text-muted-foreground">Latest updates</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Results Table */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Academic Results</h2>
          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Subject</th>
                    <th className="text-left py-3 px-4">Term</th>
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
                      <td className="py-3 px-4">{result.subject}</td>
                      <td className="py-3 px-4 capitalize">{result.term}</td>
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
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No results available yet</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
