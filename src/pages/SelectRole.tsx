import { useNavigate } from 'react-router-dom';
import { GraduationCap, Users, UserCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const SelectRole = () => {
  const navigate = useNavigate();

  const roles = [
    {
      id: 'student',
      title: 'Students & Parents',
      description: 'View results, grades, and GPA',
      icon: GraduationCap,
      gradient: 'from-blue-500 to-blue-600',
      path: '/auth/student'
    },
    {
      id: 'teacher',
      title: 'Teachers',
      description: 'Upload marks and manage classes',
      icon: Users,
      gradient: 'from-green-500 to-emerald-600',
      path: '/auth/teacher'
    },
    {
      id: 'admin',
      title: 'Admin',
      description: 'Full system management',
      icon: Shield,
      gradient: 'from-purple-500 to-purple-600',
      path: '/auth/admin'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 justify-center">
            <GraduationCap className="w-10 h-10" />
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold">Buddha Deep English Boarding School</h1>
              <p className="text-sm md:text-base opacity-90">Sura School Portal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-3 animate-in fade-in duration-700">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Select Your Role</h2>
            <p className="text-lg text-muted-foreground">Choose how you want to access the portal</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <Card
                  key={role.id}
                  className="p-8 hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-primary animate-in slide-in-from-bottom duration-700"
                  style={{ animationDelay: `${index * 150}ms` }}
                  onClick={() => navigate(role.path)}
                >
                  <div className="space-y-6">
                    <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {role.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {role.description}
                      </p>
                    </div>

                    <Button 
                      className="w-full"
                      size="lg"
                      onClick={() => navigate(role.path)}
                    >
                      Continue as {role.id === 'admin' ? 'Admin' : role.id === 'teacher' ? 'Teacher' : 'Student'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-12 p-6 bg-muted/50 rounded-lg animate-in fade-in duration-700 delay-500">
            <UserCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              New to the portal? Contact your school administrator for login credentials
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectRole;
