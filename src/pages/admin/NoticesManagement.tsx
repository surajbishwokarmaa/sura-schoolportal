import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2, ArrowLeft, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Notice {
  id: string;
  title: string;
  description: string;
  visible_to: string;
  expiry_date: string | null;
  created_at: string;
  is_auto_generated: boolean;
}

const NoticesManagement = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    visible_to: 'all',
    expiry_date: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchNotices();
    }
  }, [user, userRole, loading, navigate]);

  const fetchNotices = async () => {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch notices',
        variant: 'destructive'
      });
    } else {
      setNotices(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (editingNotice) {
      const { error } = await supabase
        .from('notices')
        .update({
          title: formData.title,
          description: formData.description,
          visible_to: formData.visible_to,
          expiry_date: formData.expiry_date || null
        })
        .eq('id', editingNotice.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update notice',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Notice updated successfully'
        });
        fetchNotices();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('notices')
        .insert({
          title: formData.title,
          description: formData.description,
          visible_to: formData.visible_to,
          expiry_date: formData.expiry_date || null,
          created_by: user?.id
        });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to create notice',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Notice created successfully'
        });
        fetchNotices();
        resetForm();
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      description: notice.description,
      visible_to: notice.visible_to,
      expiry_date: notice.expiry_date || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) {
      return;
    }

    const { error } = await supabase
      .from('notices')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete notice',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Notice deleted successfully'
      });
      fetchNotices();
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      visible_to: 'all',
      expiry_date: ''
    });
    setEditingNotice(null);
    setIsDialogOpen(false);
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
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Notices Management</h1>
              <p className="text-muted-foreground">Create and manage school notices</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Notice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingNotice ? 'Edit Notice' : 'Add New Notice'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={5}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="visible_to">Visible To</Label>
                  <Select
                    value={formData.visible_to}
                    onValueChange={(value) => setFormData({...formData, visible_to: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All (Students & Teachers)</SelectItem>
                      <SelectItem value="student">Students Only</SelectItem>
                      <SelectItem value="teacher">Teachers Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : editingNotice ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {notices.map((notice) => (
            <Card key={notice.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <h3 className="text-xl font-bold">{notice.title}</h3>
                    {notice.is_auto_generated && (
                      <Badge variant="secondary">Auto-generated</Badge>
                    )}
                    <Badge variant="outline">{notice.visible_to}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-2">{notice.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Created: {new Date(notice.created_at).toLocaleDateString()}</span>
                    {notice.expiry_date && (
                      <span>Expires: {new Date(notice.expiry_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(notice)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(notice.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {notices.length === 0 && (
          <Card className="p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Notices Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first notice to the system
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Notice
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NoticesManagement;
