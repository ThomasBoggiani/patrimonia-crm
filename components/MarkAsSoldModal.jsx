// ═══════════════════════════════════════════════════════════════════
// components/MarkAsSoldModal.jsx
// Modal "Marquer comme vendu (par autres)" avec acheteur et infos vente
// ═══════════════════════════════════════════════════════════════════

'use client';
import { useState, useMemo } from 'react';
import { X, Trophy, Search, User as UserIcon, Loader2, Plus, Building2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MarkAsSoldModal({ mandat, clients = [], onClose, onSuccess }) {
  const [data, setData] = useState({
    date_vente: new Date().toISOString().slice(0, 10),
    prix_vente_final: mandat?.prix || '',
    honoraires_percus: '',
    acheteur_client_id: null,
    agence_intermediaire: '',
    notes_vente: '',
  });

  const [searchClient, setSearchClient] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ prenom: '', nom: '', societe: '', email: '', tel: '' });
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setData({ ...data, [k]: v });

  const filteredClients = useMemo(() => {
    if (!searchClient.trim()) return [];
    const q = searchClient.toLowerCase();
    return clients.filter(c => {
      const text = `${c.prenom || ''} ${c.nom || ''} ${c.societe || ''} ${c.email || ''} ${c.tel || ''}`.toLowerCase();
      return text.includes(q);
    }).slice(0, 6);
  }, [searchClient, clients]);

  const selectedClient = data.acheteur_client_id ? clients.find(c => c.id === data.acheteur_client_id) : null;

  async function handleCreateNewClient() {
    if (!newClient.nom.trim()) { alert('Le nom est requis'); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: created, error } = await supabase.from('clients').insert({
        nom: newClient.nom,
        prenom: newClient.prenom || null,
        societe: newClient.societe || null,
        email: newClient.email || null,
        tel: newClient.tel || null,
        typologie: 'Investisseur',
        statut: 'Actif',
        created_by: user?.id,
        
      }).select().single();
      if (error || !created) { alert('Erreur création client : ' + (error?.message || 'inconnue')); return; }
      clients.push(created);
      update('acheteur_client_id', created.id);
      setShowNewClient(false);
      setNewClient({ prenom: '', nom: '', societe: '', email: '', tel: '' });
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const updates = {
        statut: 'Vendu par autres',
        date_vente: data.date_vente || null,
        prix_vente_final: data.prix_vente_final ? parseFloat(data.prix_vente_final) : null,
        honoraires_percus: data.honoraires_percus ? parseFloat(data.honoraires_percus) : null,
        acheteur_client_id: data.acheteur_client_id || null,
        agence_intermediaire: data.agence_intermediaire || null,
        notes_vente: data.notes_vente || null,
      };
      const { error } = await supabase.from('mandats').update(updates).eq('id', mandat.id);
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return; }
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-stone-900">Marquer comme vendu</h2>
              <p className="text-xs text-stone-500 truncate max-w-md">{mandat?.nom}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ℹ️ Le mandat passera au statut <span className="font-semibold">"Vendu par autres"</span>. 
            Pour une vente conclue par nous (Acte authentique), utilisez le pipeline normal.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Date de vente</label>
              <input type="date" value={data.date_vente} onChange={e => update('date_vente', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Prix de vente final (€)</label>
              <input type="number" value={data.prix_vente_final} onChange={e => update('prix_vente_final', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Acheteur <span className="text-stone-400 font-normal">(optionnel mais recommandé)</span></label>
            {showNewClient ? (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
                <div className="text-xs font-semibold text-stone-700">Nouveau client</div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Prénom" value={newClient.prenom} onChange={e => setNewClient({ ...newClient, prenom: e.target.value })} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
                  <input type="text" placeholder="Nom" value={newClient.nom} onChange={e => setNewClient({ ...newClient, nom: e.target.value })} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
                </div>
                <input type="text" placeholder="Société (optionnel)" value={newClient.societe} onChange={e => setNewClient({ ...newClient, societe: e.target.value })} className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Téléphone" value={newClient.tel} onChange={e => setNewClient({ ...newClient, tel: e.target.value })} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
                  <input type="email" placeholder="Email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleCreateNewClient} disabled={!newClient.nom.trim()} className="flex-1 px-3 py-1.5 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 disabled:opacity-50">Créer le client</button>
                  <button onClick={() => setShowNewClient(false)} className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100">Annuler</button>
                </div>
              </div>
            ) : selectedClient ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-stone-900 truncate">
                      {selectedClient.prenom} {selectedClient.nom}
                      {selectedClient.societe && <span className="text-stone-500 font-normal"> · {selectedClient.societe}</span>}
                    </div>
                    <div className="text-xs text-stone-500 truncate">
                      {selectedClient.tel || '—'}{selectedClient.email && ' · ' + selectedClient.email}
                    </div>
                  </div>
                </div>
                <button onClick={() => update('acheteur_client_id', null)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input type="text" placeholder="Rechercher un client (nom, société...)" value={searchClient}
                    onChange={e => { setSearchClient(e.target.value); setShowClientList(true); }}
                    onFocus={() => setShowClientList(true)}
                    className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                  {showClientList && searchClient.trim() && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-luxe max-h-64 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <div className="p-3 text-sm text-stone-500 text-center">Aucun résultat</div>
                      ) : (
                        filteredClients.map(c => (
                          <button key={c.id} onClick={() => { update('acheteur_client_id', c.id); setSearchClient(''); setShowClientList(false); }}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-stone-50 border-b border-stone-100 last:border-0 text-left">
                            <UserIcon className="w-4 h-4 text-stone-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-stone-900 truncate">
                                {c.prenom} {c.nom}{c.societe && <span className="text-stone-500 font-normal"> · {c.societe}</span>}
                              </div>
                              <div className="text-xs text-stone-500 truncate">{c.tel || c.email || '—'}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setShowNewClient(true)} className="text-xs text-sage-dark hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Créer un nouveau client
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Agence intermédiaire</label>
              <input type="text" placeholder="Ex: Barnes, Daniel Féau, ou aucune" value={data.agence_intermediaire} onChange={e => update('agence_intermediaire', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Honoraires perçus (€) <span className="text-stone-400 font-normal">si applicable</span></label>
              <input type="number" value={data.honoraires_percus} onChange={e => update('honoraires_percus', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Notes</label>
            <textarea rows={3} value={data.notes_vente} onChange={e => update('notes_vente', e.target.value)} placeholder="Contexte de la vente, infos utiles pour l'historique..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-stone-200 bg-stone-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Enregistrement...' : 'Confirmer la vente'}
          </button>
        </div>
      </div>
    </div>
  );
}
