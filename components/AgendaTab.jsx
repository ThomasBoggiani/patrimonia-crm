'use client';
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, Edit2, Trash2, X, Repeat, Pause, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function AgendaTab() {
  const [evenements, setEvenements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadEvenements(); }, []);

  async function loadEvenements() {
    setLoading(true);
    const { data } = await supabase.from('evenements_recurrents').select('*').order('created_at', { ascending: false });
    setEvenements(data || []);
    setLoading(false);
  }

  const toggleActif = async (ev) => {
    await supabase.from('evenements_recurrents').update({ actif: !ev.actif }).eq('id', ev.id);
    loadEvenements();
  };

  const deleteEv = async (id) => {
    if (!confirm('Supprimer cet événement récurrent ?')) return;
    await supabase.from('evenements_recurrents').delete().eq('id', id);
    loadEvenements();
  };

  const saveEv = async (ev) => {
    const toSnake = (obj) => {
      const r = {};
      for (const k in obj) {
        if (k === 'id' || k === 'createdAt' || k === 'updatedAt' || k === 'created_at' || k === 'updated_at') continue;
        const sk = k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
        if (obj[k] !== undefined) r[sk] = obj[k];
      }
      return r;
    };
    const data = toSnake(ev);
    if (ev.id) {
      await supabase.from('evenements_recurrents').update(data).eq('id', ev.id);
    } else {
      await supabase.from('evenements_recurrents').insert(data);
    }
    setEditing(null);
    setShowNew(false);
    loadEvenements();
  };

  const parJour = {};
  JOURS.forEach((_, idx) => { parJour[idx] = []; });
  evenements.filter(e => e.actif).forEach(e => {
    if (e.frequence !== 'Mensuelle' && e.jour_semaine !== null && e.jour_semaine !== undefined) {
      parJour[e.jour_semaine].push(e);
    }
  });
  const mensuels = evenements.filter(e => e.actif && e.frequence === 'Mensuelle');
  const inactifs = evenements.filter(e => !e.actif);

  const formatHeure = (h) => h ? h.slice(0, 5) : '';

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink mb-1">Agenda</h1>
          <p className="text-sage-dark">Réunions et rendez-vous récurrents</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-ink text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvel événement
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-ink/60">Chargement…</div>
      ) : evenements.length === 0 ? (
        <div className="text-center py-16 bg-white border border-cream-dark rounded-xl">
          <Calendar className="w-12 h-12 text-cream-300 mx-auto mb-3" />
          <div className="font-display text-lg text-ink mb-1">Aucun événement pour l'instant</div>
          <p className="text-sm text-ink/60 mb-4">Utilisez la note vocale pour en créer rapidement<br />(ex: "Réunion équipe tous les mardis à 11h")</p>
          <button onClick={() => setShowNew(true)} className="text-sm text-sage-dark hover:underline">+ Ajouter manuellement</button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink mb-3">Semaine type</h2>
            <div className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                const events = parJour[dayIdx] || [];
                const isToday = new Date().getDay() === dayIdx;
                return (
                  <div key={dayIdx} className={`bg-white border rounded-lg p-3 min-h-[140px] ${isToday ? 'border-sage ring-1 ring-sage-light' : 'border-cream-dark'}`}>
                    <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isToday ? 'text-sage-dark' : 'text-ink/60'}`}>
                      {JOURS_SHORT[dayIdx]}
                    </div>
                    <div className="space-y-1.5">
                      {events.length === 0 ? (
                        <div className="text-[10px] text-stone-300 italic">—</div>
                      ) : events.map(e => (
                        <div key={e.id} onClick={() => setEditing(e)} className="bg-sage-50 border border-sage-light rounded p-2 cursor-pointer hover:bg-sage-100 transition-colors">
                          <div className="text-[11px] font-medium text-sage-darker truncate">{e.titre}</div>
                          <div className="text-[10px] text-sage-dark flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />{formatHeure(e.heure)}
                          </div>
                          {e.lieu && <div className="text-[10px] text-ink/60 truncate mt-0.5">📍 {e.lieu}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {mensuels.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink mb-3">Mensuel</h2>
              <div className="grid grid-cols-3 gap-3">
                {mensuels.map(e => (
                  <div key={e.id} onClick={() => setEditing(e)} className="bg-white border border-cream-dark rounded-lg p-4 cursor-pointer hover:border-sage transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <Repeat className="w-4 h-4 text-sage-dark" />
                      <span className="text-[10px] uppercase tracking-wide text-ink/60">Le {e.jour_mois} du mois</span>
                    </div>
                    <div className="font-medium text-ink">{e.titre}</div>
                    <div className="text-xs text-ink/70 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />{formatHeure(e.heure)}
                    </div>
                    {e.lieu && <div className="text-xs text-ink/60 mt-1">📍 {e.lieu}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="font-display text-xl font-semibold text-ink mb-3">Tous les événements</h2>
            <div className="bg-white border border-cream-dark rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/70">Titre</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/70">Fréquence</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/70">Quand</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/70">Lieu</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/70">État</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {evenements.map(e => (
                    <tr key={e.id} className="border-t border-cream hover:bg-cream-50">
                      <td className="px-4 py-2.5 font-medium text-ink">{e.titre}</td>
                      <td className="px-4 py-2.5 text-ink/70">{e.frequence}</td>
                      <td className="px-4 py-2.5 text-ink/70">
                        {e.frequence === 'Mensuelle' 
                          ? `Le ${e.jour_mois} à ${formatHeure(e.heure)}`
                          : `${JOURS[e.jour_semaine]} ${formatHeure(e.heure)}`
                        }
                      </td>
                      <td className="px-4 py-2.5 text-ink/70 text-xs">{e.lieu || '—'}</td>
                      <td className="px-4 py-2.5">
                        {e.actif ? (
                          <span className="text-xs bg-sage-50 text-sage-dark px-2 py-0.5 rounded-full">Actif</span>
                        ) : (
                          <span className="text-xs bg-cream-200 text-ink/60 px-2 py-0.5 rounded-full">Suspendu</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => toggleActif(e)} title={e.actif ? 'Suspendre' : 'Réactiver'} className="p-1 text-ink/60 hover:text-sage-dark">
                            {e.actif ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditing(e)} className="p-1 text-ink/60 hover:text-sage-dark">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteEv(e.id)} className="p-1 text-ink/60 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(editing || showNew) && (
        <EvenementForm
          ev={editing}
          onSave={saveEv}
          onClose={() => { setEditing(null); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function EvenementForm({ ev, onSave, onClose }) {
  const [data, setData] = useState(ev ? {
    ...ev,
    jourSemaine: ev.jour_semaine,
    jourMois: ev.jour_mois,
    dureeMinutes: ev.duree_minutes
  } : {
    titre: '',
    description: '',
    frequence: 'Hebdomadaire',
    jourSemaine: 1,
    jourMois: null,
    heure: '09:00',
    dureeMinutes: 60,
    lieu: '',
    participants: [],
    actif: true
  });

  const update = (k, v) => setData({ ...data, [k]: v });

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <h2 className="font-display text-xl font-semibold text-ink">{ev ? 'Modifier' : 'Nouvel'} événement</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-ink/70 block mb-1">Titre</label>
            <input type="text" value={data.titre || ''} onChange={e => update('titre', e.target.value)}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Description (facultatif)</label>
            <textarea value={data.description || ''} onChange={e => update('description', e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink/70 block mb-1">Fréquence</label>
              <select value={data.frequence} onChange={e => update('frequence', e.target.value)}
                className="w-full px-2 py-2 border border-cream-dark rounded-lg text-sm">
                <option>Hebdomadaire</option><option>Bi-hebdomadaire</option><option>Mensuelle</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink/70 block mb-1">{data.frequence === 'Mensuelle' ? 'Jour du mois' : 'Jour'}</label>
              {data.frequence === 'Mensuelle' ? (
                <input type="number" min="1" max="31" value={data.jourMois || 1}
                  onChange={e => update('jourMois', +e.target.value)}
                  className="w-full px-2 py-2 border border-cream-dark rounded-lg text-sm" />
              ) : (
                <select value={data.jourSemaine ?? 1} onChange={e => update('jourSemaine', +e.target.value)}
                  className="w-full px-2 py-2 border border-cream-dark rounded-lg text-sm">
                  {JOURS.map((j, idx) => <option key={idx} value={idx}>{j}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-ink/70 block mb-1">Heure</label>
              <input type="time" value={data.heure || '09:00'} onChange={e => update('heure', e.target.value)}
                className="w-full px-2 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-ink/70 block mb-1">Durée (min)</label>
              <input type="number" value={data.dureeMinutes || 60} onChange={e => update('dureeMinutes', +e.target.value)}
                className="w-full px-2 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-ink/70 block mb-1">Lieu</label>
              <input type="text" value={data.lieu || ''} onChange={e => update('lieu', e.target.value)}
                className="w-full px-2 py-2 border border-cream-dark rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Participants (séparés par virgules)</label>
            <input type="text" value={(data.participants || []).join(', ')}
              onChange={e => update('participants', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-cream-dark bg-cream-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={() => onSave(data)} disabled={!data.titre}
            className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:bg-stone-300">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
