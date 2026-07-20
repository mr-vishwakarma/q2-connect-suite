import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { useEffect, useState, useCallback } from 'react';
import { useHostel } from '@/contexts/HostelContext';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { io } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Bell, Plus, Trash2, Send, Users, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface Student {
  id: string;
  name: string;
  username: string;
  user_id: string;
}

export default function Notifications() {
  const { selectedHostel } = useHostel();
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'info',
    recipient: 'all',
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications', { params: { hostel: selectedHostel } });
      if (response.data?.success) {
        const formatted = response.data.data.map((n: any) => ({
          id: n._id,
          user_id: n.userId?._id,
          hostel: n.hostel,
          title: n.title,
          message: n.message,
          type: n.type,
          is_read: n.isRead,
          created_at: n.createdAt,
        }));
        setNotifications(formatted);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHostel]);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await api.get('/students', { params: { hostel: selectedHostel } });
      setStudents(response.data?.data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setStudents([]);
    }
  }, [selectedHostel]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchNotifications();
      fetchStudents();
    }
  }, [user, isAdmin, selectedHostel, fetchNotifications, fetchStudents]);

  // Real-time updates
  useEffect(() => {
    if (!user || !isAdmin) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', { withCredentials: true });
    
    socket.on('notifications-updated', fetchNotifications);

    return () => { socket.disconnect(); };
  }, [user, isAdmin, selectedHostel, fetchNotifications]);

  const handleSendNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await api.post('/notifications/broadcast', {
        title: newNotification.title,
        message: newNotification.message,
        type: newNotification.type,
        hostel: selectedHostel,
        recipient: newNotification.recipient
      });

      toast.success('Notification sent successfully');
      setShowSendDialog(false);
      setNewNotification({ title: '', message: '', type: 'info', recipient: 'all' });
      fetchNotifications();
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'warning':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Warning</Badge>;
      case 'success':
        return <Badge className="bg-success/10 text-success border-success/20">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Bell className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold text-foreground">{notifications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Bell className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unread</p>
                  <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-success/10">
                  <Users className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Students</p>
                  <p className="text-2xl font-bold text-foreground">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={() => setShowSendDialog(true)}>
            <Send className="w-4 h-4 mr-2" />
            Send Notification
          </Button>
        </div>

        {/* Notifications Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Sent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8"><InlineSkeletonList rows={5} /></div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notifications sent yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell>{getTypeBadge(notification.type)}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(notification.type)}
                            {notification.title}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{notification.message}</TableCell>
                        <TableCell>
                          <Badge variant={notification.is_read ? 'secondary' : 'default'}>
                            {notification.is_read ? 'Read' : 'Unread'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteNotification(notification.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Send Notification Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Recipient</Label>
              <Select
                value={newNotification.recipient}
                onValueChange={(v) => setNewNotification({ ...newNotification, recipient: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} ({student.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={newNotification.type}
                onValueChange={(v) => setNewNotification({ ...newNotification, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={newNotification.title}
                onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={newNotification.message}
                onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                placeholder="Type your message here..."
                rows={4}
              />
            </div>
            <Button className="w-full" onClick={handleSendNotification}>
              <Send className="w-4 h-4 mr-2" />
              Send Notification
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
