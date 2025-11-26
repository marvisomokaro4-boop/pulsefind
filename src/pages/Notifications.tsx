import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Music2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  beat_id: string;
  match_id: string;
  notified_at: string;
  read: boolean;
  beat: {
    file_name: string;
  };
  match: {
    song_title: string;
    artist: string;
    album?: string;
    spotify_url?: string;
    apple_music_url?: string;
  };
}

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { plan } = useSubscription();
  const { toast } = useToast();

  // Check authentication first
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }
      
      setUser(user);
    };

    checkAuth();
  }, [navigate]);

  // Check subscription plan
  useEffect(() => {
    if (plan !== 'Pro') {
      navigate('/pricing');
      return;
    }
  }, [plan, navigate]);

  // Fetch notifications with explicit user_id filtering
  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('beat_notifications')
        .select(`
          *,
          beat:beats(file_name),
          match:beat_matches(song_title, artist, album, spotify_url, apple_music_url)
        `)
        .eq('user_id', user.id) // Explicit user_id filtering for security
        .order('notified_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch when user is available
  useEffect(() => {
    if (user && plan === 'Pro') {
      fetchNotifications();
    }
  }, [user, plan]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('beat_notifications_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'beat_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New notification received:', payload);
          
          // Fetch the full notification with related data
          supabase
            .from('beat_notifications')
            .select(`
              *,
              beat:beats(file_name),
              match:beat_matches(song_title, artist, album, spotify_url, apple_music_url)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                setNotifications(prev => [data, ...prev]);
                toast({
                  title: '🎵 New Beat Match!',
                  description: `A new song has been found using your beat "${data.beat.file_name}"`,
                });
              }
            });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'beat_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => (n.id === payload.new.id ? { ...n, ...payload.new } : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const markAsRead = async (id: string) => {
    if (!user) return;

    setMarkingAsRead(id);
    
    try {
      const { error } = await supabase
        .from('beat_notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id); // Additional security check

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );

      toast({
        title: 'Marked as read',
        description: 'Notification has been marked as read',
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive',
      });
    } finally {
      setMarkingAsRead(null);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Notifications</h1>
              <p className="text-muted-foreground">
                Track new songs using your beats
              </p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-lg px-4 py-2">
                {unreadCount} unread
              </Badge>
            )}
          </div>

          {notifications.length === 0 ? (
            <Card className="p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No notifications yet</h3>
              <p className="text-muted-foreground">
                You'll be notified when new songs use your beats
              </p>
              <Button onClick={() => navigate('/')} className="mt-6">
                Upload a Beat
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {notifications.map(notification => (
                <Card
                  key={notification.id}
                  className={`p-6 ${!notification.read ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Music2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">
                            New match for "{notification.beat.file_name}"
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(notification.notified_at).toLocaleDateString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsRead(notification.id)}
                            disabled={markingAsRead === notification.id}
                          >
                            {markingAsRead === notification.id ? (
                              <>Loading...</>
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Mark Read
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="bg-background/50 p-4 rounded-lg">
                        <p className="font-medium">
                          {notification.match.song_title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {notification.match.artist}
                          {notification.match.album && ` • ${notification.match.album}`}
                        </p>
                        <div className="flex gap-2 mt-3">
                          {notification.match.spotify_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(notification.match.spotify_url, '_blank')
                              }
                            >
                              <ExternalLink className="w-3 h-3 mr-2" />
                              Spotify
                            </Button>
                          )}
                          {notification.match.apple_music_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(notification.match.apple_music_url, '_blank')
                              }
                            >
                              <ExternalLink className="w-3 h-3 mr-2" />
                              Apple Music
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;