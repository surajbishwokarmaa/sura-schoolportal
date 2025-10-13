import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Phone, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const StudentAuth = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // For phone login, we'll use phone as email temporarily
    // In production, you'd handle this differently
    const email = `${phone}@student.local`;
    
    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please check your phone number and password.",
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
