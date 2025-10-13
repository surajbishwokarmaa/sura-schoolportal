import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const AdminAuth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid admin credentials.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Admin Access Granted",
        description: "Welcome to the admin dashboard.",
      });
      navigate('/admin');
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
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Administrator Login</h1>
            <p className="text-muted-foreground">Full system access and management</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Admin Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@school.edu.np"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Authenticating..." : "Access Admin Panel"}
              </Button>

              <div className="bg-muted/50 p-4 rounded-lg mt-6">
                <p className="text-sm font-medium mb-2">Default Admin Credentials:</p>
                <p className="text-xs text-muted-foreground">Email: infosurajbishwokarma@gmail.com</p>
                <p className="text-xs text-muted-foreground">Password: 12345678</p>
                <p className="text-xs text-destructive mt-2">⚠️ Change these credentials after first login</p>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
