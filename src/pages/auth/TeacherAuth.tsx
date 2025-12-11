import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const teacherLoginSchema = z.object({
  phone: z.string()
    .trim()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s]+$/, 'Invalid phone number format'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

const TeacherAuth = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Clean phone number - remove spaces and dashes
    const cleanPhone = phone.replace(/[\s\-]/g, '');

    // Validate input
    const validation = teacherLoginSchema.safeParse({ phone: cleanPhone, password });
    
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

    try {
      // Look up teacher's email by phone number using secure function
      const { data: teacherData, error: lookupError } = await supabase
        .rpc('get_teacher_login_info', { teacher_phone_input: cleanPhone });

      if (lookupError) {
        throw lookupError;
      }

      if (!teacherData || teacherData.length === 0 || !teacherData[0]?.teacher_email) {
        toast({
          title: "Login Failed",
          description: "No teacher found with this phone number. Please contact the administrator.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const teacherEmail = teacherData[0].teacher_email;

      const { error } = await signIn(teacherEmail, password);

      if (error) {
        toast({
          title: "Login Failed",
          description: "Invalid credentials. Please check your phone number and password.",
          variant: "destructive"
        });
        setLoading(false);
      } else {
        toast({
          title: "Welcome Back!",
          description: "Redirecting to dashboard...",
        });
        // Small delay to ensure auth state is updated
        setTimeout(() => navigate('/teacher'), 100);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: "An error occurred. Please try again.",
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
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="max-w-md mx-auto">
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
              <Users className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Teacher Login</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Access your teaching dashboard</p>
          </div>

          <Card className="p-4 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm sm:text-base">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9 sm:pl-10 text-base"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the phone number registered by admin
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm sm:text-base">Password</Label>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-base"
                  required
                />
              </div>

              <Button type="submit" className="w-full text-base" size="lg" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>

              <div className="text-center text-xs sm:text-sm text-muted-foreground mt-4">
                <p>Contact administrator if you forgot your credentials</p>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TeacherAuth;
