import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, Mail } from 'lucide-react';
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
  identifier: z.string()
    .trim()
    .min(1, 'Email or Phone is required')
    .max(255, 'Input must be less than 255 characters'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

const TeacherAuth = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate input
    const validation = teacherLoginSchema.safeParse({ identifier, password });
    
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

    // Check if identifier is email or phone
    const isEmail = identifier.includes('@');
    let emailToUse = identifier;

    // If phone number, look up teacher's email
    if (!isEmail) {
      const { data: teacherData, error: lookupError } = await supabase
        .from('teachers')
        .select('email')
        .eq('phone', identifier)
        .maybeSingle();

      if (lookupError || !teacherData || !teacherData.email) {
        toast({
          title: "Login Failed",
          description: "No teacher found with this phone number. Please contact the administrator.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      emailToUse = teacherData.email;
    }

    const { error } = await signIn(emailToUse, password);

    if (error) {
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Please check your email/phone and password.",
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
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
              <Users className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Teacher Login</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Access your teaching dashboard</p>
          </div>

          <Card className="p-4 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm sm:text-base">Email or Phone Number</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="Email or Phone Number"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-9 sm:pl-10 text-base"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can use either your email or phone number to login
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
