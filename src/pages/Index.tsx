import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { GraduationCap, Phone, Lock, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const Index = () => {
  const navigate = useNavigate();
  const { user, userRole, loading: authLoading, signIn } = useAuth();
  const { toast } = useToast();
  
  const [parentPhone, setParentPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && userRole) {
      if (userRole === 'admin') navigate('/admin');
      else if (userRole === 'teacher') navigate('/teacher');
      else if (userRole === 'student') navigate('/student');
    }
  }, [user, userRole, authLoading, navigate]);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!parentPhone || !password) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both parent phone number and password',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data: studentInfo, error: lookupError } = await supabase.rpc(
        'get_student_login_info',
        { parent_phone_input: parentPhone }
      );

      if (lookupError || !studentInfo || studentInfo.length === 0) {
        toast({
          title: 'Student Not Found',
          description: 'No student found with this parent phone number',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      const studentEmail = studentInfo[0].student_email;
      
      const { error: signInError } = await signIn(studentEmail, password);

      if (signInError) {
        toast({
          title: 'Login Failed',
          description: 'Invalid password. Please try again.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      toast({
        title: 'Login Successful',
        description: `Welcome ${studentInfo[0].student_name}!`,
      });
      
      navigate('/student');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Login failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="text-center mb-12 animate-in fade-in duration-700">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <GraduationCap className="w-16 h-16 text-primary" />
              <Sparkles className="w-6 h-6 text-secondary absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2">Buddha Deep English Boarding School</h1>
          <p className="text-xl text-muted-foreground">Sura School Portal</p>
          <p className="text-sm text-muted-foreground italic mt-2">"Empowering Minds, Building Futures"</p>
        </div>

        <div className="max-w-md mx-auto space-y-6">
          <Card className="p-8 animate-in slide-in-from-bottom duration-700 shadow-lg border-2">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Student Login</h2>
              <p className="text-sm text-muted-foreground mt-1">Login with your parent's phone number</p>
            </div>

            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <Label htmlFor="phone">Parent's Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter Phone Number"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                  <PasswordInput
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Logging in...' : 'Login as Student'}
              </Button>
            </form>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in duration-700 delay-300">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/auth/teacher')}
            >
              Teacher Login
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/auth/admin')}
            >
              Admin Login
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground animate-in fade-in duration-700 delay-500">
            <p>Need help? Contact your school administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
