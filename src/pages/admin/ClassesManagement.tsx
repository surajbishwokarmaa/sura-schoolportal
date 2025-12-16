import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, BookOpen, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface Class {
  id: string;
  name: string;
  sections: string[];
  school_level: number;
  display_order: number;
}

const ClassesManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchClasses();
    }
  }, [user, userRole, loading, navigate]);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch classes',
        variant: 'destructive'
      });
    } else {
      setClasses(data || []);
    }
  };

  const isTerminalClass = (className: string) => {
    const name = className.toLowerCase();
    return name.includes('10') || name.includes('12');
  };

  // Separate classes by school level
  const basicLevelClasses = classes.filter(c => c.school_level === 1);
  const higherSecondaryClasses = classes.filter(c => c.school_level === 2);

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

  const ClassCard = ({ cls }: { cls: Class }) => (
    <Card key={cls.id} className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            cls.school_level === 2 ? 'bg-purple-500/10' : 'bg-primary/10'
          }`}>
            {cls.school_level === 2 ? (
              <GraduationCap className="w-6 h-6 text-purple-600" />
            ) : (
              <BookOpen className="w-6 h-6 text-primary" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold">{cls.name}</h3>
            <p className="text-sm text-muted-foreground">
              {cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isTerminalClass(cls.name) && (
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            Terminal
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {cls.sections.map((section) => (
          <Badge key={section} variant="secondary">
            {section}
          </Badge>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Classes Overview</h1>
              <p className="text-muted-foreground">All classes with Lotus & Rose sections</p>
            </div>
          </div>
        </div>
        
        <Card className="p-4 mb-6 bg-muted/30 border-dashed">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Classes are organized into two levels: <strong>Basic Level</strong> (Nursery–Class 10) and <strong>Higher Secondary</strong> (Class 11–12). 
            Class 10 and Class 12 are terminal classes (graduation points). To manage subjects, go to{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/admin/subjects')}>Subject Management</Button>.
          </p>
        </Card>

        {/* Basic Level Classes */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Basic Level</h2>
            <Badge variant="secondary">{basicLevelClasses.length} classes</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {basicLevelClasses.map((cls) => (
              <ClassCard key={cls.id} cls={cls} />
            ))}
          </div>
        </div>

        {/* Higher Secondary Classes */}
        {higherSecondaryClasses.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold">Higher Secondary</h2>
              <Badge variant="outline" className="border-purple-500 text-purple-600">
                {higherSecondaryClasses.length} classes
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {higherSecondaryClasses.map((cls) => (
                <ClassCard key={cls.id} cls={cls} />
              ))}
            </div>
          </div>
        )}

        {classes.length === 0 && (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Loading Classes...</h3>
            <p className="text-muted-foreground">
              Standard classes are being loaded
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClassesManagement;