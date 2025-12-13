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
  setSelectedStudent: (student: StudentInfo | null) => void;
  clearStudentSelection: () => void;
  refreshStudents: () => Promise<void>;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user, userRole } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([]);

  useEffect(() => {
    if (user && userRole === 'student') {
      fetchStudents();
    } else {
      setAllStudents([]);
      setSelectedStudent(null);
    }
  }, [user, userRole]);

  const fetchStudents = async () => {
    try {
      // Get parent phone from user metadata or from student record
      let parentPhone: string | null = null;
      
      // Try to get parent_phone from the current user's student record
      const { data: currentStudent, error: currentError } = await supabase
        .from('students')
        .select('parent_phone')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (currentStudent?.parent_phone) {
        parentPhone = currentStudent.parent_phone;
      }

      if (!parentPhone) {
        console.log('No parent phone found for user');
        return;
      }

      // Fetch all students with this parent_phone (siblings)
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, roll_no, class, section, photo_url, parent_phone')
        .eq('parent_phone', parentPhone)
        .eq('is_active', true)
        .order('class', { ascending: true })
        .order('roll_no', { ascending: true });

      if (studentsError) throw studentsError;

      const students = studentsData || [];
      setAllStudents(students);

      // Check if there's a saved selection in localStorage first
      const savedStudentId = localStorage.getItem('selectedStudentId');
      if (savedStudentId && students.length > 1) {
        const savedStudent = students.find(s => s.id === savedStudentId);
        if (savedStudent) {
          setSelectedStudent(savedStudent);
          return;
        }
      }

      // If only one student, auto-select them
      if (students.length === 1) {
        setSelectedStudent(students[0]);
      }
      // If multiple students and no saved selection, leave selectedStudent null to trigger picker
    } catch (error) {
      console.error('Error fetching students:', error);
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
