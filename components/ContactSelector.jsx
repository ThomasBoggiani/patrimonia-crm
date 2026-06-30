'use client';

// components/ContactSelector.jsx
// Sélecteur de contact réutilisable : recherche dans la base contacts
// + bouton pour créer un nouveau contact à la volée

import { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, User, Building2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function ContactSelector({ value, onChange, categorie = null, placeholder = 'Rechercher un contact…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ prenom: '', nom: '', societe: '', email: '', tel: '' });
  const [selectedContact, setSelectedContact] = useState(null);
  const containerRef = useRef(null);

  // Charge le contact courant si value est un ID
  useEffect(() => {
    if (!value) {
      setSelectedContact(null);
      return;
    }
    if (selectedContact && selectedContact.id === value) return;
    apiFetch(`/api/contacts/${value}`)
      .then(r => r.json())
      .then(d => {
        if (d?.contact) setSelectedContact(d.contact);
      })
      .catch(() => {});
  }, [value]);

  // Ferme le panneau si on clique en dehors
  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Recherche debouncée
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (categorie) params.set('categorie', categorie);
      params.set('limit', '20');
      apiFetch(`/api/contacts?${params.toString()}`)
        .then(r => r.json())
        .then(d => setResults(d?.contacts || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, categorie]);

  function handleSelect(contact) {
    setSelectedContact(contact);
    onChange?.(contact.id, contact);
    setOpen(false);
    setQuery('');
  }

  function handleClear() {
    setSelectedContact(null);
    onChange?.(null, null);
    setQuery('');
  }

  async function handleCreate() {
    if (!draft.nom && !draft.societe) {
      alert('Indique au moins un nom ou une société.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, categorie }),
      });
      const data = await res.json();
      if (data?.contact) {
        handleSelect(data.contact);
        setCreating(false);
        setDraft({ prenom: '', nom: '', societe: '', email: '', tel: '' });
      } else {
        alert(data?.error || 'Erreur création contact');
      }
    } catch (e) {
      alert('Erreur création contact : ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Affichage compact si un contact est sélectionné */}
      {selectedContact && !open ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-lg bg-white hover:bg-stone-50 cursor-pointer" onClick={() => setOpen(true)}>
          {selectedContact.type_contact === 'personne_morale' ? <Building2 className="w-4 h-4 text-stone-400" /> : <User className="w-4 h-4 text-stone-400" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-stone-900 truncate">
              {[selectedContact.prenom, selectedContact.nom].filter(Boolean).join(' ') || selectedContact.societe || '—'}
            </div>
            <div className="text-xs text-stone-500 truncate">
              {selectedContact.societe && [selectedContact.prenom, selectedContact.nom].filter(Boolean).length > 0 ? selectedContact.societe + ' · ' : ''}
              {selectedContact.email || selectedContact.tel || ''}
            </div>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleClear(); }} className="p-1 text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"
          />
        </div>
      )}

      {/* Panneau résultats */}
      {open && !creating && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-80 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-stone-500">Recherche…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-stone-500">Aucun contact trouvé.</div>
          )}
          {!loading && results.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center gap-2 border-b border-stone-100 last:border-b-0"
            >
              {c.type_contact === 'personne_morale' ? <Building2 className="w-4 h-4 text-stone-400 shrink-0" /> : <User className="w-4 h-4 text-stone-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">
                  {[c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || '—'}
                </div>
                <div className="text-xs text-stone-500 truncate">
                  {c.societe && [c.prenom, c.nom].filter(Boolean).length > 0 ? c.societe + ' · ' : ''}
                  {c.email || c.tel || ''}
                </div>
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setCreating(true); setDraft({ ...draft, nom: query }); }}
            className="w-full text-left px-3 py-2 hover:bg-sage-50 flex items-center gap-2 text-sage-700 border-t border-stone-200 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Créer un nouveau contact
          </button>
        </div>
      )}

      {/* Formulaire de création rapide */}
      {open && creating && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg p-3">
          <div className="text-xs font-semibold text-stone-700 mb-2">Nouveau contact</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="text" placeholder="Prénom" value={draft.prenom} onChange={(e) => setDraft({ ...draft, prenom: e.target.value })} className="px-2 py-1.5 text-sm border border-stone-200 rounded" />
            <input type="text" placeholder="Nom" value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} className="px-2 py-1.5 text-sm border border-stone-200 rounded" />
          </div>
          <input type="text" placeholder="Société" value={draft.societe} onChange={(e) => setDraft({ ...draft, societe: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-stone-200 rounded mb-2" />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="email" placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="px-2 py-1.5 text-sm border border-stone-200 rounded" />
            <input type="tel" placeholder="Tél." value={draft.tel} onChange={(e) => setDraft({ ...draft, tel: e.target.value })} className="px-2 py-1.5 text-sm border border-stone-200 rounded" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs border border-stone-200 rounded hover:bg-stone-50">Annuler</button>
            <button type="button" onClick={handleCreate} disabled={loading} className="px-3 py-1.5 text-xs bg-sage-600 text-white rounded hover:bg-sage-700 disabled:opacity-50">
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
