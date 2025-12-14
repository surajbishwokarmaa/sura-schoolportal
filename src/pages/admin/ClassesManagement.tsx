import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Class {
  id: string;
  name: string;
  sections: string[];
  subjects: any;
  school_level: number;
}

const ClassesManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [className, setClassName] = useState('');
  const [sections, setSections] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

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
      .order('name');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const sectionsArray = sections.split(',').map(s => s.trim()).filter(Boolean);

    if (editingClass) {
      const { error } = await supabase
        .from('classes')
        .update({
          name: className,
          sections: sectionsArray,
          school_level: schoolLevel
        })
        .eq('id', editingClass.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update class',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Class updated successfully'
        });
        fetchClasses();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('classes')
        .insert({
          name: className,
          sections: sectionsArray,
          subjects: {},
          school_level: schoolLevel
        });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to create class',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Class created successfully'
        });
        fetchClasses();
        resetForm();
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (cls: Class) => {
    setEditingClass(cls);
    setClassName(cls.name);
    setSections(cls.sections.join(', '));
    setSchoolLevel(cls.school_level || 1);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class? This will also delete all associated subjects and results.')) {
      return;
    }

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete class',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Class deleted successfully'
      });
      fetchClasses();
    }
  };

  const resetForm = () => {
    setClassName('');
    setSections('');
    setSchoolLevel(1);
    setEditingClass(null);
    setIsDialogOpen(false);
  };

  // Check if class is terminal (Grade 10 or 12)
  const isTerminalClass = (className: string) => {
    const name = className.toLowerCase();
    return name.includes('10') || name.includes('12');
  };

  // Get school level label
  const getSchoolLevelLabel = (level: number) => {
    return level === 1 ? 'Primary-Secondary (Nursery-10)' : 'Higher Secondary (11-12)';
  };

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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Classes Management</h1>
              <p className="text-muted-foreground">Manage classes and sections</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="className">Class Name</Label>
                  <Input
                    id="className"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g., Class 1, Nursery, LKG"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sections">Sections (comma-separated)</Label>
                  <Input
                    id="sections"
                    value={sections}
                    onChange={(e) => setSections(e.target.value)}
                    placeholder="e.g., A, B, C, D"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter section names separated by commas
                  </p>
                </div>
                <div>
                  <Label htmlFor="schoolLevel">School Level</Label>
                  <select
                    id="schoolLevel"
                    value={schoolLevel}
                    onChange={(e) => setSchoolLevel(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value={1}>Level 1: Primary-Secondary (Nursery - Grade 10)</option>
                    <option value={2}>Level 2: Higher Secondary (Grade 11 - 12)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Grade 10 and 12 are terminal classes (students graduate, no auto-promotion)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : editingClass ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <Card key={cls.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{cls.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Badge variant={cls.school_level === 2 ? 'default' : 'secondary'} className="mb-2">
                  {cls.school_level === 2 ? 'Higher Secondary' : 'Primary-Secondary'}
                </Badge>
                {isTerminalClass(cls.name) && (
                  <Badge variant="outline" className="ml-2 mb-2 text-amber-600 border-amber-600">
                    Terminal (Graduation)
                  </Badge>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(cls)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(cls.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {cls.sections.map((section) => (
                  <Badge key={section} variant="secondary">
                    Section {section}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {classes.length === 0 && (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Classes Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first class to the system
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Class
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClassesManagement;