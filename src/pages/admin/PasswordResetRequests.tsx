import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, KeyRound, Check, X, Clock, User, Phone, BookOpen, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface PasswordRequest {
  id: string;
  student_name: string;
  roll_no: string;
  class: string;
  parent_phone: string;
  email: string | null;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const PasswordResetRequests = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PasswordRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth/admin');
    } else if (user && userRole === 'admin') {
      fetchRequests();
    }
  }, [user, userRole, loading, navigate]);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch requests',
        variant: 'destructive',
      });
    } else {
      setRequests(data || []);
    }
  };

  const handleResolve = async (status: 'resolved' | 'rejected') => {
    if (!selectedRequest) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('password_reset_requests')
        .update({
          status,
          admin_notes: adminNotes,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Request marked as ${status}`,
      });
      
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'resolved':
        return <Badge variant="default" className="bg-green-600"><Check className="w-3 h-3 mr-1" /> Resolved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

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
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Password Reset Requests
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount} pending</Badge>
              )}
            </h1>
            <p className="text-muted-foreground">Review and resolve student password reset requests</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <Card className="p-12 text-center">
            <KeyRound className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Requests</h3>
            <p className="text-muted-foreground">
              There are no password reset requests at this time.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <Card key={request.id} className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {request.student_name}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Roll: {request.roll_no}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> {request.class}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {request.parent_phone}
                      </span>
                    </div>
                    {request.message && request.message !== 'Forgot password request' && (
                      <p className="text-sm italic">"{request.message}"</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Submitted: {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                  
                  {request.status === 'pending' && (
                    <Button 
                      onClick={() => {
                        setSelectedRequest(request);
                        setAdminNotes('');
                      }}
                    >
                      Review
                    </Button>
                  )}
                  
                  {request.admin_notes && (
                    <div className="text-sm">
                      <span className="font-medium">Admin Notes:</span>
                      <p className="text-muted-foreground">{request.admin_notes}</p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Password Reset Request</DialogTitle>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Student:</span>
                    <p>{selectedRequest.student_name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Roll No:</span>
                    <p>{selectedRequest.roll_no}</p>
                  </div>
                  <div>
                    <span className="font-medium">Class:</span>
                    <p>{selectedRequest.class}</p>
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>
                    <p>{selectedRequest.parent_phone}</p>
                  </div>
                  {selectedRequest.email && (
                    <div className="col-span-2">
                      <span className="font-medium">Email:</span>
                      <p>{selectedRequest.email}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium">Admin Notes (e.g., new password provided)</label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter notes about this request..."
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            
            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                onClick={() => handleResolve('rejected')}
                disabled={processing}
              >
                <X className="w-4 h-4 mr-1" /> Reject
              </Button>
              <Button
                onClick={() => handleResolve('resolved')}
                disabled={processing}
              >
                <Check className="w-4 h-4 mr-1" /> Mark Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PasswordResetRequests;