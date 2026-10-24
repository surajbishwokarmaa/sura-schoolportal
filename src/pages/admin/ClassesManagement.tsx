import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, BookOpen, GraduationCap, Plus, X } from 'lucide-react';
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
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSection, setNewSection] = useState('');
  const [editedSections, setEditedSections] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
              {cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isTerminalClass(cls.name) && (
          <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">
            Terminal
          </Badge>
        )}
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
        <Plus className="w-4 h-4 mr-1" />
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
              <h1 className="text-2xl sm:text-3xl font-bold">Classes Overview</h1>
              <p className="text-sm text-muted-foreground">Manage sections for each class</p>
            </div>
          </div>
        </div>
        
        <Card className="p-4 mb-6 bg-muted/30 border-dashed">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Classes are organized into <strong>Basic Level</strong> (Nursery–Class 10) and <strong>Higher Secondary</strong> (Class 11–12). 
            Click "Manage Sections" on any class to add or remove sections. To manage subjects, go to{' '}
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
            <h3 className="text-xl font-semibold mb-2">Loading Classes...</h3>
            <p className="text-muted-foreground">Standard classes are being loaded</p>
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
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleSaveSections}
                  disabled={isSaving || editedSections.length === 0}
                >
                  {isSaving ? 'Saving...' : 'Save Sections'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ClassesManagement;