import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { BookOpen, FileText, Users, Edit, Eye, TrendingUp, Bell, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getCurrentNepaliDate } from '@/lib/nepaliDate';

interface TeacherData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subjects: string[];
  classes_assigned: string[];
  photo_url: string | null;
}

const TeacherDashboard = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    resultsEntered: 0,
    noticesCount: 0
  });
  const [loading, setLoading] = useState(true);
  const nepaliDate = getCurrentNepaliDate();

  useEffect(() => {
    if (!user || userRole !== 'teacher') {
      navigate('/auth/teacher');
      return;
    }

    fetchTeacherData();
    fetchNoticesCount();
  }, [user, userRole, navigate]);

  const fetchTeacherData = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setTeacher(data);

      // Fetch statistics
      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('class', data.classes_assigned);

      const { count: resultsCount } = await supabase
        .from('results')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', data.id);

      setStats(prev => ({
        ...prev,
        totalStudents: studentsCount || 0,
        resultsEntered: resultsCount || 0
      }));
    } catch (error) {
      console.error('Error fetching teacher data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load teacher information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchNoticesCount = async () => {
    try {
      const { count } = await supabase
        .from('notices')
        .select('*', { count: 'exact', head: true })
        .or('visible_to.eq.all,visible_to.eq.teacher');
      
      setStats(prev => ({
        ...prev,
        noticesCount: count || 0
      }));
    } catch (error) {
      console.error('Error fetching notices count:', error);
    }
  };

  const quickActions = [
    {
      title: 'My Class (Class Teacher)',
      description: 'Daily attendance & student details',
      icon: Users,
      path: '/teacher/my-class',
      color: 'from-rose-500 to-rose-600'
    },
    {
      title: 'Enter Results',
      description: 'Input student marks & grades',
      icon: Edit,
      path: '/teacher/result-entry',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'View Results',
      description: 'See entered results',
      icon: Eye,
      path: '/teacher/results',
      color: 'from-green-500 to-emerald-600'
    },
    {
      title: 'View Students',
      description: 'Student list & details',
      icon: Users,
      path: '/teacher/students',
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'View Notices',
      description: 'School announcements',
      icon: Bell,
      path: '/teacher/notices',
      color: 'from-amber-500 to-amber-600'
    }
  ];

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <DashboardLayout
      title="Teacher Dashboard"
      subtitle="Manage classes and student results"
    >
      {/* Date Display */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>{nepaliDate.nepali}</span>
        <span className="text-xs">({nepaliDate.english})</span>
      </div>

      {/* Teacher Profile Card */}
      {teacher && (
        <Card className="p-4 sm:p-6 mb-6 sm:mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-primary/20">
              <AvatarImage src={teacher.photo_url || ''} />
              <AvatarFallback className="text-xl sm:text-2xl bg-primary/10">
                {teacher.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 w-full">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{teacher.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="ml-2 font-medium">{teacher.phone || 'N/A'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Subjects:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teacher.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Classes:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teacher.classes_assigned.map((cls) => (
                      <span
                        key={cls}
                        className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium"
                      >
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          icon={Users}
          description="In your classes"
          className="hover-scale"
        />
        <StatCard
          title="Results Entered"
          value={stats.resultsEntered}
          icon={FileText}
          description="Marks submitted"
          className="hover-scale"
        />
        <StatCard
          title="Subjects"
          value={teacher?.subjects.length || 0}
          icon={BookOpen}
          description="Teaching"
          className="hover-scale"
        />
        <StatCard
          title="Notices"
          value={stats.noticesCount}
          icon={Bell}
          description="Announcements"
          className="hover-scale cursor-pointer"
          onClick={() => navigate('/teacher/notices')}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {quickActions.map((action) => (
            <Card
              key={action.path}
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

export default TeacherDashboard;
