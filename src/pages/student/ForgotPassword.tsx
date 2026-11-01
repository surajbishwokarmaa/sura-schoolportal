import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, User, Hash, BookOpen, Phone, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  studentName: z.string().trim().min(1, 'Student name is required').max(100),
  rollNo: z.string().trim().min(1, 'Roll number is required').max(20),
  className: z.string().trim().min(1, 'Class is required').max(50),
  parentPhone: z.string().trim().min(10, 'Valid phone number is required').max(15),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  message: z.string().max(500).optional(),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [who, setWho] = useState<'student' | 'teacher'>('student');
  
  const [formData, setFormData] = useState({
    studentName: '',
    rollNo: '',
    className: '',
    parentPhone: '',
    email: '',
    message: 'Forgot password request',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = who === 'teacher' ? { ...formData, rollNo: '-', className: 'Teacher' } : formData;
    const validation = forgotPasswordSchema.safeParse(data);
    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('password_reset_requests')
        .insert({
          student_name: formData.studentName.trim(),
          roll_no: data.rollNo.trim(),
          class: data.className.trim(),
          parent_phone: formData.parentPhone.trim(),
          email: formData.email.trim() || null,
          message: (who === 'teacher' ? '[TEACHER] ' : '') + (formData.message.trim() || 'Forgot password request'),
        });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: 'Request Submitted',
        description: 'Your password reset request has been sent to the admin.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Your password reset request has been sent to the school administrator. 
            They will contact you with your new password.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </Button>

        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Forgot Password</h1>
            <p className="text-muted-foreground mt-2">
              Students, parents and teachers: submit your details and the admin will provide you with a new password
            </p>
          </div>

          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
                {(['student', 'teacher'] as const).map(r => (
                  <Button key={r} type="button" size="sm" variant={who === r ? 'default' : 'ghost'} onClick={() => setWho(r)}>
                    {r === 'student' ? 'I am a Student / Parent' : 'I am a Teacher'}
                  </Button>
                ))}
              </div>
              <div>
                <Label htmlFor="studentName">{who === 'teacher' ? 'Teacher Full Name *' : 'Student Name *'}</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="studentName"
                    placeholder="Enter student's full name"
                    value={formData.studentName}
                    onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {who === 'student' && <>
              <div>
                <Label htmlFor="rollNo">Roll Number *</Label>
                <div className="relative mt-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rollNo"
                    placeholder="Enter roll number"
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="className">Class *</Label>
                <div className="relative mt-1">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="className"
                    placeholder="e.g., Grade 5, Class 10"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              </>}
              <div>
                <Label htmlFor="parentPhone">Registered Mobile Number *</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="parentPhone"
                    type="tel"
                    placeholder={who === 'teacher' ? 'Your login phone number' : "Parent's phone number"}
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Email address if available"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <div className="relative mt-1">
                  <Textarea
                    id="message"
                    placeholder="Additional information..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={3}
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;