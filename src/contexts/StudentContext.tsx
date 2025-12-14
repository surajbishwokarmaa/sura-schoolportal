import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface StudentInfo {
  id: string;
  name: string;
  roll_no: string;
  class: string;
  section: string;
  photo_url: string | null;
  parent_phone: string;
}

interface StudentContextType {
  selectedStudent: StudentInfo | null;
  allStudents: StudentInfo[];
  hasMultipleStudents: boolean;
  isLoading: boolean;
  setSelectedStudent: (student: StudentInfo | null) => void;
  clearStudentSelection: () => void;
  refreshStudents: () => Promise<void>;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user, userRole } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && userRole === 'student') {
      fetchStudents();
    } else {
      setAllStudents([]);
      setSelectedStudent(null);
      setIsLoading(false);
    }
  }, [user, userRole]);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      // First get the student record linked to this user to find their parent_phone
      const { data: currentStudent, error: currentError } = await supabase
        .from('students')
        .select('id, parent_phone')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (currentError) {
        console.error('Error fetching current student:', currentError);
        setIsLoading(false);
        return;
      }

      if (!currentStudent?.parent_phone) {
        console.log('No parent phone found for user');
        setIsLoading(false);
        return;
      }

      console.log('Current student parent_phone:', currentStudent.parent_phone);

      // Fetch ALL students with this parent_phone (siblings) - bypassing RLS using service role via edge function would be ideal
      // For now, we fetch directly - RLS should allow this if properly configured
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, roll_no, class, section, photo_url, parent_phone')
        .eq('parent_phone', currentStudent.parent_phone)
        .eq('is_active', true)
        .order('class', { ascending: true })
        .order('roll_no', { ascending: true });

      if (studentsError) {
        console.error('Error fetching siblings:', studentsError);
        // Fallback: if RLS blocks sibling query, at least show current student
        setAllStudents([{
          id: currentStudent.id,
          name: '',
          roll_no: '',
          class: '',
          section: '',
          photo_url: null,
          parent_phone: currentStudent.parent_phone
        }]);
        setIsLoading(false);
        return;
      }

      const students = studentsData || [];
      console.log('Found students for parent phone:', students.length, students);
      setAllStudents(students);

      // Check localStorage for saved selection first
      const savedStudentId = localStorage.getItem('selectedStudentId');
      
      if (students.length === 1) {
        // Only one student - auto-select
        setSelectedStudent(students[0]);
      } else if (students.length > 1) {
        // Multiple students - check for saved selection
        if (savedStudentId) {
          const savedStudent = students.find(s => s.id === savedStudentId);
          if (savedStudent) {
            setSelectedStudent(savedStudent);
          }
          // If saved student not found in list, leave null to trigger picker
        }
        // If no saved selection, selectedStudent stays null to trigger picker
      }
    } catch (error) {
      console.error('Error in fetchStudents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetSelectedStudent = (student: StudentInfo | null) => {
    setSelectedStudent(student);
    if (student) {
      localStorage.setItem('selectedStudentId', student.id);
    } else {
      localStorage.removeItem('selectedStudentId');
    }
  };

  const clearStudentSelection = () => {
    setSelectedStudent(null);
    localStorage.removeItem('selectedStudentId');
  };

  const refreshStudents = async () => {
    await fetchStudents();
  };

  const hasMultipleStudents = allStudents.length > 1;

  return (
    <StudentContext.Provider
      value={{
        selectedStudent,
        allStudents,
        hasMultipleStudents,
        isLoading,
        setSelectedStudent: handleSetSelectedStudent,
        clearStudentSelection,
        refreshStudents
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};
