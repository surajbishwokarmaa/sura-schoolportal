import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ArrowRight, GraduationCap, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Student {
  id: string;
  name: string;
  roll_no: string;
  class: string;
  section: string;
  photo_url: string | null;
  graduation_status: string;
}

interface ClassInfo {
  id: string;
  name: string;
  sections: string[];
  school_level: number;
}

// Terminal classes where students graduate instead of being promoted
const TERMINAL_CLASSES = ['Grade 10', 'Class 10', '10', 'Grade 12', 'Class 12', '12'];

// Get next class for promotion (returns null for terminal classes)
const getNextClass = (currentClass: string): string | null => {
  const classMap: Record<string, string> = {
    'Nursery': 'LKG',
    'nursery': 'LKG',
    'LKG': 'UKG',
    'lkg': 'UKG',
    'UKG': 'Grade 1',
    'ukg': 'Grade 1',
    'Grade 1': 'Grade 2',
    'Class 1': 'Grade 2',
    '1': 'Grade 2',
    'Grade 2': 'Grade 3',
    'Class 2': 'Grade 3',
    '2': 'Grade 3',
    'Grade 3': 'Grade 4',
    'Class 3': 'Grade 4',
    '3': 'Grade 4',
    'Grade 4': 'Grade 5',
    'Class 4': 'Grade 5',
    '4': 'Grade 5',
    'Grade 5': 'Grade 6',
    'Class 5': 'Grade 6',
    '5': 'Grade 6',
    'Grade 6': 'Grade 7',
    'Class 6': 'Grade 7',
    '6': 'Grade 7',
    'Grade 7': 'Grade 8',
    'Class 7': 'Grade 8',
    '7': 'Grade 8',
    'Grade 8': 'Grade 9',
    'Class 8': 'Grade 9',
    '8': 'Grade 9',
    'Grade 9': 'Grade 10',
    'Class 9': 'Grade 10',
    '9': 'Grade 10',
    // Level 2 promotion (Higher Secondary)
    'Grade 11': 'Grade 12',
    'Class 11': 'Grade 12',
    '11': 'Grade 12',
  };
  
  // Terminal classes - no promotion
  if (TERMINAL_CLASSES.some(tc => currentClass.toLowerCase().includes(tc.toLowerCase()))) {
    return null;
  }
  
  return classMap[currentClass] || null;
};

const isTerminalClass = (className: string): boolean => {
  return TERMINAL_CLASSES.some(tc => 
    className.toLowerCase().includes(tc.toLowerCase().replace('class ', '').replace('grade ', ''))
  );
};

const ClassPromotion = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [promotionType, setPromotionType] = useState<'promote' | 'graduate'>('promote');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchClasses();
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClass, selectedSection]);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('school_level')
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

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, name, roll_no, class, section, photo_url, graduation_status')
      .eq('class', selectedClass)
      .eq('section', selectedSection)
      .eq('is_active', true)
      .eq('graduation_status', 'active')
      .order('roll_no');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch students',
        variant: 'destructive'
      });
    } else {
      setStudents(data || []);
    }
  };

  const getAvailableSections = (): string[] => {
    const selectedClassData = classes.find(c => c.name === selectedClass);
    return selectedClassData?.sections || [];
  };

  const handlePromoteAll = async () => {
    if (!selectedClass || students.length === 0) return;
    
    const isTerminal = isTerminalClass(selectedClass);
    setPromotionType(isTerminal ? 'graduate' : 'promote');
    setShowConfirmDialog(true);
  };

  const executePromotion = async () => {
    setIsProcessing(true);
    setShowConfirmDialog(false);

    try {
      const isTerminal = isTerminalClass(selectedClass);
      const nextClass = getNextClass(selectedClass);

      if (isTerminal) {
        // Graduate all students in terminal class
        const { error } = await supabase
          .from('students')
          .update({ graduation_status: 'graduated' })
          .in('id', students.map(s => s.id));

        if (error) throw error;

        toast({
          title: 'Success',
          description: `${students.length} students marked as graduated from ${selectedClass}`,
        });
      } else if (nextClass) {
        // Promote students to next class
        const { error } = await supabase
          .from('students')
          .update({ class: nextClass })
          .in('id', students.map(s => s.id));

        if (error) throw error;

        toast({
          title: 'Success',
          description: `${students.length} students promoted from ${selectedClass} to ${nextClass}`,
        });
      }

      // Refresh students list
      fetchStudents();
    } catch (error) {
      console.error('Promotion error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process promotion',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const nextClass = selectedClass ? getNextClass(selectedClass) : null;
  const isTerminal = selectedClass ? isTerminalClass(selectedClass) : false;

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
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Class Promotion</h1>
            <p className="text-muted-foreground">Promote students to next class or mark as graduated</p>
          </div>
        </div>

        {/* Important Rules Card */}
        <Card className="p-4 mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-400">Promotion Rules</h3>
              <ul className="text-sm text-amber-700 dark:text-amber-500 mt-1 space-y-1">
                <li>• <strong>Grade 10</strong> students will be marked as <strong>Graduated</strong> (not promoted to 11)</li>
                <li>• <strong>Grade 12</strong> students will be marked as <strong>Graduated</strong></li>
                <li>• Grade 11 admission is a separate new entry process</li>
                <li>• Only active students can be promoted</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Selection Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Class</label>
              <Select value={selectedClass} onValueChange={(value) => {
                setSelectedClass(value);
                setSelectedSection('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.name}>
                      {cls.name} {isTerminalClass(cls.name) && '(Terminal)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Select Section</label>
              <Select 
                value={selectedSection} 
                onValueChange={setSelectedSection}
                disabled={!selectedClass}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a section" />
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
          </div>
        </Card>

        {/* Promotion Preview */}
        {selectedClass && selectedSection && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {selectedClass}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Current</p>
                </div>
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  {isTerminal ? (
                    <Badge variant="outline" className="text-lg px-4 py-2 text-amber-600 border-amber-600">
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Graduated
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-lg px-4 py-2">
                      {nextClass || 'N/A'}
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {isTerminal ? 'Final Status' : 'Next Class'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold">{students.length} students</span>
              </div>
            </div>

            <Button 
              onClick={handlePromoteAll}
              disabled={students.length === 0 || isProcessing}
              className="w-full"
              variant={isTerminal ? 'outline' : 'default'}
            >
              {isProcessing ? 'Processing...' : isTerminal ? (
                <>
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Mark All as Graduated
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Promote All to {nextClass}
                </>
              )}
            </Button>
          </Card>
        )}

        {/* Students List */}
        {students.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => (
              <Card key={student.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold">{student.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold">{student.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Roll: {student.roll_no} | Section: {student.section}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {selectedClass && selectedSection && students.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Active Students</h3>
            <p className="text-muted-foreground">
              There are no active students in {selectedClass} Section {selectedSection} to promote.
            </p>
          </Card>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {promotionType === 'graduate' ? 'Confirm Graduation' : 'Confirm Promotion'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {promotionType === 'graduate' ? (
                  <>
                    Are you sure you want to mark <strong>{students.length} students</strong> from{' '}
                    <strong>{selectedClass}</strong> as <strong>Graduated</strong>?
                    <br /><br />
                    <span className="text-amber-600">
                      Note: Graduated students will not be auto-promoted. Their results will remain viewable.
                    </span>
                  </>
                ) : (
                  <>
                    Are you sure you want to promote <strong>{students.length} students</strong> from{' '}
                    <strong>{selectedClass}</strong> to <strong>{nextClass}</strong>?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executePromotion}>
                {promotionType === 'graduate' ? 'Mark as Graduated' : 'Promote All'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ClassPromotion;
