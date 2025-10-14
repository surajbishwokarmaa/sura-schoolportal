import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2, ArrowLeft, GraduationCap } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Student {
  id: string;
  name: string;
  class: string;
  section: string;
  roll_no: string;
  gender: 'male' | 'female' | 'other' | null;
  dob: string | null;
  parent_name: string | null;
  phone: string | null;
  parent_phone: string;
  address: string | null;
}

interface Class {
  id: string;
  name: string;
  sections: string[];
}

const StudentsManagement = () => {
  const { user, userRole, loading, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    class: '',
    section: '',
    rollNo: '',
    gender: '',
    dob: '',
    parentName: '',
    phone: '',
    parentPhone: '',
    address: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchStudents();
      fetchClasses();
    }
  }, [user, userRole, loading, navigate]);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('class', { ascending: true })
      .order('section', { ascending: true })
      .order('roll_no', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch students',
        variant: 'destructive'
      });
    } else {
      setStudents((data as any) || []);
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

  const getAvailableSections = () => {
    const cls = classes.find(c => c.name === formData.class);
    return cls?.sections || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (editingStudent) {
      const { error } = await supabase
        .from('students')
        .update({
          name: formData.name,
          class: formData.class,
          section: formData.section,
          roll_no: formData.rollNo,
          gender: formData.gender as 'male' | 'female' | 'other' | null,
          dob: formData.dob,
          parent_name: formData.parentName,
          phone: formData.phone,
          parent_phone: formData.parentPhone,
          address: formData.address
        })
        .eq('id', editingStudent.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update student',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Student updated successfully'
        });
        fetchStudents();
        resetForm();
      }
    } else {
      // Create auth user using phone
      const { error: signUpError } = await signUp(
        `${formData.phone}@school.edu.np`, // Create email from phone
        formData.password,
        'student',
        formData.name,
        formData.phone
      );

      if (signUpError) {
        toast({
          title: 'Error',
          description: signUpError.message || 'Failed to create student account',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Get the newly created user
      const { data: userData } = await supabase.auth.getUser();
      
      if (userData.user) {
        const { error } = await supabase
          .from('students')
          .insert([{
            user_id: userData.user.id,
            name: formData.name,
            class: formData.class,
            section: formData.section,
            roll_no: formData.rollNo,
            gender: formData.gender as 'male' | 'female' | 'other' | undefined,
            dob: formData.dob,
            parent_name: formData.parentName,
            phone: formData.phone,
            parent_phone: formData.parentPhone,
            address: formData.address
          }]);

        if (error) {
          toast({
            title: 'Error',
            description: 'Failed to create student record',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Success',
            description: 'Student created successfully'
          });
          fetchStudents();
          resetForm();
        }
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      class: student.class,
      section: student.section,
      rollNo: student.roll_no,
      gender: student.gender as any || '',
      dob: student.dob || '',
      parentName: student.parent_name || '',
      phone: student.phone || '',
      parentPhone: student.parent_phone,
      address: student.address || '',
      password: ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) {
      return;
    }

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete student',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Student deleted successfully'
      });
      fetchStudents();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      class: '',
      section: '',
      rollNo: '',
      gender: '',
      dob: '',
      parentName: '',
      phone: '',
      parentPhone: '',
      address: '',
      password: ''
    });
    setEditingStudent(null);
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
              <h1 className="text-3xl font-bold">Students Management</h1>
              <p className="text-muted-foreground">Manage student records</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
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
                    <Label htmlFor="rollNo">Roll Number</Label>
                    <Input
                      id="rollNo"
                      value={formData.rollNo}
                      onChange={(e) => setFormData({...formData, rollNo: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="class">Class</Label>
                    <Select
                      value={formData.class}
                      onValueChange={(value) => setFormData({...formData, class: value, section: ''})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.name}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="section">Section</Label>
                    <Select
                      value={formData.section}
                      onValueChange={(value) => setFormData({...formData, section: value})}
                      disabled={!formData.class}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableSections().map((section) => (
                          <SelectItem key={section} value={section}>
                            Section {section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({...formData, gender: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({...formData, dob: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Student Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required={!editingStudent}
                      disabled={!!editingStudent}
                    />
                  </div>
                  {!editingStudent && (
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
                  <div>
                    <Label htmlFor="parentName">Parent Name</Label>
                    <Input
                      id="parentName"
                      value={formData.parentName}
                      onChange={(e) => setFormData({...formData, parentName: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="parentPhone">Parent Phone</Label>
                    <Input
                      id="parentPhone"
                      value={formData.parentPhone}
                      onChange={(e) => setFormData({...formData, parentPhone: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : editingStudent ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {students.map((student) => (
            <Card key={student.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{student.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {student.class} - Section {student.section} | Roll No: {student.roll_no}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Parent: {student.parent_name}</p>
                    <p className="text-muted-foreground">{student.parent_phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(student)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(student.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {students.length === 0 && (
          <Card className="p-12 text-center">
            <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Students Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first student to the system
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Student
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentsManagement;