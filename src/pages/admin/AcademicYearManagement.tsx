import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, Plus, Check, AlertTriangle, Users, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface AcademicYear {
  id: string;
  year_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface PromotionStats {
  totalStudents: number;
  promoted: number;
  graduated: number;
}

const AcademicYearManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  const [selectedYearForPromotion, setSelectedYearForPromotion] = useState<AcademicYear | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionStats, setPromotionStats] = useState<PromotionStats | null>(null);
  const [formData, setFormData] = useState({
    yearName: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchAcademicYears();
    }
  }, [user, userRole, loading, navigate]);

  const fetchAcademicYears = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .order('year_name', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch academic years',
        variant: 'destructive'
      });
    } else {
      setAcademicYears(data || []);
    }
    setIsLoading(false);
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase
      .from('academic_years')
      .insert({
        year_name: formData.yearName,
        start_date: formData.startDate,
        end_date: formData.endDate,
        is_current: false
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create academic year',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Academic year created successfully'
      });
      fetchAcademicYears();
      setIsDialogOpen(false);
      setFormData({ yearName: '', startDate: '', endDate: '' });
    }
    setIsLoading(false);
  };

  const initiateSetCurrentYear = async (year: AcademicYear) => {
    if (year.is_current) {
      toast({
        title: 'Info',
        description: 'This is already the current academic year'
      });
      return;
    }

    // Count students that will be affected
    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('graduation_status', 'active');

    // Count terminal class students (will graduate)
    const { data: terminalStudents } = await supabase
      .from('students')
      .select('id, class')
      .eq('is_active', true)
      .eq('graduation_status', 'active');

    const graduatingCount = terminalStudents?.filter(s => 
      ['Grade 10', 'Class 10', '10', 'Grade 12', 'Class 12', '12'].includes(s.class)
    ).length || 0;

    setPromotionStats({
      totalStudents: totalStudents || 0,
      promoted: (totalStudents || 0) - graduatingCount,
      graduated: graduatingCount
    });

    setSelectedYearForPromotion(year);
    setIsPromotionDialogOpen(true);
  };

  const executePromotion = async () => {
    if (!selectedYearForPromotion) return;

    setIsPromoting(true);

    try {
      // 1. First, update the current year flag
      await supabase
        .from('academic_years')
        .update({ is_current: false })
        .eq('is_current', true);

      await supabase
        .from('academic_years')
        .update({ is_current: true })
        .eq('id', selectedYearForPromotion.id);

      // 2. Get all active students
      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('id, class, graduation_status')
        .eq('is_active', true)
        .eq('graduation_status', 'active');

      if (fetchError) throw fetchError;

      let promotedCount = 0;
      let graduatedCount = 0;

      // 3. Process each student
      for (const student of students || []) {
        // Check if terminal class
        const isTerminal = ['Grade 10', 'Class 10', '10', 'Grade 12', 'Class 12', '12'].includes(student.class);

        if (isTerminal) {
          // Graduate the student
          await supabase
            .from('students')
            .update({ graduation_status: 'graduated' })
            .eq('id', student.id);
          graduatedCount++;
        } else {
          // Get next class
          const { data: nextClassData } = await supabase
            .rpc('get_next_class', { current_class: student.class });

          if (nextClassData) {
            await supabase
              .from('students')
              .update({ class: nextClassData })
              .eq('id', student.id);
            promotedCount++;
          }
        }
      }

      toast({
        title: 'Promotion Complete!',
        description: `${promotedCount} students promoted, ${graduatedCount} students graduated.`,
        duration: 10000
      });

      fetchAcademicYears();
    } catch (error: any) {
      console.error('Promotion error:', error);
      toast({
        title: 'Promotion Failed',
        description: error.message || 'Failed to complete promotion',
        variant: 'destructive'
      });
    } finally {
      setIsPromoting(false);
      setIsPromotionDialogOpen(false);
      setSelectedYearForPromotion(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Academic Year Management</h1>
              <p className="text-muted-foreground text-sm">
                Manage academic years and automatic class promotion
              </p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Year
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Academic Year</DialogTitle>
                <DialogDescription>
                  Create a new academic year for the school.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateYear} className="space-y-4">
                <div>
                  <Label htmlFor="yearName">Year Name (e.g., 2082)</Label>
                  <Input
                    id="yearName"
                    value={formData.yearName}
                    onChange={(e) => setFormData({ ...formData, yearName: e.target.value })}
                    placeholder="2082"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Card */}
        <Card className="p-4 mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">Automatic Promotion Rules</p>
              <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                <li>• When you set a new academic year as current, all students are automatically promoted</li>
                <li>• Grade 10 students → <strong>Graduated</strong> (not promoted to 11)</li>
                <li>• Grade 12 students → <strong>Graduated</strong></li>
                <li>• Graduated students can still view their results but cannot be promoted again</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Academic Years List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {academicYears.map((year) => (
            <Card key={year.id} className={`p-6 ${year.is_current ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    year.is_current ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{year.year_name}</h3>
                    {year.is_current && (
                      <Badge className="mt-1">Current Year</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                <p>Start: {new Date(year.start_date).toLocaleDateString()}</p>
                <p>End: {new Date(year.end_date).toLocaleDateString()}</p>
              </div>
              {!year.is_current && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => initiateSetCurrentYear(year)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Set as Current & Promote
                </Button>
              )}
            </Card>
          ))}
        </div>

        {academicYears.length === 0 && !isLoading && (
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Academic Years</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first academic year
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Year
            </Button>
          </Card>
        )}

        {/* Promotion Confirmation Dialog */}
        <AlertDialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Confirm Academic Year Change
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  Setting <strong>{selectedYearForPromotion?.year_name}</strong> as the current year will automatically promote all students.
                </p>
                
                {promotionStats && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Total Active Students:
                      </span>
                      <strong>{promotionStats.totalStudents}</strong>
                    </div>
                    <div className="flex items-center justify-between text-green-600">
                      <span>Will be Promoted:</span>
                      <strong>{promotionStats.promoted}</strong>
                    </div>
                    <div className="flex items-center justify-between text-amber-600">
                      <span className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        Will Graduate:
                      </span>
                      <strong>{promotionStats.graduated}</strong>
                    </div>
                  </div>
                )}

                <p className="text-destructive font-medium">
                  This action cannot be undone!
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPromoting}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={executePromotion}
                disabled={isPromoting}
                className="bg-primary"
              >
                {isPromoting ? 'Processing...' : 'Confirm & Promote All'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AcademicYearManagement;
