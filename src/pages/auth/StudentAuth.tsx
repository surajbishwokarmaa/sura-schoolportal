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
  identifier: z.string()
    .trim()
    .min(1, 'Email or Phone is required')
    .max(255, 'Input must be less than 255 characters'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

const StudentAuth = () => {
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
    const validation = studentLoginSchema.safeParse({ identifier, password });
    
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

    // If phone number, look up student's email
    if (!isEmail) {
      const { data: studentData, error: lookupError } = await supabase
        .from('students')
        .select('roll_no')
        .or(`phone.eq.${identifier},parent_phone.eq.${identifier}`)
        .maybeSingle();

      if (lookupError || !studentData) {
        toast({
          title: "Login Failed",
          description: "No student found with this phone number. Please contact the administrator.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Construct email from roll number
      emailToUse = `student${studentData.roll_no}@school.edu.np`;
    }

    const { error } = await signIn(emailToUse, password);

    if (error) {
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Please check your email/phone and password.",
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
                <Label htmlFor="identifier">Email or Phone Number</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="identifier"
                    placeholder="Email or Phone Number"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can use either your email or phone number to login
                </p>
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
