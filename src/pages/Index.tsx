import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GraduationCap, Users, Shield } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  const roleCards = [
    {
      title: 'Admin Portal',
      description: 'Manage students, teachers, classes, and results',
      icon: Shield,
      path: '/auth/admin',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Teacher Portal',
      description: 'Manage student results and view notices',
      icon: Users,
      path: '/auth/teacher',
      color: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Student Portal',
      description: 'View your results and school notices',
      icon: GraduationCap,
      path: '/auth/student',
      color: 'from-purple-500 to-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 gradient-hero bg-clip-text text-transparent">
            Buddha Deep English Boarding School
          </h1>
          <p className="text-xl text-muted-foreground">Result Management System</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {roleCards.map((role) => {
            const Icon = role.icon;
            return (
              <Card
                key={role.path}
                className="p-8 cursor-pointer hover:shadow-xl transition-all duration-300 group border-2 hover:border-primary"
                onClick={() => navigate(role.path)}
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{role.title}</h3>
                <p className="text-muted-foreground">{role.description}</p>
                <Button className="mt-4 w-full" variant="outline">
                  Login
                </Button>
              </Card>
            );
          })}
        </div>

        <Card className="mt-12 p-8 max-w-3xl mx-auto gradient-hero text-white">
          <h2 className="text-2xl font-bold mb-4">About Our System</h2>
          <p className="text-white/90 mb-4">
            Welcome to Buddha Deep English Boarding School's comprehensive result management system. 
            This platform enables efficient management of student records, teacher assignments, 
            class organization, and result publication.
          </p>
          <ul className="list-disc list-inside space-y-2 text-white/90">
            <li>Manage students from Nursery to Grade 10</li>
            <li>Multiple sections per class</li>
            <li>GPA calculation following Nepal education system</li>
            <li>Bulk upload for students and teachers</li>
            <li>Real-time notice board for announcements</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default Index;
