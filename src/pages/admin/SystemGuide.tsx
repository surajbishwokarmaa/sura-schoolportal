import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, BookOpen, Edit2, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SystemGuide {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  created_by: string;
}

const SystemGuide = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [guide, setGuide] = useState<SystemGuide | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    } else if (user) {
      fetchGuide();
    }
  }, [user, loading, navigate]);

  const fetchGuide = async () => {
    const { data, error } = await supabase
      .from('system_guides')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      toast({
        title: 'Error',
        description: 'Failed to fetch system guide',
        variant: 'destructive'
      });
    } else if (data) {
      setGuide(data);
      setTitle(data.title);
      setContent(data.content);
    } else {
      // Create default guide if none exists
      if (userRole === 'admin') {
        createDefaultGuide();
      }
    }
  };

  const createDefaultGuide = async () => {
    const defaultContent = `# Welcome to Buddha Deep English Boarding School Management System

## For Administrators

### Getting Started
1. **Manage Classes**: Set up classes and sections for your school
2. **Add Teachers**: Create teacher accounts with assigned subjects and classes
3. **Add Students**: Manually add students or use bulk upload feature
4. **Manage Results**: Enter and publish student results

### Class & Section Management
- Navigate to "Manage Classes" from the dashboard
- Add classes (Nursery, LKG, UKG, Class 1-10)
- For each class, add sections (A, B, C, etc.)
- Edit or delete sections as needed

### Adding Students
**Manual Addition:**
1. Go to "Manage Students"
2. Click "Add Student"
3. Fill in required details (Name, Roll No, Class, Section, Phone, Photo)
4. System automatically creates login credentials
5. Photo is mandatory for all students

**Bulk Upload:**
1. Go to "Bulk Data Upload"
2. Download the Excel template
3. Fill in student details
4. Upload the completed Excel file
5. Review the upload report

### Adding Teachers
1. Navigate to "Manage Teachers"
2. Click "Add Teacher"
3. Enter teacher details (Name, Email, Phone, Subjects, Classes)
4. Upload teacher photo (mandatory)
5. System creates login credentials automatically

### Login Credentials
- **Students**: Can login with email or phone number
- **Teachers**: Can login with email or phone number
- Default password is provided during account creation
- Users should change password after first login

## For Teachers

### Accessing Your Account
1. Use email or phone number provided by admin
2. Enter your password
3. Access your teacher dashboard

### Managing Results
1. View assigned classes and students
2. Enter theory and practical marks
3. System automatically calculates grades and GPA
4. Save results and publish when ready

## For Students & Parents

### Accessing Results
1. Login with credentials provided by school
2. View your academic results
3. Check notices and announcements
4. Parents can login with registered phone number

## Need Help?
Contact school administrator for any assistance.`;

    const { data, error } = await supabase
      .from('system_guides')
      .insert({
        title: 'System User Guide',
        content: defaultContent,
        created_by: user?.id || ''
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create default guide',
        variant: 'destructive'
      });
    } else {
      setGuide(data);
      setTitle(data.title);
      setContent(data.content);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and content are required',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);

    if (guide) {
      const { error } = await supabase
        .from('system_guides')
        .update({
          title,
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', guide.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update guide',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'System guide updated successfully'
        });
        setIsEditing(false);
        fetchGuide();
      }
    } else {
      const { error } = await supabase
        .from('system_guides')
        .insert({
          title,
          content,
          created_by: user?.id || ''
        });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to create guide',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'System guide created successfully'
        });
        setIsEditing(false);
        fetchGuide();
      }
    }

    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(userRole === 'admin' ? '/admin' : '/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">System Guide</h1>
              <p className="text-muted-foreground">User documentation and help</p>
            </div>
          </div>
          {userRole === 'admin' && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setTitle(guide?.title || '');
                    setContent(guide?.content || '');
                  }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Guide
                </Button>
              )}
            </div>
          )}
        </div>

        <Card className="p-8">
          {isEditing ? (
            <div className="space-y-6">
              <div>
                <Label htmlFor="title">Guide Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter guide title"
                />
              </div>
              <div>
                <Label htmlFor="content">Content (Markdown supported)</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter guide content in markdown format"
                  className="min-h-[500px] font-mono"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use markdown formatting: # for headers, ** for bold, * for italic, - for lists
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-6">{title || 'System Guide'}</h2>
              <div className="prose max-w-none dark:prose-invert">
                {content.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={idx} className="text-3xl font-bold mt-8 mb-4">{line.substring(2)}</h1>;
                  } else if (line.startsWith('## ')) {
                    return <h2 key={idx} className="text-2xl font-bold mt-6 mb-3">{line.substring(3)}</h2>;
                  } else if (line.startsWith('### ')) {
                    return <h3 key={idx} className="text-xl font-bold mt-4 mb-2">{line.substring(4)}</h3>;
                  } else if (line.startsWith('- ')) {
                    return <li key={idx} className="ml-6">{line.substring(2)}</li>;
                  } else if (line.match(/^\d+\. /)) {
                    return <li key={idx} className="ml-6 list-decimal">{line.substring(line.indexOf(' ') + 1)}</li>;
                  } else if (line.includes('**')) {
                    const parts = line.split('**');
                    return (
                      <p key={idx} className="mb-2">
                        {parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                      </p>
                    );
                  } else if (line.trim() === '') {
                    return <br key={idx} />;
                  } else {
                    return <p key={idx} className="mb-2">{line}</p>;
                  }
                })}
              </div>
            </div>
          )}
        </Card>

        {!guide && !isEditing && userRole !== 'admin' && (
          <Card className="p-12 text-center mt-8">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Guide Available</h3>
            <p className="text-muted-foreground">
              System guide has not been set up yet. Please contact the administrator.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SystemGuide;