import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2, ArrowLeft, Users, Phone } from 'lucide-react';
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

interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subjects: string[];
  classes_assigned: string[];
  designation?: string;
  class_teacher_class?: string | null;
  class_teacher_section?: string | null;
}

const DESIGNATIONS = [
  { value: 'principal', label: 'Principal' },
  { value: 'vice_principal', label: 'Vice-Principal' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'teacher', label: 'Subject Teacher' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'staff', label: 'Staff' },
];
const designationLabel = (v?: string) => DESIGNATIONS.find(d => d.value === v)?.label || 'Teacher';

interface Class {
  id: string;
  name: string;
  sections: string[];
}

const TeachersManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    subjects: '',
    password: '',
    designation: 'teacher',
    ctClass: '',
    ctSection: ''
  });
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
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

  // Generate a unique email from phone number for auth purposes
  const generateEmailFromPhone = (phone: string): string => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `teacher${cleanPhone}@school.edu.np`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const subjectsArray = formData.subjects.split(',').map(s => s.trim()).filter(Boolean);
    const classesArray = selectedClasses;
    const isCT = formData.designation === 'class_teacher';
    if (isCT && (!formData.ctClass || !formData.ctSection)) {
      toast({ title: 'Error', description: 'Choose the class and section for the class teacher', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    const extra = {
      designation: formData.designation,
      class_teacher_class: isCT ? formData.ctClass : null,
      class_teacher_section: isCT ? formData.ctSection : null,
    };
    if (isCT && !classesArray.includes(formData.ctClass)) classesArray.push(formData.ctClass);

    if (editingTeacher) {
      const { error } = await supabase
        .from('teachers')
        .update({
          name: formData.name,
          phone: formData.phone,
          subjects: subjectsArray,
          classes_assigned: classesArray,
          ...extra
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
      // Validate required fields
      if (!formData.phone || formData.phone.trim() === '') {
        toast({
          title: 'Error',
          description: 'Phone number is required for new teachers',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      const digits = formData.phone.replace(/\D/g, '');
      if (digits.length < 10) {
        toast({ title: 'Error', description: 'Enter a valid 10-digit phone number', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      const password = `sura${digits.slice(0, 2)}${digits.slice(-2)}`;
      const generatedEmail = generateEmailFromPhone(formData.phone);

      // Create auth user via edge function
      const { data: authData, error: authError } = await supabase.functions.invoke('create-user-account', {
        body: {
          email: generatedEmail,
          password: password,
          role: 'teacher',
          fullName: formData.name,
          phone: formData.phone
        }
      });

      // Handle edge function errors
      if (authError) {
        let msg = authError.message || 'Failed to create teacher account';
        try {
          const body = await (authError as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        if (msg.includes('already exists')) msg = 'A teacher with this phone number already exists';
        toast({
          title: 'Cannot Create Teacher',
          description: msg,
          variant: 'destructive',
          duration: 10000
        });
        setIsLoading(false);
        return;
      }

      // Handle errors returned in the response body
      if (authData?.error) {
        toast({
          title: 'Cannot Create Teacher',
          description: authData.error,
          variant: 'destructive',
          duration: 10000
        });
        setIsLoading(false);
        return;
      }

      // Check if user was created successfully
      if (!authData?.user) {
        toast({
          title: 'Error',
          description: 'Failed to create teacher account - no user data returned',
          variant: 'destructive',
          duration: 10000
        });
        setIsLoading(false);
        return;
      }

      const authUser = authData.user;

      // Insert teacher record
      const { error } = await supabase
        .from('teachers')
        .insert({
          user_id: authUser.id,
          name: formData.name,
          email: generatedEmail,
          phone: formData.phone,
          subjects: subjectsArray,
          classes_assigned: classesArray,
          ...extra
        });

      if (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Failed to create teacher record: ' + error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: `Teacher created successfully! Login: Phone: ${formData.phone}, Password: ${password}`,
          duration: 10000
        });
        fetchTeachers();
        resetForm();
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      phone: teacher.phone || '',
      subjects: teacher.subjects.join(', '),
      password: '',
      designation: teacher.designation || 'teacher',
      ctClass: teacher.class_teacher_class || '',
      ctSection: teacher.class_teacher_section || ''
    });
    setSelectedClasses(teacher.classes_assigned || []);
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
      phone: '',
      subjects: '',
      password: '',
      designation: 'teacher',
      ctClass: '',
      ctSection: ''
    });
    setSelectedClasses([]);
    setEditingTeacher(null);
    setIsDialogOpen(false);
  };

  const toggleClass = (className: string) => {
    setSelectedClasses(prev => 
      prev.includes(className) 
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Teachers Management</h1>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="pl-9"
                        placeholder="e.g., 9841234567"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Teachers will use this phone number to login
                    </p>
                  </div>
                  {!editingTeacher && (
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Password is automatic: "sura" + first 2 and last 2 digits of the phone (9807470285 → sura9885).
                    </p>
                  )}
                  <div>
                    <Label htmlFor="designation">Position *</Label>
                    <select
                      id="designation"
                      value={formData.designation}
                      onChange={(e) => setFormData({...formData, designation: e.target.value})}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {DESIGNATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  {formData.designation === 'class_teacher' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Class *</Label>
                        <select
                          value={formData.ctClass}
                          onChange={(e) => setFormData({...formData, ctClass: e.target.value, ctSection: ''})}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select</option>
                          {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Section *</Label>
                        <select
                          value={formData.ctSection}
                          onChange={(e) => setFormData({...formData, ctSection: e.target.value})}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select</option>
                          {(classes.find(c => c.name === formData.ctClass)?.sections || []).map(sec => <option key={sec} value={sec}>{sec}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="subjects">Subjects (comma-separated) *</Label>
                  <Input
                    id="subjects"
                    value={formData.subjects}
                    onChange={(e) => setFormData({...formData, subjects: e.target.value})}
                    placeholder="e.g., Mathematics, Science, English"
                    required
                  />
                </div>
                <div>
                  <Label>Assigned Classes *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto border rounded-md p-3">
                    {classes.length > 0 ? (
                      classes.map((cls) => (
                        <label 
                          key={cls.id} 
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1.5 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClasses.includes(cls.name)}
                            onChange={() => toggleClass(cls.name)}
                            className="rounded border-input"
                          />
                          <span className="text-sm">{cls.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground col-span-full">No classes available. Create classes first.</p>
                    )}
                  </div>
                  {selectedClasses.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {selectedClasses.join(', ')}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Creating...' : editingTeacher ? 'Update Teacher' : 'Create Teacher'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{teacher.name}</h3>
                  <div className="flex flex-wrap gap-1 my-1">
                    <Badge>{designationLabel(teacher.designation)}</Badge>
                    {teacher.class_teacher_class && (
                      <Badge variant="outline">{teacher.class_teacher_class} - {teacher.class_teacher_section}</Badge>
                    )}
                  </div>
                  {teacher.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {teacher.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.subjects.map((subject, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Classes</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.classes_assigned.map((cls, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {cls}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(teacher)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(teacher.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {teachers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No teachers found. Add your first teacher.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeachersManagement;
