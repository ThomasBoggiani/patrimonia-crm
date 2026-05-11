'use client';
import React, { useState, useEffect } from 'react';
import { Bell, X, CheckSquare, Building2, Users, Check, FileQuestion, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const channelName = `notifications-${user.id}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { loadNotifications(); }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime notifications channel error:', status);
        }
      });

    return () => {
      try { supabase.removeChannel(channel); } catch (e) {}
    };
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('notifications')
      .select('*, created_by_profile:profiles!notifications_created_by_fkey(prenom, nom)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data || []);
    setLoading(false);
  }

  const unreadCount = notifications.filter(n => !n.lue).length;

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ lue: true }).eq('id', id);
    loadNotifications();
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ lue: true }).eq('user_id', user.id).eq('lue', false);
    loadNotifications();
  };

  // Clic sur notif : marque comme lue + dispatch event pour ouvrir la ressource
  const handleNotifClick = async (n) => {
    await markAsRead(n.id);
    setOpen(false);

    // Cas spécial : notif matching_batch → ouvre directement la modal email drafts
    if (n.type === 'matching_batch' && n.lien_type === 'mandat' && n.lien_id) {
      window.dispatchEvent(new CustomEvent('crm:openEmailDrafts', { detail: { mandatId: n.lien_id } }));
      return;
    }

    if (n.lien_type === 'mandat' && n.lien_id) {
      window.dispatchEvent(new CustomEvent('crm:openMandat', { detail: { mandatId: n.lien_id } }));
    } else if (n.lien_type === 'client' && n.lien_id) {
      window.dispatchEvent(new CustomEvent('crm:openClient', { detail: { clientId: n.lien_id } }));
    }
  };

    if (n.lien_type === 'mandat' && n.lien_id) {
      window.dispatchEvent(new CustomEvent('crm:openMandat', { detail: { mandatId: n.lien_id } }));
    } else if (n.lien_type === 'client' && n.lien_id) {
      window.dispatchEvent(new CustomEvent('crm:openClient', { detail: { clientId: n.lien_id } }));
    }
  };

  const formatTime = (ts) => {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000 / 60;
    if (diff < 1) return "À l'instant";
    if (diff < 60) return `Il y a ${Math.floor(diff)} min`;
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)}h`;
    return `Il y a ${Math.floor(diff / 1440)}j`;
  };

  const iconForType = (type) => {
    if (type === 'task_assigned') return CheckSquare;
    if (type === 'questionnaire_response') return FileQuestion;
    if (type === 'client_assigned') return Users;
    if (type === 'mandat_assigned') return Building2;
    if (type === 'matching_batch') return Target;
    return Bell;
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-cream-100 text-ink/70 hover:text-ink">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-full bottom-0 ml-2 w-96 bg-white border border-cream-dark rounded-xl shadow-luxe-hover z-50 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-cream-dark">
              <div className="font-display font-semibold text-ink">Notifications</div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-sage-dark hover:underline">
                  Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="text-center py-6 text-xs text-ink/60">Chargement&hellip;</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Bell className="w-8 h-8 text-cream-300 mx-auto mb-2" />
                  <p className="text-xs text-ink/60">Aucune notification</p>
                </div>
              ) : (
                notifications.map(n => {
                  const Icon = iconForType(n.type);
                  const author = n.created_by_profile ? `${n.created_by_profile.prenom} ${n.created_by_profile.nom}` : null;
                  const isClickable = n.lien_id && n.lien_type;
                  return (
                    <div key={n.id} onClick={() => handleNotifClick(n)}
                      className={`p-3 border-b border-cream cursor-pointer hover:bg-cream-50 ${!n.lue ? 'bg-sage-50/50' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${!n.lue ? 'bg-sage-100 text-sage-darker' : 'bg-cream-100 text-ink/60'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs ${!n.lue ? 'font-medium text-ink' : 'text-ink/80'}`}>
                            {n.titre}
                          </div>
                          {n.message && (
                            <div className="text-[11px] text-ink/60 mt-0.5 line-clamp-2">{n.message}</div>
                          )}
                          <div className="text-[10px] text-ink/50 mt-1 flex items-center gap-1.5">
                            {author && <span>Par {author}</span>}
                            {author && <span>&middot;</span>}
                            <span>{formatTime(n.created_at)}</span>
                            {isClickable && <span className="text-sage-dark">&middot; Cliquer pour ouvrir</span>}
                          </div>
                        </div>
                        {!n.lue && <div className="w-2 h-2 bg-sage rounded-full flex-shrink-0 mt-1" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
