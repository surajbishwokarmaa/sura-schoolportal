import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { StudentProvider } from "./contexts/StudentContext";
import Index from "./pages/Index";
import TeacherAuth from "./pages/auth/TeacherAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ClassesManagement from "./pages/admin/ClassesManagement";
import TeachersManagement from "./pages/admin/TeachersManagement";
import StudentsManagement from "./pages/admin/StudentsManagement";
import SubjectsManagement from "./pages/admin/SubjectsManagement";
import BulkUploadManagement from "./pages/admin/BulkUploadManagement";
import NoticesManagement from "./pages/admin/NoticesManagement";
import SystemGuide from "./pages/admin/SystemGuide";
import StudentDashboard from "./pages/student/StudentDashboard";
import ViewMarksheet from "./pages/student/ViewMarksheet";
import StudentViewNotices from "./pages/student/ViewNotices";
import StaffInfo from "./pages/student/StaffInfo";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import ResultEntry from "./pages/teacher/ResultEntry";
import ViewStudents from "./pages/teacher/ViewStudents";
import ViewResults from "./pages/teacher/ViewResults";
import TeacherViewNotices from "./pages/teacher/ViewNotices";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StudentProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth/teacher" element={<TeacherAuth />} />
              <Route path="/auth/admin" element={<AdminAuth />} />
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/marksheet" element={<ViewMarksheet />} />
              <Route path="/student/notices" element={<StudentViewNotices />} />
              <Route path="/student/staff" element={<StaffInfo />} />
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route path="/teacher/result-entry" element={<ResultEntry />} />
              <Route path="/teacher/students" element={<ViewStudents />} />
              <Route path="/teacher/results" element={<ViewResults />} />
              <Route path="/teacher/notices" element={<TeacherViewNotices />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/classes" element={<ClassesManagement />} />
              <Route path="/admin/teachers" element={<TeachersManagement />} />
              <Route path="/admin/students" element={<StudentsManagement />} />
              <Route path="/admin/subjects" element={<SubjectsManagement />} />
              <Route path="/admin/bulk-upload" element={<BulkUploadManagement />} />
              <Route path="/admin/notices" element={<NoticesManagement />} />
              <Route path="/admin/system-guide" element={<SystemGuide />} />
              <Route path="/system-guide" element={<SystemGuide />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StudentProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
