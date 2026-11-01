import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudent } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FileText, TrendingUp, Download, Users, Bell, Calendar, RefreshCw, KeyRound, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getCurrentNepaliDate } from '@/lib/nepaliDate';

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

const StudentDashboard = () => {
  const { user, userRole } = useAuth();
  const { selectedStudent, allStudents, hasMultipleStudents, isLoading: studentContextLoading, setSelectedStudent, clearStudentSelection } = useStudent();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [noticesCount, setNoticesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const nepaliDate = getCurrentNepaliDate();

  useEffect(() => {
    if (!user || userRole !== 'student') {
      navigate('/auth/student');
      return;
    }

    // Wait for student context to finish loading
    if (studentContextLoading) {
      return;
    }

    // If multiple students and none selected, just show the picker (no additional loading needed)
    if (hasMultipleStudents && !selectedStudent) {
      setLoading(false);
      return;
    }

    if (selectedStudent) {
      fetchStudentDataById(selectedStudent.id);
    } else if (allStudents.length === 1) {
      fetchStudentDataById(allStudents[0].id);
    } else {
      fetchStudentData();
    }
    fetchNoticesCount();
  }, [user, userRole, navigate, selectedStudent, hasMultipleStudents, studentContextLoading, allStudents]);

  const fetchStudentData = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setStudent(data);
      } else {
        toast({
          title: 'No Student Record',
          description: 'No student record found for your account',
          variant: 'destructive'
        });
      }
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

  const fetchStudentDataById = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setStudent(data);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNoticesCount = async () => {
    try {
      const { count } = await supabase
        .from('notices')
        .select('*', { count: 'exact', head: true })
        .or('visible_to.eq.all,visible_to.eq.student');
      
      setNoticesCount(count || 0);
    } catch (error) {
      console.error('Error fetching notices count:', error);
    }
  };

  const handleStudentSelect = (studentToSelect: typeof selectedStudent) => {
    setSelectedStudent(studentToSelect);
  };

  const handleSwitchStudent = () => {
    clearStudentSelection();
  };

  const quickActions = [
    {
      title: 'Attendance',
      description: 'Calendar & charts',
      icon: Calendar,
      path: '/student/attendance',
      color: 'from-teal-500 to-teal-600'
    },
    {
      title: 'Fees & Bills',
      description: 'Due, paid and bills',
      icon: FileText,
      path: '/student/fees',
      color: 'from-rose-500 to-rose-600'
    },
    {
      title: 'View Marksheet',
      description: 'See all your results',
      icon: FileText,
      path: '/student/marksheet',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'View Notices',
      description: 'School announcements',
      icon: Bell,
      path: '/student/notices',
      color: 'from-amber-500 to-amber-600'
    },
    {
      title: 'Staff Info',
      description: 'View teacher directory',
      icon: Users,
      path: '/student/staff',
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Change Password',
      description: 'Set your own password',
      icon: KeyRound,
      path: '/change-password',
      color: 'from-slate-500 to-slate-600'
    },
    {
      title: 'System Guide',
      description: 'How to use the portal',
      icon: BookOpen,
      path: '/system-guide',
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      title: 'Download Marksheet',
      description: 'Download PDF marksheet',
      icon: Download,
      path: '/student/marksheet?download=1',
      color: 'from-green-500 to-green-600'
    }
  ];

  if (loading || studentContextLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Show student picker for parents with multiple children
  if (hasMultipleStudents && !selectedStudent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8 animate-in fade-in duration-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Choose Student</h1>
            <p className="text-muted-foreground">Select which student's account to access</p>
          </div>

          <div className="max-w-2xl mx-auto grid gap-4">
            {allStudents.map((s) => (
              <Card
                key={s.id}
                className="p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 animate-fade-in"
                onClick={() => handleStudentSelect(s)}
              >
                <div className="flex items-center gap-4 sm:gap-6">
                  <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-primary/20">
                    <AvatarImage src={s.photo_url || ''} />
                    <AvatarFallback className="text-xl bg-primary/10">
                      {s.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-semibold mb-1">{s.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Roll: {s.roll_no}</span>
                      <span>Class: {s.class}</span>
                      <span>Section: {s.section}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Student Dashboard"
      subtitle="View your academic performance"
    >
      {/* Date Display */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>{nepaliDate.nepali}</span>
          <span className="text-xs">({nepaliDate.english})</span>
        </div>
        {hasMultipleStudents && (
          <Button variant="outline" size="sm" onClick={handleSwitchStudent}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Switch Student
          </Button>
        )}
      </div>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard
          title="Notices"
          value={noticesCount}
          icon={Bell}
          description="Active announcements"
          className="hover-scale cursor-pointer"
          onClick={() => navigate('/student/notices')}
        />
        <StatCard
          title="Class"
          value={student?.class || 'N/A'}
          icon={TrendingUp}
          description={`Section: ${student?.section || 'N/A'}`}
          className="hover-scale"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group animate-fade-in"
              onClick={() => navigate(action.path)}
            >
              <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                  <action.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-lg mb-1 group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                    {action.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
