'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Users as UsersIcon, Plus, Trash2, Edit2, Repeat, ExternalLink, Loader2, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, getCurrentUserName } from '@/lib/auth';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const COLLEAGUE_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-900', dot: 'bg-blue-500' },
  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', dot: 'bg-purple-500' },
  { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', dot: 'bg-orange-500' },
  { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-900', dot: 'bg-pink-500' },
  { bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-900', dot: 'bg-teal-500' }
];
const ME_COLOR = { bg: 'bg-sage-50', border: 'border-sage', text: 'text-sage-darker', dot: 'bg-sage' };

// Plage horaire timeline
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT = 60; // pixels par heure

export default function AgendaTab() {
  const { user, profile } = useAuth();
  const [view, setView] = useState('day');
  const [myEvents, setMyEvents] = useState([]);
  const [colleagueEvents, setColleagueEvents] = useState({});
  const [recurrents, setRecurrents] = useState([]);
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleagues, setSelectedColleagues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(null);
  const [error, setError] = useState(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [editingRec, setEditingRec] = useState(null);
  const [nowTick, setNowTick] = useState(new Date());

  // Date du jour affiché (vue Jour)
  const [currentDay, setCurrentDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Pour vue Semaine
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    if (day !== 1) d.setHours(-24 * (day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Mini calendrier (mois affiché)
  const [miniMonth, setMiniMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Tick chaque minute pour la ligne "Maintenant"
  useEffect(() => {
    const tickInterval = setInterval(() => setNowTick(new Date()), 60000);
    return () => clearInterval(tickInterval);
  }, []);

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
  }, [outlookConnected, currentDay, currentWeekStart, view]);

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
      let start, end;
      if (view === 'day') {
        // Vue Jour : on charge -1j à +30j pour avoir la sidebar "A venir"
        start = new Date(currentDay);
        start.setDate(start.getDate() - 1);
        end = new Date(currentDay);
        end.setDate(end.getDate() + 30);
      } else {
        // Vue Semaine
        start = new Date(currentWeekStart);
        end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 7);
      }
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
    let start, end;
    if (view === 'day') {
      start = new Date(currentDay);
      end = new Date(currentDay);
      end.setDate(end.getDate() + 1);
    } else {
      start = new Date(currentWeekStart);
      end = new Date(currentWeekStart);
      end.setDate(end.getDate() + 7);
    }

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

  const goToDay = (offset) => {
    const d = new Date(currentDay);
    d.setDate(d.getDate() + offset);
    setCurrentDay(d);
    setMiniMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const goToToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCurrentDay(d);
    setMiniMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const goToWeek = (offset) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + offset * 7);
    setCurrentWeekStart(d);
  };
  const goToTodayWeek = () => {
    const d = new Date();
    const day = d.getDay() || 7;
    if (day !== 1) d.setHours(-24 * (day - 1));
    d.setHours(0, 0, 0, 0);
    setCurrentWeekStart(d);
  };

  const getColleagueColor = (email) => {
    const idx = colleagues.findIndex(c => c.email === email);
    return COLLEAGUE_COLORS[idx % COLLEAGUE_COLORS.length] || COLLEAGUE_COLORS[0];
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Helpers vue Jour
  const isToday = (d) => {
    const today = new Date();
    return d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();
  };

  // Events filtrés pour la vue Jour
  const dayEventsList = (() => {
    const dateKey = currentDay.toISOString().split('T')[0];
    const events = [];
    
    myEvents.forEach(ev => {
      const evDate = ev.start.dateTime.split('T')[0];
      if (evDate === dateKey) {
        events.push({ ...ev, _owner: 'me', _color: ME_COLOR });
      }
    });

    Object.entries(colleagueEvents).forEach(([email, evts]) => {
      const colleague = colleagues.find(c => c.email === email);
      if (!colleague) return;
      const color = getColleagueColor(email);
      evts.forEach(ev => {
        const evDate = ev.start.dateTime.split('T')[0];
        if (evDate === dateKey) {
          events.push({
            ...ev,
            _owner: 'colleague',
            _ownerName: `${colleague.prenom} ${colleague.nom}`,
            _ownerInitials: `${colleague.prenom[0]}${colleague.nom[0]}`,
            _color: color
          });
        }
      });
    });

    // Récurrents
    recurrents.forEach(rec => {
      if (!rec.actif) return;
      let matches = false;
      if (rec.frequence === 'Quotidien') matches = true;
      else if (rec.frequence === 'Hebdomadaire' && rec.jour_semaine !== null && rec.jour_semaine !== undefined) {
        matches = currentDay.getDay() === rec.jour_semaine;
      } else if (rec.frequence === 'Mensuel' && rec.jour_mois) {
        matches = currentDay.getDate() === rec.jour_mois;
      }
      if (!matches) return;
      const [h, m] = (rec.heure || '09:00').split(':').map(Number);
      const startDate = new Date(currentDay);
      startDate.setHours(h, m, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (rec.duree_minutes || 60));
      events.push({
        id: `rec-${rec.id}-${dateKey}`,
        subject: rec.titre,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        location: rec.lieu ? { displayName: rec.lieu } : null,
        isAllDay: false,
        _owner: 'recurrent',
        _recurrent: rec,
        _color: { bg: 'bg-stone-50', border: 'border-stone-400', text: 'text-stone-700', dot: 'bg-stone-400' }
      });
    });

    events.sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
    return events;
  })();

  // Liste "A venir" (3 prochains événements après aujourd'hui)
  const upcomingEvents = (() => {
    const now = new Date();
    return myEvents
      .filter(ev => new Date(ev.start.dateTime) > now)
      .slice(0, 3);
  })();

  // Eventsbyday pour vue Semaine (legacy)
  const eventsByDay = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    eventsByDay[key] = [];
  }
  myEvents.forEach(ev => {
    const dateKey = ev.start.dateTime.split('T')[0];
    if (eventsByDay[dateKey]) {
      eventsByDay[dateKey].push({ ...ev, _owner: 'me', _color: ME_COLOR });
    }
  });
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
  Object.keys(eventsByDay).forEach(key => {
    eventsByDay[key].sort((a, b) =>
      new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
    );
  });

  const weekLabel = (() => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    return `${currentWeekStart.getDate()} ${MOIS[currentWeekStart.getMonth()]} - ${end.getDate()} ${MOIS[end.getMonth()]} ${end.getFullYear()}`;
  })();

  const dayLabel = `${JOURS[currentDay.getDay()]} ${currentDay.getDate()} ${MOIS[currentDay.getMonth()]}`;

  // Position en pixels d'une heure dans la timeline
  const timeToPixels = (date) => {
    const d = new Date(date);
    const minutesFromStart = (d.getHours() - HOUR_START) * 60 + d.getMinutes();
    return (minutesFromStart / 60) * HOUR_HEIGHT;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-1">Agenda</h1>
        <p className="text-sage-dark text-sm md:text-base">Vos événements Outlook et ceux de l'équipe</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex gap-1">
          <button onClick={() => setView('day')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'day' ? 'bg-ink-deep text-white' : 'bg-white border border-cream-dark text-ink hover:bg-cream-50'}`}>
            📅 Jour
          </button>
          <button onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'week' ? 'bg-ink-deep text-white' : 'bg-white border border-cream-dark text-ink hover:bg-cream-50'}`}>
            📆 Semaine
          </button>
          <button onClick={() => setView('recurrents')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'recurrents' ? 'bg-ink-deep text-white' : 'bg-white border border-cream-dark text-ink hover:bg-cream-50'}`}>
            <Repeat className="w-4 h-4 inline mr-1.5" /> Récurrents ({recurrents.length})
          </button>
        </div>
        {(view === 'day' || view === 'week') && outlookConnected && (
          <button onClick={() => setShowNewEvent(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-luxe">
            <Plus className="w-4 h-4" /> Nouveau RDV
          </button>
        )}
        {view === 'recurrents' && (
          <button onClick={() => setEditingRec({})}
            className="flex items-center gap-1.5 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nouvel événement récurrent
          </button>
        )}
      </div>

      {/* Bandeau si non connecté */}
      {(view === 'day' || view === 'week') && outlookConnected === false && (
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VUE JOUR */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {view === 'day' && outlookConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-luxe border border-cream-dark overflow-hidden">
            {/* Nav date */}
            <div className="flex items-center justify-between p-4 border-b border-cream-dark">
              <div className="flex gap-1">
                <button onClick={() => goToDay(-1)} className="px-3 py-1.5 hover:bg-cream-50 rounded text-sm">← Hier</button>
                <button onClick={goToToday} className="px-3 py-1.5 hover:bg-cream-50 rounded text-sm font-medium text-sage-darker">Aujourd'hui</button>
                <button onClick={() => goToDay(1)} className="px-3 py-1.5 hover:bg-cream-50 rounded text-sm">Demain →</button>
              </div>
              <div className="text-center">
                <div className="font-display text-xl font-semibold text-ink capitalize">{dayLabel}</div>
                <div className="text-xs text-stone-500">{dayEventsList.length} RDV programmé{dayEventsList.length > 1 ? 's' : ''}</div>
              </div>
              <div className="w-24 flex justify-end">{loading && <Loader2 className="w-4 h-4 animate-spin text-sage" />}</div>
            </div>

            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
              </div>
            )}

            {/* Timeline 8h-20h */}
            <div className="relative" style={{ height: `${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px` }}>
              {/* Heures + lignes */}
              <div className="absolute inset-0">
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
                  const h = HOUR_START + i;
                  return (
                    <div key={h} className="flex" style={{ height: `${HOUR_HEIGHT}px` }}>
                      <div className="w-14 text-[11px] text-stone-400 text-right pr-2 pt-0 border-r border-cream-dark">
                        {String(h).padStart(2, '0')}:00
                      </div>
                      <div className="flex-1 border-b border-cream"></div>
                    </div>
                  );
                })}
              </div>

              {/* Events positionnés */}
              {dayEventsList.map((ev, i) => {
                const top = Math.max(0, timeToPixels(ev.start.dateTime));
                const heightRaw = timeToPixels(ev.end.dateTime) - timeToPixels(ev.start.dateTime);
                const height = Math.max(28, heightRaw);
                const color = ev._color;
                return (
                  <div
                    key={`${ev._owner}-${ev.id}-${i}`}
                    className={`absolute ${color.bg} border-l-4 ${color.border} rounded-r-md px-2.5 py-1.5 cursor-pointer hover:shadow-md transition`}
                    style={{ top: `${top}px`, height: `${height - 2}px`, left: '60px', right: '8px' }}
                  >
                    <div className={`text-[10px] font-medium ${color.text}`}>
                      {formatTime(ev.start.dateTime)} - {formatTime(ev.end.dateTime)}
                      {ev._owner === 'colleague' && <span className="ml-1 opacity-70">· {ev._ownerInitials}</span>}
                    </div>
                    <div className={`text-sm font-semibold ${color.text} truncate`}>{ev.subject || '(Sans titre)'}</div>
                    {height > 50 && ev.location?.displayName && (
                      <div className="text-[11px] text-stone-500 truncate">📍 {ev.location.displayName}</div>
                    )}
                  </div>
                );
              })}

              {/* Ligne Maintenant (uniquement aujourd'hui) */}
              {isToday(currentDay) && nowTick.getHours() >= HOUR_START && nowTick.getHours() < HOUR_END && (
                <div
                  className="absolute left-14 right-0 h-0.5 bg-red-500 z-10"
                  style={{ top: `${((nowTick.getHours() - HOUR_START) * 60 + nowTick.getMinutes()) / 60 * HOUR_HEIGHT}px` }}
                >
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="absolute -left-12 -top-2 text-[10px] font-medium text-red-600">
                    {String(nowTick.getHours()).padStart(2, '0')}:{String(nowTick.getMinutes()).padStart(2, '0')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar droite */}
          <div className="space-y-4">
            <MiniCalendar
              monthDate={miniMonth}
              currentDay={currentDay}
              onSelectDay={(d) => { setCurrentDay(d); setMiniMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}
              onChangeMonth={setMiniMonth}
            />

            <div className="bg-white rounded-xl p-4 shadow-luxe border border-cream-dark">
              <div className="text-[10px] uppercase tracking-wide text-sage-dark font-medium mb-3">Agendas affichés</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-2">
                <div className={`w-3 h-3 rounded-sm ${ME_COLOR.dot}`} />
                <span className="text-sm font-medium text-ink">Moi</span>
              </div>
              {colleagues.length === 0 ? (
                <div className="text-xs text-ink/50 italic">Aucun collègue</div>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-wide text-stone-400 mt-3 mb-1">Mes collègues</div>
                  {colleagues.map(c => {
                    const checked = selectedColleagues.includes(c.email);
                    const color = getColleagueColor(c.email);
                    return (
                      <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-50 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleColleague(c.email)} className="rounded" />
                        <div className={`w-3 h-3 rounded-sm ${color.dot}`} />
                        <span className="text-sm text-ink">{c.prenom}</span>
                      </label>
                    );
                  })}
                </>
              )}
            </div>

            {upcomingEvents.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-luxe border border-cream-dark">
                <div className="text-[10px] uppercase tracking-wide text-sage-dark font-medium mb-2">À venir</div>
                <div className="space-y-2">
                  {upcomingEvents.map(ev => {
                    const d = new Date(ev.start.dateTime);
                    const isTomorrow = (() => {
                      const tm = new Date();
                      tm.setDate(tm.getDate() + 1);
                      return d.toDateString() === tm.toDateString();
                    })();
                    const label = isTomorrow ? 'Demain' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
                    return (
                      <div key={ev.id} className="text-xs cursor-pointer hover:bg-cream-50 -mx-2 px-2 py-1 rounded" onClick={() => { setCurrentDay(new Date(d.getFullYear(), d.getMonth(), d.getDate())); setMiniMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
                        <div className="font-medium text-ink capitalize">{label} {formatTime(ev.start.dateTime)}</div>
                        <div className="text-stone-500 truncate">{ev.subject || '(Sans titre)'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VUE SEMAINE (legacy) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {view === 'week' && outlookConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
          <aside className="bg-white border border-cream-dark rounded-lg p-3 h-fit">
            <div className="text-xs uppercase tracking-wide text-sage-dark font-medium mb-3">Agendas affichés</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-2">
              <div className={`w-3 h-3 rounded-sm ${ME_COLOR.dot}`} />
              <span className="text-sm font-medium text-ink">Moi</span>
            </div>
            {colleagues.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wide text-ink/50 mt-3 mb-1">Mes collègues</div>
                {colleagues.map(c => {
                  const checked = selectedColleagues.includes(c.email);
                  const color = getColleagueColor(c.email);
                  return (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-50 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggleColleague(c.email)} className="rounded" />
                      <div className={`w-3 h-3 rounded-sm ${color.dot}`} />
                      <span className="text-sm text-ink">{c.prenom}</span>
                    </label>
                  );
                })}
              </>
            )}
          </aside>

          <div>
            <div className="flex items-center justify-between bg-white border border-cream-dark rounded-lg p-3 mb-4">
              <div className="flex gap-1">
                <button onClick={() => goToWeek(-1)} className="px-3 py-1 hover:bg-cream-100 rounded text-sm">← Précédent</button>
                <button onClick={goToTodayWeek} className="px-3 py-1 hover:bg-cream-100 rounded text-sm font-medium text-sage-dark">Aujourd'hui</button>
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
                        <div className="text-[10px] text-ink/40 italic">-</div>
                      ) : events.map((ev, i) => (
                        <div key={i} className={`${ev._color.bg} border ${ev._color.border} rounded px-1.5 py-1 text-[11px]`}>
                          <div className={`font-medium ${ev._color.text}`}>{formatTime(ev.start.dateTime)}</div>
                          <div className={`font-medium ${ev._color.text} truncate`}>{ev.subject || '(Sans titre)'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VUE RÉCURRENTS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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

// ═══════════════════════════════════════════════════════════════
// MiniCalendar
// ═══════════════════════════════════════════════════════════════
function MiniCalendar({ monthDate, currentDay, onSelectDay, onChangeMonth }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0 = Lundi

  const cells = [];
  // Jours du mois précédent
  for (let i = 0; i < startDayOfWeek; i++) {
    const d = new Date(year, month, -startDayOfWeek + i + 1);
    cells.push({ date: d, current: false });
  }
  // Jours du mois courant
  for (let i = 1; i <= lastDay.getDate(); i++) {
    cells.push({ date: new Date(year, month, i), current: true });
  }
  // Compléter à 42 cases (6 semaines)
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), current: false });
  }

  const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const today = new Date();

  return (
    <div className="bg-white rounded-xl p-4 shadow-luxe border border-cream-dark">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onChangeMonth(new Date(year, month - 1, 1))} className="text-stone-500 hover:text-ink p-1">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium text-ink capitalize">{MOIS[month]} {year}</div>
        <button onClick={() => onChangeMonth(new Date(year, month + 1, 1))} className="text-stone-500 hover:text-ink p-1">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-stone-400 mb-1">
        {JOURS_COURTS.map((j, i) => <div key={i}>{j}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-center">
        {cells.map((cell, i) => {
          const isSelected = isSameDay(cell.date, currentDay);
          const isCurrentToday = isSameDay(cell.date, today);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(cell.date)}
              className={`py-1 rounded transition-colors ${
                isSelected ? 'bg-ink text-white font-medium'
                : isCurrentToday ? 'bg-sage-50 text-sage-darker font-medium'
                : cell.current ? 'text-ink hover:bg-cream-50'
                : 'text-stone-300 hover:bg-cream-50'
              }`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RecurrentList + RecurrentForm + NewEventModal (legacy, copiés de l'ancien)
// ═══════════════════════════════════════════════════════════════
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
                <span>&middot; {JOURS[rec.jour_semaine]}</span>
              )}
              {rec.heure && <span className="flex items-center gap-1">&middot; <Clock className="w-3 h-3" />{rec.heure}</span>}
              {rec.duree_minutes && <span>&middot; {rec.duree_minutes} min</span>}
              {rec.lieu && <span className="flex items-center gap-1">&middot; <MapPin className="w-3 h-3" />{rec.lieu}</span>}
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

function NewEventModal({ onClose, onCreated, editEvent = null }) {
  const isEdit = !!editEvent;
  const [titre, setTitre] = useState(editEvent?.subject || '');
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
