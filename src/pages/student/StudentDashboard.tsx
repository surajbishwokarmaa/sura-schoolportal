import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FileText, TrendingUp, Download, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { calculateOverallGPA } from '@/lib/gradeCalculator';

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
  const { user, userRole } = useAuth();
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

  const overallGPA = results.length > 0 ? calculateOverallGPA(results) : 0;
  const totalResults = results.length;
  const publishedResults = results.filter(r => r.term).length;

  const quickActions = [
    {
      title: 'View Marksheet',
      description: 'See your detailed results',
      icon: FileText,
      path: '/student/view-marksheet',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Download Marksheet',
      description: 'Download PDF marksheet',
      icon: Download,
      path: '/student/view-marksheet',
      color: 'from-green-500 to-emerald-600'
    }
  ];

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <DashboardLayout
      title="Student Dashboard"
      subtitle="View your academic performance"
    >
      {/* Student Profile Card */}
      {student && (
        <Card className="p-4 sm:p-6 mb-6 sm:mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-primary/20">
              <AvatarImage src={student.photo_url || ''} />
              <AvatarFallback className="text-xl sm:text-2xl bg-primary/10">
                {student.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 w-full">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{student.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Roll Number:</span>
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

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard
          title="Overall GPA"
          value={overallGPA.toFixed(2)}
          icon={Award}
          description="Your current GPA"
          className="hover-scale"
        />
        <StatCard
          title="Total Results"
          value={totalResults}
          icon={FileText}
          description="Results published"
          className="hover-scale"
        />
        <StatCard
          title="Published Results"
          value={publishedResults}
          icon={TrendingUp}
          description="Available to view"
          className="hover-scale"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {quickActions.map((action) => (
            <Card
              key={action.path}
              className="p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group animate-fade-in"
              onClick={() => navigate(action.path)}
            >
              <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                  <action.icon className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg mb-1 group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Results */}
      {results.length > 0 && (
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-lg mb-4">Recent Results</h3>
          <div className="space-y-3">
            {results.slice(0, 5).map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{result.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {result.term.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{result.grade}</p>
                  <p className="text-sm text-muted-foreground">GPA: {result.gpa}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
};

export default StudentDashboard;
