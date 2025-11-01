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
  photo_url: string | null;
}

interface Class {
  id: string;
  name: string;
  sections: string[];
}

const StudentsManagement = () => {
  const { user, userRole, loading } = useAuth();
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
    parentPhone: '',
    address: '',
    password: ''
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Photo size must be less than 2MB',
          variant: 'destructive'
        });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (file: File, studentId: string): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${studentId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('student-photos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to upload photo: ${error.message}`,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsUploading(false);
    }
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
      // Validate photo is uploaded
      if (!photoFile) {
        toast({
          title: 'Error',
          description: 'Photo is required for all students',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Validate password
      if (!formData.password || formData.password.trim() === '') {
        toast({
          title: 'Error',
          description: 'Password is required',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      const password = formData.password;
      const studentEmail = `student${formData.rollNo}@school.edu.np`;

      // Create auth user via edge function - use parent phone for login
      const { data: authData, error: authError } = await supabase.functions.invoke('create-user-account', {
        body: {
          email: studentEmail,
          password: password,
          role: 'student',
          fullName: formData.name,
          phone: formData.parentPhone
        }
      });

      // Handle edge function errors (including 400 responses)
      if (authError) {
        toast({
          title: 'Error',
          description: authError.message || 'Failed to create student account',
          variant: 'destructive',
          duration: 10000
        });
        setIsLoading(false);
        return;
      }

      // Handle errors returned in the response body
      if (authData?.error) {
        toast({
          title: 'Cannot Create Student',
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
          description: 'Failed to create student account - no user data returned',
          variant: 'destructive',
          duration: 10000
        });
        setIsLoading(false);
        return;
      }

      const authUser = authData.user;
      
      // Upload photo first
      const photoUrl = await uploadPhoto(photoFile, authUser.id);
      
      if (!photoUrl) {
        toast({
          title: 'Error',
          description: 'Failed to upload photo. Please try again.',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Insert student record with uploaded photo URL
      const { error } = await supabase
        .from('students')
        .insert([{
          user_id: authUser.id,
          name: formData.name,
          class: formData.class,
          section: formData.section,
          roll_no: formData.rollNo,
          gender: formData.gender as 'male' | 'female' | 'other' | undefined,
          dob: formData.dob,
          parent_name: formData.parentName,
          phone: null,
          parent_phone: formData.parentPhone,
          address: formData.address,
          photo_url: photoUrl,
          is_active: true
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
          description: `Student created successfully! Login with parent phone: ${formData.parentPhone}, Password: ${password}`,
          duration: 10000
        });
        fetchStudents();
        resetForm();
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
      parentPhone: student.parent_phone,
      address: student.address || '',
      password: ''
    });
    setPhotoPreview(student.photo_url || '');
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
      parentPhone: '',
      address: '',
      password: ''
    });
    setPhotoFile(null);
    setPhotoPreview('');
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Student will login using parent's phone + this password
                      </p>
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
                {!editingStudent && (
                  <div>
                    <Label htmlFor="photo">Upload Photo *</Label>
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Photo is required (max 2MB). Click Browse to select an image.
                    </p>
                    {photoPreview && (
                      <div className="mt-2">
                        <img src={photoPreview} alt="Preview" className="w-24 h-24 object-cover rounded" />
                      </div>
                    )}
                  </div>
                )}
                {editingStudent && (
                  <div>
                    <Label>Current Photo</Label>
                    <div className="mt-2">
                      <img src={photoPreview} alt="Student" className="w-24 h-24 object-cover rounded" />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading || isUploading}>
                    {isLoading || isUploading ? 'Saving...' : editingStudent ? 'Update' : 'Create'}
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