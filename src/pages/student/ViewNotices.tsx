import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Bell, Calendar } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { formatDualDate } from '@/lib/nepaliDate';

interface Notice {
  id: string;
  title: string;
  description: string;
  visible_to: string;
  created_at: string;
  expiry_date: string | null;
}

const ViewNotices = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!user || userRole !== 'student') {
      navigate('/auth/student');
      return;
    }
    fetchNotices();
  }, [user, userRole]);

  const fetchNotices = async () => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .or('visible_to.eq.all,visible_to.eq.student')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter out expired notices
      const activeNotices = (data || []).filter(notice => {
        if (!notice.expiry_date) return true;
        return new Date(notice.expiry_date) >= new Date();
      });
      
      setNotices(activeNotices);
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/student')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Notices</h1>
            <p className="text-muted-foreground text-sm">School announcements and updates</p>
          </div>
        </div>

        {selectedNotice ? (
          <Card className="p-6 animate-fade-in">
            <Button variant="ghost" onClick={() => setSelectedNotice(null)} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to List
            </Button>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{selectedNotice.title}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDualDate(selectedNotice.created_at).nepali}</span>
                  <span className="text-xs">({formatDualDate(selectedNotice.created_at).english})</span>
                </div>
              </div>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{selectedNotice.description}</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {notices.length === 0 ? (
              <Card className="p-12 text-center">
                <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Notices</h3>
                <p className="text-muted-foreground">There are no active notices at the moment.</p>
              </Card>
            ) : (
              notices.map((notice) => {
                const dates = formatDualDate(notice.created_at);
                return (
                  <Card
                    key={notice.id}
                    className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
                    onClick={() => setSelectedNotice(notice)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg truncate">{notice.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {notice.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                          <Calendar className="w-3 h-3" />
                          <span>{dates.nepali}</span>
                          <span>({dates.english})</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewNotices;
