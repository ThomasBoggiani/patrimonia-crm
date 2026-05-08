'use client';
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users as UsersIcon, Plus, Trash2, Edit2, Repeat, ExternalLink, Loader2, AlertCircle, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, getCurrentUserName } from '@/lib/auth';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Palette de couleurs pour les agendas (sage = moi, le reste = collègues)
const COLLEAGUE_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', dot: 'bg-blue-500', solid: 'bg-blue-500' },
  { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-900', dot: 'bg-purple-500', solid: 'bg-purple-500' },
  { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900', dot: 'bg-orange-500', solid: 'bg-orange-500' },
  { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-900', dot: 'bg-pink-500', solid: 'bg-pink-500' },
  { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-900', dot: 'bg-teal-500', solid: 'bg-teal-500' }
];
const ME_COLOR = { bg: 'bg-sage-50', border: 'border-sage-light', text: 'text-sage-darker', dot: 'bg-sage', solid: 'bg-sage-dark' };

export default function AgendaTab() {
  const { user, profile } = useAuth();
  const [view, setView] = useState('week');
  const [myEvents, setMyEvents] = useState([]);
  const [colleagueEvents, setColleagueEvents] = useState({}); // { email: events[] }
  const [recurrents, setRecurrents] = useState([]);
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleagues, setSelectedColleagues] = useState([]); // emails
  const [loading, setLoading] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(null);
  const [error, setError] = useState(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [editingRec, setEditingRec] = useState(null);
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    if (day !== 1) d.setHours(-24 * (day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    if (!user) return;
    checkOutlookConnection();
    loadRecurrents();
    loadColleagues();
  }, [user]);

  useEffect(() => {
    if (outlookConnected) {
      loadMyEvents();
      loadAllColleagueEvents();
    }
  }, [outlookConnected, currentWeekStart]);

  useEffect(() => {
    if (outlookConnected) loadAllColleagueEvents();
  }, [selectedColleagues]);

  async function checkOutlookConnection() {
    const { data } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();
    setOutlookConnected(!!data);
  }

  async function loadRecurrents() {
    const { data } = await supabase.from('evenements_recurrents').select('*').eq('actif', true);
    setRecurrents(data || []);
  }

  async function loadColleagues() {
    // Tous les profils actifs sauf moi
    const { data } = await supabase
      .from('profiles')
      .select('id, email, prenom, nom')
      .eq('actif', true)
      .neq('id', user.id);
    setColleagues(data || []);
  }

  async function loadMyEvents() {
    if (!outlookConnected) return;
    setLoading(true);
    setError(null);
    try {
      const start = new Date(currentWeekStart);
      const end = new Date(currentWeekStart);
      end.setDate(end.getDate() + 7);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/microsoft/events?start=${start.toISOString()}&end=${end.toISOString()}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur de chargement');
      }
      const { events } = await res.json();
      setMyEvents(events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllColleagueEvents() {
    if (selectedColleagues.length === 0) {
      setColleagueEvents({});
      return;
    }
    
    const start = new Date(currentWeekStart);
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 7);
    
    const { data: { session } } = await supabase.auth.getSession();
    const newEvents = {};
    
    await Promise.all(selectedColleagues.map(async (email) => {
      try {
        const res = await fetch(
          `/api/microsoft/colleague-events?email=${encodeURIComponent(email)}&start=${start.toISOString()}&end=${end.toISOString()}`,
          { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          const { events } = await res.json();
          newEvents[email] = events || [];
        } else {
          newEvents[email] = [];
        }
      } catch {
        newEvents[email] = [];
      }
    }));
    
    setColleagueEvents(newEvents);
  }

  const toggleColleague = (email) => {
    setSelectedColleagues(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const goToWeek = (offset) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + offset * 7);
    setCurrentWeekStart(d);
  };
  const goToToday = () => {
    const d = new Date();
    const day = d.getDay() || 7;
    if (day !== 1) d.setHours(-24 * (day - 1));
    d.setHours(0, 0, 0, 0);
    setCurrentWeekStart(d);
  };

  // Couleur attribuée à un collègue (par index dans la liste)
  const getColleagueColor = (email) => {
    const idx = colleagues.findIndex(c => c.email === email);
    return COLLEAGUE_COLORS[idx % COLLEAGUE_COLORS.length] || COLLEAGUE_COLORS[0];
  };

  // Construire la liste des évents par jour pour tous (moi + collègues sélectionnés)
  const eventsByDay = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    eventsByDay[key] = [];
  }
  
  // Mes events
  myEvents.forEach(ev => {
    const dateKey = ev.start.dateTime.split('T')[0];
    if (eventsByDay[dateKey]) {
      eventsByDay[dateKey].push({ ...ev, _owner: 'me', _color: ME_COLOR });
    }
  });
  
  // Events des collègues
  Object.entries(colleagueEvents).forEach(([email, events]) => {
    const colleague = colleagues.find(c => c.email === email);
    if (!colleague) return;
    const color = getColleagueColor(email);
    events.forEach(ev => {
      const dateKey = ev.start.dateTime.split('T')[0];
      if (eventsByDay[dateKey]) {
        eventsByDay[dateKey].push({ 
          ...ev, 
          _owner: 'colleague',
          _ownerName: `${colleague.prenom} ${colleague.nom}`,
          _ownerInitials: `${colleague.prenom[0]}${colleague.nom[0]}`,
          _color: color
        });
      }
    });
  });
  
  // Trier chaque jour par heure
  Object.keys(eventsByDay).forEach(key => {
    eventsByDay[key].sort((a, b) => 
      new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
    );
  });

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const weekLabel = (() => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    return `${currentWeekStart.getDate()} ${MOIS[currentWeekStart.getMonth()]} — ${end.getDate()} ${MOIS[end.getMonth()]} ${end.getFullYear()}`;
  })();

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-1">Agenda</h1>
        <p className="text-sage-dark text-sm md:text-base">Vos événements Outlook et ceux de l'équipe</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setView('week')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'week' ? 'bg-ink-deep text-white' : 'bg-white border border-cream-dark text-ink hover:bg-cream-50'}`}>
          <Calendar className="w-4 h-4 inline mr-1.5" /> Semaine
        </button>
        <button onClick={() => setView('recurrents')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'recurrents' ? 'bg-ink-deep text-white' : 'bg-white border border-cream-dark text-ink hover:bg-cream-50'}`}>
          <Repeat className="w-4 h-4 inline mr-1.5" /> Récurrents ({recurrents.length})
        </button>
        {view === 'week' && outlookConnected && (
          <button onClick={() => setShowNewEvent(true)}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nouveau RDV
          </button>
        )}
        {view === 'recurrents' && (
          <button onClick={() => setEditingRec({})}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nouvel événement récurrent
          </button>
        )}
      </div>

      {view === 'week' && (
        <>
          {outlookConnected === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-amber-900 mb-1">Outlook non connecté</div>
                  <p className="text-sm text-amber-800">
                    Pour voir votre agenda Outlook ici, allez dans l'onglet "Intégrations" et connectez votre compte Microsoft 365.
                  </p>
                </div>
              </div>
            </div>
          )}

          {outlookConnected && (
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
              {/* Sidebar : sélection des agendas à afficher */}
              <aside className="bg-white border border-cream-dark rounded-lg p-3 h-fit">
                <div className="text-xs uppercase tracking-wide text-sage-dark font-medium mb-3">
                  Agendas affichés
                </div>
                
                {/* Mon agenda (toujours coché) */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-2">
                  <div className={`w-3 h-3 rounded-sm ${ME_COLOR.solid}`} />
                  <span className="text-sm font-medium text-ink">Moi</span>
                </div>
                
                {/* Collègues */}
                {colleagues.length === 0 ? (
                  <div className="text-xs text-ink/50 italic">Aucun collègue</div>
                ) : (
                  <>
                    <div className="text-[10px] uppercase tracking-wide text-ink/50 mt-3 mb-1">
                      Mes collègues
                    </div>
                    {colleagues.map(c => {
                      const checked = selectedColleagues.includes(c.email);
                      const color = getColleagueColor(c.email);
                      return (
                        <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-50 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColleague(c.email)}
                            className="rounded border-cream-dark"
                          />
                          <div className={`w-3 h-3 rounded-sm ${color.solid}`} />
                          <span className="text-sm text-ink">{c.prenom}</span>
                        </label>
                      );
                    })}
                    
                    <div className="flex gap-2 mt-3 pt-3 border-t border-cream">
                      <button 
                        onClick={() => setSelectedColleagues(colleagues.map(c => c.email))}
                        className="text-[10px] text-sage-dark hover:underline flex-1"
                      >
                        Tout afficher
                      </button>
                      <button 
                        onClick={() => setSelectedColleagues([])}
                        className="text-[10px] text-ink/60 hover:underline flex-1"
                      >
                        Personne
                      </button>
                    </div>
                  </>
                )}
              </aside>

              {/* Zone principale : agenda */}
              <div>
                <div className="flex items-center justify-between bg-white border border-cream-dark rounded-lg p-3 mb-4">
                  <div className="flex gap-1">
                    <button onClick={() => goToWeek(-1)} className="px-3 py-1 hover:bg-cream-100 rounded text-sm">← Précédent</button>
                    <button onClick={goToToday} className="px-3 py-1 hover:bg-cream-100 rounded text-sm font-medium text-sage-dark">Aujourd'hui</button>
                    <button onClick={() => goToWeek(1)} className="px-3 py-1 hover:bg-cream-100 rounded text-sm">Suivant →</button>
                  </div>
                  <div className="text-sm font-medium text-ink hidden sm:block">{weekLabel}</div>
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-sage" />}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
                  </div>
                )}

                {/* Vue desktop : grille 7 colonnes */}
                <div className="hidden md:grid md:grid-cols-7 gap-2">
                  {Object.entries(eventsByDay).map(([dateKey, events]) => {
                    const date = new Date(dateKey);
                    const isToday = dateKey === new Date().toISOString().split('T')[0];
                    return (
                      <div key={dateKey} className={`bg-white border rounded-lg p-2 min-h-[150px] ${isToday ? 'border-sage ring-2 ring-sage/20' : 'border-cream-dark'}`}>
                        <div className="mb-2 pb-2 border-b border-cream">
                          <div className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-sage-dark' : 'text-ink/60'}`}>
                            {JOURS[date.getDay()]}
                          </div>
                          <div className="text-base font-display font-semibold text-ink">{date.getDate()}</div>
                        </div>
                        <div className="space-y-1">
                          {events.length === 0 ? (
                            <div className="text-[10px] text-ink/40 italic">—</div>
                          ) : events.map((ev, i) => (
                            <EventCard
                              key={`${ev._owner}-${ev.id}-${i}`}
                              event={ev}
                              formatTime={formatTime}
                              onDelete={loadMyEvents}
                              onUpdate={loadMyEvents}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vue mobile : liste verticale, jours seulement non-vides */}
                <div className="md:hidden space-y-3">
                  {Object.entries(eventsByDay).map(([dateKey, events]) => {
                    const date = new Date(dateKey);
                    const isToday = dateKey === new Date().toISOString().split('T')[0];
                    if (events.length === 0 && !isToday) return null;
                    return (
                      <div key={dateKey} className={`bg-white border rounded-lg p-3 ${isToday ? 'border-sage ring-2 ring-sage/20' : 'border-cream-dark'}`}>
                        <div className="flex items-baseline gap-2 mb-2 pb-2 border-b border-cream">
                          <div className={`text-base font-display font-semibold ${isToday ? 'text-sage-dark' : 'text-ink'}`}>
                            {JOURS[date.getDay()]} {date.getDate()}
                          </div>
                          {isToday && <span className="text-xs text-sage-dark font-medium">Aujourd'hui</span>}
                          <span className="ml-auto text-xs text-ink/40">{events.length} évt{events.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="space-y-1.5">
                          {events.length === 0 ? (
                            <div className="text-xs text-ink/40 italic py-2">Aucun événement</div>
                          ) : events.map((ev, i) => (
                            <EventCard
                              key={`${ev._owner}-${ev.id}-${i}`}
                              event={ev}
                              formatTime={formatTime}
                              onDelete={loadMyEvents}
                              onUpdate={loadMyEvents}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {Object.values(eventsByDay).every(evts => evts.length === 0) && (
                    <div className="bg-white border border-cream-dark rounded-lg p-12 text-center">
                      <Calendar className="w-10 h-10 text-cream-300 mx-auto mb-3" />
                      <p className="text-sm text-ink/60">Aucun événement cette semaine</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'recurrents' && (
        <RecurrentList recurrents={recurrents} onEdit={setEditingRec} reload={loadRecurrents} />
      )}

      {showNewEvent && (
        <NewEventModal onClose={() => setShowNewEvent(false)} onCreated={() => { setShowNewEvent(false); loadMyEvents(); }} />
      )}
      
      {editingRec && (
        <RecurrentForm rec={editingRec} onClose={() => setEditingRec(null)} onSaved={() => { setEditingRec(null); loadRecurrents(); }} />
      )}
    </div>
  );
}

function EventCard({ event, formatTime, onDelete }) {
  const [showActions, setShowActions] = useState(false);
  const isMine = event._owner === 'me';
  const color = event._color;

  const handleDelete = async () => {
    if (!confirm(`Supprimer "${event.subject}" de votre agenda Outlook ?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/microsoft/events/${event.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      onDelete();
    } catch (err) {
      alert('Erreur lors de la suppression');
    }
  };

  return (
    <div 
      className={`group ${color.bg} border ${color.border} rounded-md px-1.5 py-1 text-xs cursor-pointer hover:opacity-90 relative`}
      onClick={() => isMine && setShowActions(!showActions)}
    >
      <div className="flex items-start gap-1">
        {!isMine && (
          <div className={`w-1.5 h-1.5 rounded-full ${color.solid} mt-1 flex-shrink-0`} 
               title={event._ownerName} />
        )}
        <div className="flex-1 min-w-0">
          {!event.isAllDay && (
            <div className={`font-medium ${color.text} text-[10px]`}>
              {formatTime(event.start.dateTime)}
              {!isMine && <span className="ml-1 opacity-70">· {event._ownerInitials}</span>}
            </div>
          )}
          <div className={`font-medium ${color.text} line-clamp-2 leading-tight text-[11px]`}>
            {event.subject || '(Sans titre)'}
          </div>
          {event.location?.displayName && (
            <div className="text-[9px] text-ink/60 mt-0.5 truncate">📍 {event.location.displayName}</div>
          )}
        </div>
      </div>
      
      {isMine && showActions && (
        <div className="absolute top-1 right-1 flex gap-1 bg-white rounded shadow p-1 z-10" onClick={e => e.stopPropagation()}>
          {event.webLink && (
            <a href={event.webLink} target="_blank" rel="noopener" className="p-1 hover:bg-cream-100 rounded" title="Ouvrir dans Outlook">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button onClick={handleDelete} className="p-1 hover:bg-red-50 hover:text-red-600 rounded" title="Supprimer">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function NewEventModal({ onClose, onCreated }) {
  const [titre, setTitre] = useState('');
  const [debut, setDebut] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [fin, setFin] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [lieu, setLieu] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/microsoft/events', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          titre,
          description,
          debut: new Date(debut).toISOString(),
          fin: new Date(fin).toISOString(),
          lieu,
          participants: participants.split(',').map(s => s.trim()).filter(Boolean)
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <h2 className="font-display text-xl font-semibold text-ink">Nouveau rendez-vous</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        
        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-ink/70 block mb-1">Titre *</label>
            <input type="text" value={titre} onChange={e => setTitre(e.target.value)} required autoFocus
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink/70 block mb-1">Début *</label>
              <input type="datetime-local" value={debut} onChange={e => setDebut(e.target.value)} required
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-ink/70 block mb-1">Fin *</label>
              <input type="datetime-local" value={fin} onChange={e => setFin(e.target.value)} required
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Lieu</label>
            <input type="text" value={lieu} onChange={e => setLieu(e.target.value)}
              placeholder="Adresse ou lien Teams"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Participants (emails séparés par virgule)</label>
            <input type="text" value={participants} onChange={e => setParticipants(e.target.value)}
              placeholder="lucas@..., philippe@..."
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50 flex items-center gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Créer dans Outlook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecurrentList({ recurrents, onEdit, reload }) {
  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet événement récurrent ?')) return;
    await supabase.from('evenements_recurrents').update({ actif: false }).eq('id', id);
    reload();
  };

  if (recurrents.length === 0) {
    return (
      <div className="bg-white border border-cream-dark rounded-xl p-12 text-center">
        <Repeat className="w-10 h-10 text-cream-300 mx-auto mb-3" />
        <p className="text-sm text-ink/60 mb-4">Aucun événement récurrent</p>
        <p className="text-xs text-ink/50">Les événements récurrents sont parfaits pour vos réunions hebdomadaires, points commerciaux, etc.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recurrents.map(rec => (
        <div key={rec.id} className="bg-white border border-cream-dark rounded-lg p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
            <Repeat className="w-5 h-5 text-sage-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-ink">{rec.titre}</div>
            <div className="text-xs text-ink/60 flex flex-wrap gap-2 mt-1">
              <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{rec.frequence}</span>
              {rec.jour_semaine !== null && rec.jour_semaine !== undefined && (
                <span>· {JOURS[rec.jour_semaine]}</span>
              )}
              {rec.heure && <span className="flex items-center gap-1">· <Clock className="w-3 h-3" />{rec.heure}</span>}
              {rec.duree_minutes && <span>· {rec.duree_minutes} min</span>}
              {rec.lieu && <span className="flex items-center gap-1">· <MapPin className="w-3 h-3" />{rec.lieu}</span>}
            </div>
            {rec.description && <div className="text-xs text-ink/60 mt-1 line-clamp-2">{rec.description}</div>}
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(rec)} className="p-1.5 text-ink/60 hover:text-sage-dark hover:bg-cream-100 rounded">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(rec.id)} className="p-1.5 text-ink/60 hover:text-red-600 hover:bg-cream-100 rounded">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecurrentForm({ rec, onClose, onSaved }) {
  const { user } = useAuth();
  const [titre, setTitre] = useState(rec.titre || '');
  const [description, setDescription] = useState(rec.description || '');
  const [frequence, setFrequence] = useState(rec.frequence || 'Hebdomadaire');
  const [jourSemaine, setJourSemaine] = useState(rec.jour_semaine ?? 1);
  const [heure, setHeure] = useState(rec.heure || '09:00');
  const [duree, setDuree] = useState(rec.duree_minutes || 60);
  const [lieu, setLieu] = useState(rec.lieu || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const data = {
      titre, description, frequence,
      jour_semaine: frequence === 'Hebdomadaire' ? parseInt(jourSemaine) : null,
      jour_mois: frequence === 'Mensuel' ? parseInt(jourSemaine) : null,
      heure, duree_minutes: parseInt(duree), lieu,
      actif: true
    };
    
    if (rec.id) {
      await supabase.from('evenements_recurrents').update(data).eq('id', rec.id);
    } else {
      await supabase.from('evenements_recurrents').insert({ ...data, created_by: user?.id });
    }
    setLoading(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <h2 className="font-display text-xl font-semibold text-ink">
            {rec.id ? 'Modifier' : 'Nouvel'} événement récurrent
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-ink/70 block mb-1">Titre *</label>
            <input type="text" value={titre} onChange={e => setTitre(e.target.value)} required autoFocus
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Fréquence</label>
            <select value={frequence} onChange={e => setFrequence(e.target.value)}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm">
              <option>Hebdomadaire</option>
              <option>Mensuel</option>
              <option>Quotidien</option>
            </select>
          </div>
          {frequence === 'Hebdomadaire' && (
            <div>
              <label className="text-xs text-ink/70 block mb-1">Jour de la semaine</label>
              <select value={jourSemaine} onChange={e => setJourSemaine(e.target.value)}
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm">
                {JOURS.map((j, i) => <option key={i} value={i}>{j}</option>)}
              </select>
            </div>
          )}
          {frequence === 'Mensuel' && (
            <div>
              <label className="text-xs text-ink/70 block mb-1">Jour du mois (1-31)</label>
              <input type="number" min={1} max={31} value={jourSemaine} onChange={e => setJourSemaine(e.target.value)}
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink/70 block mb-1">Heure</label>
              <input type="time" value={heure} onChange={e => setHeure(e.target.value)}
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-ink/70 block mb-1">Durée (min)</label>
              <input type="number" value={duree} onChange={e => setDuree(e.target.value)}
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Lieu</label>
            <input type="text" value={lieu} onChange={e => setLieu(e.target.value)}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
