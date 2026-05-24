'use client';

// components/ContactsTab.jsx
// Liste des contacts unifiés (mandants, acquéreurs, apporteurs, notaires...)

import { useState, useEffect } from 'react';
import { Search, Plus, User, Building2, Mail, Phone, MapPin, Pencil, Trash2, ExternalLink } from 'lucide-react';

const CATEGORIES = [
  { value: 'particulier', label: 'Particulier' },
  { value: 'agence', label: 'Agence' },
  { value: 'notaire', label: 'Notaire' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'fonciere', label: 'Foncière' },
  { value: 'mdb', label: 'Marchand de Biens' },
  { value: 'apporteur', label: 'Apporteur' },
  { value: 'autre', label: 'Autre' },
];

export default function ContactsTab() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [categorieFilter, setCategorieFilter] = useState('');
  const [editingContact, setEditingContact] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Load contacts
  async function loadContacts() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (categorieFilter) params.set('categorie', categorieFilter);
    params.set('limit', '200');
    try {
      const res = await fetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      setContacts(data?.contacts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const h = setTimeout(loadContacts, 250);
    return () => clearTimeout(h);
  }, [query, categorieFilter]);

  async function handleDelete(contact) {
    if (!confirm(`Supprimer le contact ${[contact.prenom, contact.nom].filter(Boolean).join(' ') || contact.societe} ?`)) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || 'Erreur suppression');
        return;
      }
      loadContacts();
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, email, société, tél…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"
          />
        </div>
        <select
          value={categorieFilter}
          onChange={(e) => setCategorieFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button
          onClick={() => { setEditingContact({}); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700"
        >
          <Plus className="w-4 h-4" />
          Nouveau contact
        </button>
      </div>

      {/* Compteur */}
      <div className="text-xs text-stone-500">
        {loading ? 'Chargement…' : `${contacts.length} contact${contacts.length > 1 ? 's' : ''}`}
      </div>

      {/* Tableau */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Nom</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Société</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Catégorie</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Ville</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {contacts.map(c => (
              <tr key={c.id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {c.type_contact === 'personne_morale' ? <Building2 className="w-4 h-4 text-stone-400" /> : <User className="w-4 h-4 text-stone-400" />}
                    <span className="font-medium text-stone-900">
                      {[c.prenom, c.nom].filter(Boolean).join(' ') || '—'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-stone-700">{c.societe || '—'}</td>
                <td className="px-4 py-3">
                  {c.categorie ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                      {CATEGORIES.find(x => x.value === c.categorie)?.label || c.categorie}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-stone-700">
                  <div className="space-y-0.5">
                    {c.email && <div className="flex items-center gap-1 text-xs"><Mail className="w-3 h-3 text-stone-400" />{c.email}</div>}
                    {c.tel && <div className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3 text-stone-400" />{c.tel}</div>}
                    {!c.email && !c.tel && '—'}
                  </div>
                </td>
                <td className="px-4 py-3 text-stone-700">
                  {c.ville ? <div className="flex items-center gap-1 text-xs"><MapPin className="w-3 h-3 text-stone-400" />{c.ville}</div> : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditingContact(c); setShowForm(true); }} className="p-1.5 text-stone-400 hover:text-stone-700"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(c)} className="p-1.5 text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {!loading && contacts.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center text-sm text-stone-500">
                  Aucun contact trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal formulaire */}
      {showForm && editingContact && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => { setShowForm(false); setEditingContact(null); }}
          onSaved={() => { setShowForm(false); setEditingContact(null); loadContacts(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL FORMULAIRE CONTACT
// ─────────────────────────────────────────────────────────────────

function ContactFormModal({ contact, onClose, onSaved }) {
  const isNew = !contact.id;
  const [draft, setDraft] = useState({
    prenom: contact.prenom || '',
    nom: contact.nom || '',
    societe: contact.societe || '',
    email: contact.email || '',
    tel: contact.tel || '',
    type_contact: contact.type_contact || 'personne_physique',
    categorie: contact.categorie || '',
    adresse: contact.adresse || '',
    ville: contact.ville || '',
    code_postal: contact.code_postal || '',
    notes: contact.notes || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.nom && !draft.societe) {
      alert('Indique au moins un nom ou une société.');
      return;
    }
    setSaving(true);
    try {
      const body = { ...draft, categorie: draft.categorie || null };
      const res = isNew
        ? await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/contacts/${contact.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || 'Erreur sauvegarde');
        return;
      }
      onSaved?.();
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {isNew ? 'Nouveau contact' : 'Modifier le contact'}
        </h2>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Type</label>
              <select value={draft.type_contact} onChange={(e) => setDraft({ ...draft, type_contact: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded">
                <option value="personne_physique">Personne physique</option>
                <option value="personne_morale">Personne morale</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Catégorie</label>
              <select value={draft.categorie} onChange={(e) => setDraft({ ...draft, categorie: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded">
                <option value="">—</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Prénom</label>
              <input type="text" value={draft.prenom} onChange={(e) => setDraft({ ...draft, prenom: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Nom</label>
              <input type="text" value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Société</label>
            <input type="text" value={draft.societe} onChange={(e) => setDraft({ ...draft, societe: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
              <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Téléphone</label>
              <input type="tel" value={draft.tel} onChange={(e) => setDraft({ ...draft, tel: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Adresse</label>
            <input type="text" value={draft.adresse} onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Code postal</label>
              <input type="text" value={draft.code_postal} onChange={(e) => setDraft({ ...draft, code_postal: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Ville</label>
              <input type="text" value={draft.ville} onChange={(e) => setDraft({ ...draft, ville: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-stone-200 rounded" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-stone-200 rounded hover:bg-stone-50">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-sage-600 text-white rounded hover:bg-sage-700 disabled:opacity-50">
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
