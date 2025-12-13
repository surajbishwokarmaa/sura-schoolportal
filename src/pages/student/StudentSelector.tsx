import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface StudentInfo {
  id: string;
  name: string;
  roll_no: string;
  class: string;
  section: string;
  photo_url: string | null;
}

interface StudentSelectorProps {
  parentPhone: string;
  onSelect: (studentId: string) => void;
}

const StudentSelector = ({ parentPhone, onSelect }: StudentSelectorProps) => {
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, [parentPhone]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, roll_no, class, section, photo_url')
        .eq('parent_phone', parentPhone)
        .eq('is_active', true)
        .order('class')
        .order('roll_no');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8 animate-in fade-in duration-700">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Choose Student</h1>
          <p className="text-muted-foreground">Select which student's account to access</p>
        </div>

        <div className="max-w-2xl mx-auto grid gap-4">
          {students.map((student) => (
            <Card
              key={student.id}
              className="p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 animate-fade-in"
              onClick={() => onSelect(student.id)}
            >
              <div className="flex items-center gap-4 sm:gap-6">
                <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-primary/20">
                  <AvatarImage src={student.photo_url || ''} />
                  <AvatarFallback className="text-xl bg-primary/10">
                    {student.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-semibold mb-1">{student.name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>Roll: {student.roll_no}</span>
                    <span>Class: {student.class}</span>
                    <span>Section: {student.section}</span>
                  </div>
                </div>
                <GraduationCap className="w-6 h-6 text-primary hidden sm:block" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentSelector;
