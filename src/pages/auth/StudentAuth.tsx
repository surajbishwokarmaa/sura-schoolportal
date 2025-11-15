import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const studentLoginSchema = z.object({
  parentPhone: z.string()
    .trim()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^\d+$/, 'Phone number must contain only digits'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

const StudentAuth = () => {
  const [parentPhone, setParentPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input and trim whitespace
      const cleanPhone = parentPhone.trim();
      const cleanPassword = password.trim();
      
      console.log('🔍 Login attempt with phone:', cleanPhone);
      
      const validation = studentLoginSchema.safeParse({ parentPhone: cleanPhone, password: cleanPassword });
      
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        console.error('❌ Validation failed:', firstError.message);
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Look up student's email using secure database function (bypasses RLS)
      console.log('🔍 Looking up student with parent_phone:', cleanPhone);
      const { data: studentData, error: lookupError } = await supabase
        .rpc('get_student_login_info', { parent_phone_input: cleanPhone });

      if (lookupError) {
        console.error('❌ Database lookup error:', lookupError);
        toast({
          title: "Login Failed",
          description: "Database error. Please try again or contact administrator.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!studentData || studentData.length === 0) {
        console.error('❌ No student found for phone:', cleanPhone);
        toast({
          title: "Login Failed",
          description: "No active student found with this parent phone number. Please verify the number or contact the administrator.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const student = studentData[0];
      console.log('✅ Student found:', { name: student.student_name, roll_no: student.roll_no });
      
      const emailToUse = student.student_email;
      console.log('🔍 Attempting sign in with email:', emailToUse);
      console.log('🔍 Password length:', cleanPassword.length);

      const { error } = await signIn(emailToUse, cleanPassword);

      if (error) {
        console.error('❌ Sign in error:', error);
        toast({
          title: "Login Failed",
          description: `Invalid password. ${error.message}`,
          variant: "destructive",
          duration: 5000
        });
        setLoading(false);
      } else {
        console.log('✅ Login successful!');
        toast({
          title: `Welcome ${student.student_name}!`,
          description: "Redirecting to dashboard...",
        });
        // Navigate immediately after successful login
        setTimeout(() => navigate('/student'), 100);
      }
    } catch (error) {
      console.error('❌ Unexpected login error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <Button
          variant="ghost"
          className="mb-4 sm:mb-6"
          onClick={() => navigate('/select-role')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Role Selection
        </Button>

        <div className="max-w-md mx-auto">
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
              <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Student & Parent Login</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Login using parent's phone number</p>
          </div>

          <Card className="p-4 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="parentPhone" className="text-sm sm:text-base">Parent's Phone Number</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <Input
                    id="parentPhone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Parent's Phone Number"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="pl-9 sm:pl-10 text-base"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the parent phone number registered with the school
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm sm:text-base">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 sm:pl-10 text-base"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full text-base" size="lg" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>

              <div className="text-center text-xs sm:text-sm text-muted-foreground mt-4">
                <p>Use the credentials provided by the school administrator</p>
                <p className="mt-2">Need help? Contact admin</p>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentAuth;
