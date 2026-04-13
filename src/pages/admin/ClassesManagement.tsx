import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, BookOpen, GraduationCap, Plus, X, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Class {
  id: string;
  name: string;
  sections: string[];
  school_level: number;
  display_order: number;
  subjects: any;
}

const ClassesManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [newSection, setNewSection] = useState('');
  const [editedSections, setEditedSections] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Add class form
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState<string>('1');
  const [newClassOrder, setNewClassOrder] = useState('');
  const [newClassSections, setNewClassSections] = useState<string[]>(['Lotus', 'Rose']);
  const [newClassSectionInput, setNewClassSectionInput] = useState('');

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
      toast({ title: 'Error', description: 'Failed to fetch classes', variant: 'destructive' });
    } else {
      setClasses(data || []);
    }
  };

  const isTerminalClass = (className: string) => {
    const name = className.toLowerCase();
    return name.includes('10') || name.includes('12');
  };

  const handleEditSections = (cls: Class) => {
    setEditingClass(cls);
    setEditedSections([...cls.sections]);
    setNewSection('');
    setIsDialogOpen(true);
  };

  const handleAddSection = () => {
    const trimmed = newSection.trim();
    if (!trimmed) {
      toast({ title: 'Error', description: 'Section name cannot be empty', variant: 'destructive' });
      return;
    }
    if (editedSections.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Error', description: 'Section already exists', variant: 'destructive' });
      return;
    }
    setEditedSections([...editedSections, trimmed]);
    setNewSection('');
  };

  const handleRemoveSection = (section: string) => {
    if (editedSections.length <= 1) {
      toast({ title: 'Error', description: 'At least one section is required', variant: 'destructive' });
      return;
    }
    setEditedSections(editedSections.filter(s => s !== section));
  };

  const handleSaveSections = async () => {
    if (!editingClass || editedSections.length === 0) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('classes')
      .update({ sections: editedSections })
      .eq('id', editingClass.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update sections', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Sections updated for ${editingClass.name}` });
      fetchClasses();
      setIsDialogOpen(false);
      setEditingClass(null);
    }
    setIsSaving(false);
  };

  // Add new class
  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      toast({ title: 'Error', description: 'Class name is required', variant: 'destructive' });
      return;
    }
    if (classes.some(c => c.name.toLowerCase() === newClassName.trim().toLowerCase())) {
      toast({ title: 'Error', description: 'A class with this name already exists', variant: 'destructive' });
      return;
    }
    if (newClassSections.length === 0) {
      toast({ title: 'Error', description: 'At least one section is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const displayOrder = newClassOrder ? parseInt(newClassOrder) : (classes.length > 0 ? Math.max(...classes.map(c => c.display_order)) + 1 : 1);

    const { error } = await supabase.from('classes').insert({
      name: newClassName.trim(),
      school_level: parseInt(newClassLevel),
      display_order: displayOrder,
      sections: newClassSections,
      subjects: [],
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to add class', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${newClassName.trim()} added successfully` });
      fetchClasses();
      setIsAddDialogOpen(false);
      resetAddForm();
    }
    setIsSaving(false);
  };

  const resetAddForm = () => {
    setNewClassName('');
    setNewClassLevel('1');
    setNewClassOrder('');
    setNewClassSections(['Lotus', 'Rose']);
    setNewClassSectionInput('');
  };

  const handleAddNewClassSection = () => {
    const trimmed = newClassSectionInput.trim();
    if (!trimmed) return;
    if (newClassSections.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Error', description: 'Section already exists', variant: 'destructive' });
      return;
    }
    setNewClassSections([...newClassSections, trimmed]);
    setNewClassSectionInput('');
  };

  const handleRemoveNewClassSection = (section: string) => {
    if (newClassSections.length <= 1) {
      toast({ title: 'Error', description: 'At least one section is required', variant: 'destructive' });
      return;
    }
    setNewClassSections(newClassSections.filter(s => s !== section));
  };

  // Delete class
  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    setIsSaving(true);

    // Check if there are students in this class
    const { count } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class', classToDelete.name);

    if (count && count > 0) {
      toast({
        title: 'Cannot Delete',
        description: `${classToDelete.name} has ${count} student(s). Remove or transfer them first.`,
        variant: 'destructive'
      });
      setIsSaving(false);
      setIsDeleteDialogOpen(false);
      return;
    }

    const { error } = await supabase.from('classes').delete().eq('id', classToDelete.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete class', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${classToDelete.name} deleted successfully` });
      fetchClasses();
    }
    setIsSaving(false);
    setIsDeleteDialogOpen(false);
    setClassToDelete(null);
  };

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
    <Card key={cls.id} className="p-4 sm:p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
            cls.school_level === 2 ? 'bg-purple-500/10' : 'bg-primary/10'
          }`}>
            {cls.school_level === 2 ? (
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            ) : (
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            )}
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold">{cls.name}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''} · Order: {cls.display_order}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isTerminalClass(cls.name) && (
            <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">
              Terminal
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => { setClassToDelete(cls); setIsDeleteDialogOpen(true); }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {cls.sections.map((section) => (
          <Badge key={section} variant="secondary" className="text-xs sm:text-sm">
            {section}
          </Badge>
        ))}
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full"
        onClick={() => handleEditSections(cls)}
      >
        <Edit className="w-4 h-4 mr-1" />
        Manage Sections
      </Button>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Classes Management</h1>
              <p className="text-sm text-muted-foreground">Add, remove, and manage class sections</p>
            </div>
          </div>
          <Button onClick={() => { resetAddForm(); setIsAddDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Class</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
        
        <Card className="p-4 mb-6 bg-muted/30 border-dashed">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> You can add new classes, remove existing ones, and manage sections. 
            Deleting a class is only allowed if no students are enrolled in it.
            To manage subjects, go to{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/admin/subjects')}>Subject Management</Button>.
          </p>
        </Card>

        {/* Basic Level Classes */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-semibold">Basic Level</h2>
            <Badge variant="secondary">{basicLevelClasses.length} classes</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              <h2 className="text-lg sm:text-xl font-semibold">Higher Secondary</h2>
              <Badge variant="outline" className="border-purple-500 text-purple-600">
                {higherSecondaryClasses.length} classes
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {higherSecondaryClasses.map((cls) => (
                <ClassCard key={cls.id} cls={cls} />
              ))}
            </div>
          </div>
        )}

        {classes.length === 0 && (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Classes Found</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first class</p>
            <Button onClick={() => { resetAddForm(); setIsAddDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Class
            </Button>
          </Card>
        )}

        {/* Edit Sections Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Sections - {editingClass?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Current Sections</Label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-muted/30">
                  {editedSections.map((section) => (
                    <Badge key={section} variant="secondary" className="flex items-center gap-1 pr-1">
                      {section}
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(section)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {editedSections.length === 0 && (
                    <span className="text-sm text-muted-foreground">No sections</span>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="newSection" className="text-sm font-medium mb-2 block">Add New Section</Label>
                <div className="flex gap-2">
                  <Input
                    id="newSection"
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    placeholder="e.g., Lily, Sunflower"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSection())}
                  />
                  <Button type="button" onClick={handleAddSection} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSaveSections} disabled={isSaving || editedSections.length === 0}>
                  {isSaving ? 'Saving...' : 'Save Sections'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Class Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="className">Class Name *</Label>
                <Input
                  id="className"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Class 13, Pre-Nursery"
                />
              </div>
              <div>
                <Label>School Level *</Label>
                <Select value={newClassLevel} onValueChange={setNewClassLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Basic Level</SelectItem>
                    <SelectItem value="2">Higher Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="classOrder">Display Order</Label>
                <Input
                  id="classOrder"
                  type="number"
                  value={newClassOrder}
                  onChange={(e) => setNewClassOrder(e.target.value)}
                  placeholder="Auto (after last class)"
                />
              </div>
              <div>
                <Label className="mb-2 block">Sections</Label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-muted/30 mb-2">
                  {newClassSections.map((section) => (
                    <Badge key={section} variant="secondary" className="flex items-center gap-1 pr-1">
                      {section}
                      <button type="button" onClick={() => handleRemoveNewClassSection(section)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newClassSectionInput}
                    onChange={(e) => setNewClassSectionInput(e.target.value)}
                    placeholder="Add section name"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewClassSection())}
                  />
                  <Button type="button" onClick={handleAddNewClassSection} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAddClass} disabled={isSaving}>
                  {isSaving ? 'Adding...' : 'Add Class'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {classToDelete?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this class. This action cannot be undone. 
                Classes with enrolled students cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteClass} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isSaving ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ClassesManagement;
