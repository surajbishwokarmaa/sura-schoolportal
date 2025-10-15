import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AdminSetup = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const setupAdmin = async () => {
    setLoading(true);

    const adminEmail = 'infosurajbishwokarma@gmail.com';
    const adminPassword = '12345678';

    try {
      // Create the admin user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: {
            full_name: 'System Administrator',
            role: 'admin'
          }
        }
      });

      if (signUpError) {
        toast({
          title: "Setup Failed",
          description: signUpError.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: "Admin Account Created",
        description: "You can now log in with the admin credentials.",
      });

      navigate('/auth/admin');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
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
            <h1 className="text-3xl font-bold">Admin Setup</h1>
            <p className="text-muted-foreground">One-time administrator account creation</p>
          </div>

          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  This will create the system administrator account with the following credentials:
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-1 text-left">
                  <p className="text-sm"><strong>Email:</strong> infosurajbishwokarma@gmail.com</p>
                  <p className="text-sm"><strong>Password:</strong> 12345678</p>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  This page will only work once. If the admin already exists, use the login page.
                </p>
              </div>

              <Button 
                onClick={setupAdmin} 
                className="w-full" 
                size="lg" 
                disabled={loading}
              >
                {loading ? "Creating Admin Account..." : "Create Admin Account"}
              </Button>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => navigate('/auth/admin')}
                >
                  Already have an admin account? Login here
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;
