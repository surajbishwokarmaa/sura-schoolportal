import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Users, BookOpen, FileText, Bell, Upload, Settings, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const AdminDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    results: 0
  });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchStats();
    }
  }, [user, userRole, loading, navigate]);

  const fetchStats = async () => {
    setDataLoading(true);
    const [studentsRes, teachersRes, classesRes, resultsRes] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('teachers').select('*', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('results').select('*', { count: 'exact', head: true })
    ]);

    setStats({
      students: studentsRes.count || 0,
      teachers: teachersRes.count || 0,
      classes: classesRes.count || 0,
      results: resultsRes.count || 0
    });
    setDataLoading(false);
  };

  const quickActions = [
    {
      title: 'Manage Students',
      description: 'Add, edit, or remove students',
      icon: GraduationCap,
      path: '/admin/students',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Manage Teachers',
      description: 'Teacher accounts & assignments',
      icon: Users,
      path: '/admin/teachers',
      color: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Manage Classes',
      description: 'Classes, sections & subjects',
      icon: BookOpen,
      path: '/admin/classes',
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Bulk Upload',
      description: 'Upload students/teachers from Excel',
      icon: Upload,
      path: '/admin/bulk-upload',
      color: 'from-orange-500 to-orange-600'
    },
    {
      title: 'Notices',
      description: 'Create and manage announcements',
      icon: Bell,
      path: '/admin/notices',
      color: 'from-pink-500 to-pink-600'
    },
    {
      title: 'System Guide',
      description: 'Help and documentation',
      icon: Settings,
      path: '/admin/system-guide',
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Complete system control and management"
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard
          title="Total Students"
          value={dataLoading ? "..." : stats.students}
          icon={GraduationCap}
          description="Active enrolled students"
          className="hover-scale"
        />
        <StatCard
          title="Total Teachers"
          value={dataLoading ? "..." : stats.teachers}
          icon={Users}
          description="Teaching staff members"
          className="hover-scale"
        />
        <StatCard
          title="Classes"
          value={dataLoading ? "..." : stats.classes}
          icon={BookOpen}
          description="Active classes configured"
          className="hover-scale"
        />
        <StatCard
          title="Total Results"
          value={dataLoading ? "..." : stats.results}
          icon={FileText}
          description="Results entered in system"
          className="hover-scale"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {quickActions.map((action) => (
            <Card
              key={action.path}
              className="p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group animate-fade-in"
              onClick={() => navigate(action.path)}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <action.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg mb-1 group-hover:text-primary transition-colors truncate">
                    {action.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    {action.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* System Info */}
      <Card className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg mb-2">System Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Academic Year:</span>
                <span className="ml-2 font-medium">2081-2082</span>
              </div>
              <div>
                <span className="text-muted-foreground">Current Term:</span>
                <span className="ml-2 font-medium">First Term</span>
              </div>
              <div>
                <span className="text-muted-foreground">System Status:</span>
                <span className="ml-2 font-medium text-green-600">Active</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
};

export default AdminDashboard;
