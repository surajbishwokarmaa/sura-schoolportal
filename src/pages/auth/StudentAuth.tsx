import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Phone, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';

const studentLoginSchema = z.object({
  phone: z.string()
    .trim()
    .min(1, 'Phone number is required')
    .min(7, 'Phone number must be at least 7 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

const StudentAuth = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [showSelection, setShowSelection] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate input
    const validation = studentLoginSchema.safeParse({ phone, password });
    
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // Import supabase to look up student by phone
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Find all students with this phone (family phone linking)
    const { data: foundStudents, error: lookupError } = await supabase
      .from('students')
      .select('roll_no, name, class, section')
      .or(`phone.eq.${phone},parent_phone.eq.${phone}`);

    if (lookupError || !foundStudents || foundStudents.length === 0) {
      toast({
        title: "Login Failed",
        description: "No student found with this phone number. Please contact the school administrator.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // If multiple students found, show selection screen
    if (foundStudents.length > 1) {
      setStudents(foundStudents);
      setShowSelection(true);
      setLoading(false);
      return;
    }

    // Single student found, proceed with login
    await performLogin(foundStudents[0].roll_no);
  };

  const performLogin = async (rollNo: string) => {
    setLoading(true);
    
    // Construct the email from roll number
    const email = `student${rollNo}@school.edu.np`;
    
    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Login Failed",
        description: "Invalid password. Please check your password or contact the school administrator.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Welcome!",
        description: "Login successful. Redirecting to dashboard...",
      });
      navigate('/student');
    }

    setLoading(false);
  };

  const handleStudentSelect = (rollNo: string) => {
    performLogin(rollNo);
  };

  if (showSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => {
              setShowSelection(false);
              setStudents([]);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>

          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 space-y-2">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold">Select Student</h1>
              <p className="text-muted-foreground">Multiple students found with this phone number</p>
            </div>

            <div className="grid gap-4">
              {students.map((student) => (
                <Card
                  key={student.roll_no}
                  className="p-6 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleStudentSelect(student.roll_no)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">{student.name}</h3>
                      <p className="text-muted-foreground">
                        Class {student.class} - Section {student.section} | Roll No: {student.roll_no}
                      </p>
                    </div>
                    <GraduationCap className="w-8 h-8 text-muted-foreground" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/select-role')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Role Selection
        </Button>

        <div className="max-w-md mx-auto">
          <div className="text-center mb-8 space-y-2">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Student & Parent Login</h1>
            <p className="text-muted-foreground">Access your academic records and results</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>

              <div className="text-center text-sm text-muted-foreground mt-4">
                <p>Use the phone number registered with the school</p>
                <p className="mt-2">Forgot password? Contact school administrator</p>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentAuth;
