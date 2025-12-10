import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2, ArrowLeft, Users, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
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
  photo_url: string | null;
}

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
    classesAssigned: '',
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

  const uploadPhoto = async (file: File, teacherId: string): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${teacherId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('teacher-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('teacher-photos')
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

  // Generate a unique email from phone number for auth purposes
  const generateEmailFromPhone = (phone: string): string => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `teacher${cleanPhone}@school.edu.np`;
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

      if (!formData.password || formData.password.trim() === '') {
        toast({
          title: 'Error',
          description: 'Password is required for new teachers',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      if (!photoFile) {
        toast({
          title: 'Error',
          description: 'Photo is required for all teachers',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      const password = formData.password;
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
        toast({
          title: 'Error',
          description: authError.message || 'Failed to create teacher account',
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

      // Insert teacher record with uploaded photo URL
      const { error } = await supabase
        .from('teachers')
        .insert({
          user_id: authUser.id,
          name: formData.name,
          email: generatedEmail,
          phone: formData.phone,
          subjects: subjectsArray,
          classes_assigned: classesArray,
          photo_url: photoUrl
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
      classesAssigned: teacher.classes_assigned.join(', '),
      password: ''
    });
    setPhotoPreview(teacher.photo_url || '');
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
      classesAssigned: '',
      password: ''
    });
    setPhotoFile(null);
    setPhotoPreview('');
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
                    <div className="sm:col-span-2">
                      <Label htmlFor="password">Password *</Label>
                      <PasswordInput
                        id="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                        minLength={8}
                      />
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
                  <Label htmlFor="classesAssigned">Assigned Classes (comma-separated) *</Label>
                  <Input
                    id="classesAssigned"
                    value={formData.classesAssigned}
                    onChange={(e) => setFormData({...formData, classesAssigned: e.target.value})}
                    placeholder="e.g., Class 1, Class 2"
                    required
                  />
                  {classes.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Available classes: {classes.map(c => c.name).join(', ')}
                    </p>
                  )}
                </div>
                {!editingTeacher && (
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
                <Button type="submit" disabled={isLoading || isUploading} className="w-full">
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
                {teacher.photo_url ? (
                  <img
                    src={teacher.photo_url}
                    alt={teacher.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{teacher.name}</h3>
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
