import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Badge } from '@/components/ui/badge';

interface Subject {
  id: string;
  name: string;
  class_id: string | null;
  theory_full_marks: number;
  practical_full_marks: number;
  total_marks: number;
  subject_type: 'compulsory' | 'optional';
}

interface ClassData {
  id: string;
  name: string;
}

const SubjectsManagement = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    name: '',
    classId: '',
    theoryFullMarks: '75',
    practicalFullMarks: '25',
    subjectType: 'compulsory' as 'compulsory' | 'optional'
  });

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchData();
    }
  }, [user, userRole, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSubjects(), fetchClasses()]);
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name');

    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch subjects', variant: 'destructive' });
    } else {
      // Cast subject_type to the expected type
      const typedData = (data || []).map(s => ({
        ...s,
        subject_type: (s.subject_type as 'compulsory' | 'optional') || 'compulsory'
      }));
      setSubjects(typedData);
    }
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, display_order')
      .order('display_order', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch classes', variant: 'destructive' });
    } else {
      setClasses(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.classId) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    const theoryMarks = parseInt(formData.theoryFullMarks) || 75;
    const practicalMarks = parseInt(formData.practicalFullMarks) || 25;
    const totalMarks = theoryMarks + practicalMarks;

    const subjectData = {
      name: formData.name,
      class_id: formData.classId,
      theory_full_marks: theoryMarks,
      practical_full_marks: practicalMarks,
      total_marks: totalMarks,
      subject_type: formData.subjectType
    };

    if (editingSubject) {
      const { error } = await supabase
        .from('subjects')
        .update(subjectData)
        .eq('id', editingSubject.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to update subject', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Subject updated successfully' });
        resetForm();
        fetchSubjects();
      }
    } else {
      const { error } = await supabase
        .from('subjects')
        .insert(subjectData);

      if (error) {
        toast({ title: 'Error', description: 'Failed to create subject', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Subject created successfully' });
        resetForm();
        fetchSubjects();
      }
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      classId: subject.class_id || '',
      theoryFullMarks: subject.theory_full_marks.toString(),
      practicalFullMarks: subject.practical_full_marks.toString(),
      subjectType: subject.subject_type || 'compulsory'
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    const { error } = await supabase.from('subjects').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete subject', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Subject deleted successfully' });
      fetchSubjects();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', classId: '', theoryFullMarks: '75', practicalFullMarks: '25', subjectType: 'compulsory' });
    setEditingSubject(null);
    setIsDialogOpen(false);
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return 'No Class';
    return classes.find(c => c.id === classId)?.name || 'Unknown';
  };

  const filteredSubjects = selectedClassFilter === 'all' 
    ? subjects 
    : subjects.filter(s => s.class_id === selectedClassFilter);

  // Group subjects by class
  const subjectsByClass = filteredSubjects.reduce((acc, subject) => {
    const className = getClassName(subject.class_id);
    if (!acc[className]) acc[className] = [];
    acc[className].push(subject);
    return acc;
  }, {} as Record<string, Subject[]>);

  if (loading || authLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4 sm:mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Subject Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Add and manage subjects for each class</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="class">Class *</Label>
                  <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="name">Subject Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Mathematics, English"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subjectType">Subject Type *</Label>
                  <Select value={formData.subjectType} onValueChange={(v: 'compulsory' | 'optional') => setFormData({ ...formData, subjectType: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compulsory">Compulsory</SelectItem>
                      <SelectItem value="optional">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="theory">Theory Full Marks</Label>
                    <Input
                      id="theory"
                      type="number"
                      value={formData.theoryFullMarks}
                      onChange={(e) => setFormData({ ...formData, theoryFullMarks: e.target.value })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="practical">Practical Full Marks</Label>
                    <Input
                      id="practical"
                      type="number"
                      value={formData.practicalFullMarks}
                      onChange={(e) => setFormData({ ...formData, practicalFullMarks: e.target.value })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Marks: {(parseInt(formData.theoryFullMarks) || 0) + (parseInt(formData.practicalFullMarks) || 0)}
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button type="submit">{editingSubject ? 'Update' : 'Add'} Subject</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Label>Filter by Class</Label>
          <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subjects by Class */}
        {Object.keys(subjectsByClass).length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Subjects Found</h3>
            <p className="text-muted-foreground mb-4">Start by adding subjects for your classes</p>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Subject
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(subjectsByClass).map(([className, classSubjects]) => (
              <Card key={className} className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  {className}
                  <Badge variant="secondary" className="ml-2">{classSubjects.length} subjects</Badge>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classSubjects.map((subject) => (
                    <div 
                      key={subject.id} 
                      className="p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{subject.name}</h4>
                            <Badge variant={subject.subject_type === 'compulsory' ? 'default' : 'secondary'} className="text-xs">
                              {subject.subject_type === 'compulsory' ? 'Compulsory' : 'Optional'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            <p>Theory: {subject.theory_full_marks} | Practical: {subject.practical_full_marks}</p>
                            <p className="font-medium">Total: {subject.total_marks}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(subject)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(subject.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectsManagement;
