import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Users, BookOpen, FileText, Bell, LogOut, Shield, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const AdminDashboard = () => {
  const { user, userRole, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    results: 0
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchStats();
    }
  }, [user, userRole, loading, navigate]);

  const fetchStats = async () => {
    const [studentsRes, teachersRes, classesRes, resultsRes] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('teachers').select('*', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('results').select('*', { count: 'exact', head: true }).eq('status', 'published')
    ]);

    setStats({
      students: studentsRes.count || 0,
      teachers: teachersRes.count || 0,
      classes: classesRes.count || 0,
      results: resultsRes.count || 0
    });
  };

  const statsDisplay = [
    { title: 'Total Students', value: stats.students.toString(), icon: GraduationCap, color: 'from-blue-500 to-blue-600' },
    { title: 'Total Teachers', value: stats.teachers.toString(), icon: Users, color: 'from-green-500 to-emerald-600' },
    { title: 'Classes', value: stats.classes.toString(), icon: BookOpen, color: 'from-purple-500 to-purple-600' },
    { title: 'Published Results', value: stats.results.toString(), icon: FileText, color: 'from-orange-500 to-orange-600' }
  ];

  const quickActions = [
    { title: 'Manage Classes', description: 'Add and configure classes', icon: BookOpen, path: '/admin/classes' },
    { title: 'Manage Teachers', description: 'Manage teacher accounts', icon: Users, path: '/admin/teachers' },
    { title: 'Manage Students', description: 'Add, edit, or remove students', icon: GraduationCap, path: '/admin/students' },
    { title: '📤 Bulk Data Upload', description: 'Upload students/teachers from Excel', icon: Upload, path: '/admin/bulk-upload' },
    { title: 'Notices', description: 'Create and manage notices', icon: Bell, path: '/admin/notices' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <p className="text-sm opacity-90">Sura School Portal</p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsDisplay.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.title}
                  className="p-6 cursor-pointer hover:shadow-lg transition-all duration-300 group border-2 hover:border-primary"
                  onClick={() => navigate(action.path)}
                >
                  <Icon className="w-10 h-10 mb-4 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="text-lg font-semibold mb-2">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Welcome Message */}
        <Card className="p-8 gradient-hero text-white">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome to Admin Dashboard</h2>
              <p className="text-white/90 mb-4">
                Manage all aspects of Buddha Deep English Boarding School's result management system. 
                Add students and teachers, manage results, and publish report cards.
              </p>
              <Button variant="secondary" onClick={() => navigate('/admin/system-guide')}>
                View System Guide
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
