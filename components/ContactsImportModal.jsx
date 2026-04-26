'use client';
import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, AlertCircle, Check, Users, Mail, Phone, Building2, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ContactsImportModal({ onClose, onImported }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showResult, setShowResult] = useState(null);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/microsoft/contacts', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur de chargement');
      }
      
      const { contacts } = await res.json();
      setContacts(contacts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (selectedIds.size === 0) return;
    
    setImporting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/microsoft/contacts', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contactIds: Array.from(selectedIds) })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      
      const result = await res.json();
      setShowResult(result);
      onImported && onImported(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const toggleContact = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const eligible = filteredContacts.filter(c => c.hasEmail && !c.alreadyInCrm);
    if (selectedIds.size === eligible.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligible.map(c => c.id)));
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.companyName?.toLowerCase().includes(s)
    );
  });

  if (showResult) {
    return (
      <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-sage-darker" />
            </div>
            <h2 className="font-display text-xl font-semibold text-ink mb-2">Import terminé !</h2>
            <div className="space-y-1 text-sm">
              <p><strong className="text-sage-darker">{showResult.imported}</strong> contact{showResult.imported > 1 ? 's' : ''} importé{showResult.imported > 1 ? 's' : ''}</p>
              {showResult.skipped > 0 && (
                <p className="text-ink/60"><strong>{showResult.skipped}</strong> ignoré{showResult.skipped > 1 ? 's' : ''} (déjà dans le CRM ou sans email)</p>
              )}
            </div>
            {showResult.errors?.length > 0 && (
              <div className="mt-4 text-left bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 max-h-32 overflow-y-auto">
                <strong>Détails :</strong>
                <ul className="mt-1 space-y-0.5">
                  {showResult.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                  {showResult.errors.length > 5 && <li>... et {showResult.errors.length - 5} autres</li>}
                </ul>
              </div>
            )}
            <button onClick={onClose}
              className="mt-5 w-full px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
              Terminé
            </button>
          </div>
        </div>
      </div>
    );
  }

  const eligibleCount = filteredContacts.filter(c => c.hasEmail && !c.alreadyInCrm).length;

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Importer des contacts Outlook</h2>
            <p className="text-xs text-ink/60 mt-0.5">Sélectionnez les contacts à ajouter dans le CRM</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
          </div>
        )}

        {/* Recherche + actions */}
        <div className="p-4 border-b border-cream-dark">
          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input 
                type="text" 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email ou société..."
                className="w-full pl-9 pr-3 py-2 border border-cream-dark rounded-lg text-sm"
              />
            </div>
            <button onClick={toggleAll}
              className="px-3 py-2 text-xs border border-cream-dark rounded-lg hover:bg-cream-50 whitespace-nowrap">
              {selectedIds.size === eligibleCount && eligibleCount > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>
          <div className="text-xs text-ink/60">
            {loading ? 'Chargement...' : `${contacts.length} contact${contacts.length > 1 ? 's' : ''} • ${selectedIds.size} sélectionné${selectedIds.size > 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-ink/60">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement des contacts Outlook...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-ink/60 text-sm">
              {search ? 'Aucun contact trouvé pour cette recherche' : 'Aucun contact Outlook'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map(contact => {
                const isSelected = selectedIds.has(contact.id);
                const disabled = !contact.hasEmail || contact.alreadyInCrm;
                
                return (
                  <label key={contact.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      disabled ? 'bg-cream-50 opacity-60 cursor-not-allowed' : 
                      isSelected ? 'bg-sage-50 border border-sage-light' : 'hover:bg-cream-50'
                    }`}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => toggleContact(contact.id)}
                      className="mt-1 rounded border-cream-dark"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm text-ink truncate">
                          {contact.displayName || `${contact.givenName || ''} ${contact.surname || ''}`.trim() || '(Sans nom)'}
                        </div>
                        {contact.alreadyInCrm && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-cream-100 text-ink/60 rounded-full">
                            Déjà en CRM
                          </span>
                        )}
                        {!contact.hasEmail && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                            Sans email
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink/60 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {contact.email && (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contact.phone}</span>
                        )}
                        {contact.companyName && (
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contact.companyName}</span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-4 border-t border-cream-dark bg-cream-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-100 rounded-lg">
            Annuler
          </button>
          <button onClick={handleImport} disabled={importing || selectedIds.size === 0}
            className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50 flex items-center gap-1.5">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Importer {selectedIds.size > 0 && `(${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
