import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2, ArrowLeft, Users } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subjects: string[];
  classes_assigned: string[];
  photo_url: string | null;
}

interface Class {
  id: string;
  name: string;
  sections: string[];
}

const TeachersManagement = () => {
  const { user, userRole, loading, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subjects: '',
    classesAssigned: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchTeachers();
      fetchClasses();
    }
  }, [user, userRole, loading, navigate]);

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .order('name');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch teachers',
        variant: 'destructive'
      });
    } else {
      setTeachers(data || []);
    }
  };

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

    const subjectsArray = formData.subjects.split(',').map(s => s.trim()).filter(Boolean);
    const classesArray = formData.classesAssigned.split(',').map(s => s.trim()).filter(Boolean);

    if (editingTeacher) {
      const { error } = await supabase
        .from('teachers')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          subjects: subjectsArray,
          classes_assigned: classesArray
        })
        .eq('id', editingTeacher.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update teacher',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Teacher updated successfully'
        });
        fetchTeachers();
        resetForm();
      }
    } else {
      // Create auth user first
      const { error: signUpError } = await signUp(
        formData.email,
        formData.password,
        'teacher',
        formData.name,
        formData.phone
      );

      if (signUpError) {
        toast({
          title: 'Error',
          description: signUpError.message || 'Failed to create teacher account',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Get the newly created user
      const { data: userData } = await supabase.auth.getUser();
      
      if (userData.user) {
        const { error } = await supabase
          .from('teachers')
          .insert({
            user_id: userData.user.id,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            subjects: subjectsArray,
            classes_assigned: classesArray
          });

        if (error) {
          toast({
            title: 'Error',
            description: 'Failed to create teacher record',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Success',
            description: 'Teacher created successfully'
          });
          fetchTeachers();
          resetForm();
        }
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      email: teacher.email || '',
      phone: teacher.phone || '',
      subjects: teacher.subjects.join(', '),
      classesAssigned: teacher.classes_assigned.join(', '),
      password: ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) {
      return;
    }

    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete teacher',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Teacher deleted successfully'
      });
      fetchTeachers();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      subjects: '',
      classesAssigned: '',
      password: ''
    });
    setEditingTeacher(null);
    setIsDialogOpen(false);
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
              <h1 className="text-3xl font-bold">Teachers Management</h1>
              <p className="text-muted-foreground">Manage teacher accounts and assignments</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required={!editingTeacher}
                      disabled={!!editingTeacher}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  {!editingTeacher && (
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                        minLength={8}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="subjects">Subjects (comma-separated)</Label>
                  <Input
                    id="subjects"
                    value={formData.subjects}
                    onChange={(e) => setFormData({...formData, subjects: e.target.value})}
                    placeholder="e.g., Mathematics, Science, English"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="classesAssigned">Assigned Classes (comma-separated)</Label>
                  <Input
                    id="classesAssigned"
                    value={formData.classesAssigned}
                    onChange={(e) => setFormData({...formData, classesAssigned: e.target.value})}
                    placeholder="e.g., Class 1, Class 2"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : editingTeacher ? 'Update' : 'Create'}
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
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{teacher.name}</h3>
                    <p className="text-sm text-muted-foreground">{teacher.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(teacher)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(teacher.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.subjects.map((subject) => (
                      <Badge key={subject} variant="secondary" className="text-xs">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Classes</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.classes_assigned.map((cls) => (
                      <Badge key={cls} variant="outline" className="text-xs">
                        {cls}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {teachers.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Teachers Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first teacher to the system
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Teacher
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TeachersManagement;