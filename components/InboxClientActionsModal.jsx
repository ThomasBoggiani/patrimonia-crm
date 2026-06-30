// components/InboxClientActionsModal.jsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, Link2, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import OwnerSelect from './OwnerSelect';

// ─────────────────────────────────────────────────────────
// Helper : déduit prénom/nom depuis le "from.name" Outlook
// "Tom Tanguy" → { prenom: "Tom", nom: "Tanguy" }
// "TANGUY, Tom" → { prenom: "Tom", nom: "Tanguy" }
// "TOM TANGUY" → { prenom: "Tom", nom: "Tanguy" }
// "Tom" → { prenom: "", nom: "Tom" }
// ─────────────────────────────────────────────────────────
function parseFromName(rawName) {
  if (!rawName) return { prenom: '', nom: '' };
  const name = rawName.trim();

  // Format "NOM, Prénom"
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    return { prenom: capitalize(first), nom: capitalize(last) };
  }

  const parts = name.split(/\s+/);
  if (parts.length === 1) {
    return { prenom: '', nom: capitalize(parts[0]) };
  }

  // Standard "Prénom Nom" ou "Prénom de la Particule Nom"
  return {
    prenom: capitalize(parts[0]),
    nom: parts.slice(1).map(capitalize).join(' ')
  };
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ─────────────────────────────────────────────────────────
// Composant principal : modale avec 2 onglets
// ─────────────────────────────────────────────────────────
export default function InboxClientActionsModal({
  isOpen,
  onClose,
  fromName,           // string (ex: "Tom Tanguy")
  fromEmail,          // string (ex: "tomtanguy.immo@outlook.fr")
  emailSubject,       // string (sujet du mail, optionnel)
  emailPreview,       // string (preview du mail, optionnel)
  onSuccess           // callback (newClient) => void
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState('create'); // 'create' | 'link'
  const [teamProfiles, setTeamProfiles] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('profiles')
      .select('id, prenom, nom, role, actif')
      .then(({ data }) => setTeamProfiles(data || []));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h3 className="font-display text-lg font-semibold">
            Action sur cet expéditeur
          </h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Info expéditeur */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 text-sm">
          <div className="text-stone-500 text-xs mb-0.5">Expéditeur</div>
          <div className="text-stone-900 font-medium">{fromName || '(sans nom)'}</div>
          <div className="text-stone-600 text-xs">{fromEmail}</div>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
              tab === 'create'
                ? 'border-b-2 border-purple-600 text-purple-700'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Créer un client
          </button>
          <button
            onClick={() => setTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
              tab === 'link'
                ? 'border-b-2 border-purple-600 text-purple-700'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Lier à un client existant
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'create' ? (
            <CreateClientForm
              fromName={fromName}
              fromEmail={fromEmail}
              emailSubject={emailSubject}
              emailPreview={emailPreview}
              userId={user?.id}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          ) : (
            <LinkExistingClient
              fromEmail={fromEmail}
              userId={user?.id}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Formulaire de création
// ─────────────────────────────────────────────────────────
function CreateClientForm({ fromName, fromEmail, emailSubject, emailPreview, userId, onSuccess, onClose }) {
  const initialNames = parseFromName(fromName);
  const [data, setData] = useState({
    prenom: initialNames.prenom,
    nom: initialNames.nom,
    email: fromEmail || '',
    tel: '',
    societe: '',
    typologie: 'Foncières',
    nature: 'Privée',
    maturite: 'Moyen',
    statut: 'Actif',
    origine: 'Email',
    
    details_recherche: emailSubject || emailPreview
      ? `Premier contact via email${emailSubject ? ` : "${emailSubject}"` : ''}${emailPreview ? `\n\n${emailPreview.slice(0, 500)}` : ''}`
      : ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const upd = (k, v) => setData(d => ({ ...d, [k]: v }));

  async function handleSubmit() {
    if (!data.nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const insertData = {
        ...data,
        prenom: data.prenom.trim(),
        nom: data.nom.trim(),
        email: data.email.trim().toLowerCase(),
        tel: data.tel.trim(),
        societe: data.societe.trim(),
        details_recherche: data.details_recherche?.trim() || null,
        created_by: userId
      };

      const { data: newClient, error: insErr } = await supabase
        .from('clients')
        .insert(insertData)
        .select()
        .single();

      if (insErr) throw insErr;

      onSuccess?.(newClient);
      onClose();
    } catch (e) {
      console.error('[InboxClientCreate]', e);
      setError(e.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Identité */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <input
            type="text"
            value={data.prenom}
            onChange={(e) => upd('prenom', e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
          />
        </Field>
        <Field label="Nom *">
          <input
            type="text"
            value={data.nom}
            onChange={(e) => upd('nom', e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
            required
          />
        </Field>
      </div>

      <Field label="Société">
        <input
          type="text"
          value={data.societe}
          onChange={(e) => upd('societe', e.target.value)}
          placeholder="Optionnel"
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input
            type="email"
            value={data.email}
            onChange={(e) => upd('email', e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
          />
        </Field>
        <Field label="Téléphone">
          <input
            type="tel"
            value={data.tel}
            onChange={(e) => upd('tel', e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
          />
        </Field>
      </div>

      {/* Catégorisation CRM */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Typologie">
          <select
            value={data.typologie}
            onChange={(e) => upd('typologie', e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
          >
            <option>Foncières</option>
            <option>Family Office</option>
            <option>Investisseur</option>
            <option>MDB</option>
            <option>Promoteur</option>
            <option>Autre</option>
          </select>
        </Field>
        <Field label="Maturité">
          <select
            value={data.maturite}
            onChange={(e) => upd('maturite', e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
          >
            <option>Chaud</option>
            <option>Moyen</option>
            <option>Froid</option>
          </select>
        </Field>
        <OwnerSelect
          value={data.owner}
          onChange={(v) => upd('owner', v)}
          profiles={teamProfiles}
          label="Resp."
        />
      </div>

      {/* Notes libres */}
      <Field label="Notes / Détails de recherche">
        <textarea
          value={data.details_recherche}
          onChange={(e) => upd('details_recherche', e.target.value)}
          rows={5}
          placeholder="Contexte du premier contact, recherche du client, points d'attention..."
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono"
        />
      </Field>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 text-sm text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !data.nom.trim()}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Création...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Créer le client
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Lier à un client existant
// ─────────────────────────────────────────────────────────
function LinkExistingClient({ fromEmail, userId, onSuccess, onClose }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(null); // id du client en cours de liaison
  const [error, setError] = useState('');

  // Charge la liste de tous les clients au montage
  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from('clients')
        .select('id, prenom, nom, societe, email, tel')
        .order('nom', { ascending: true });
      if (e) setError(e.message);
      else setClients(data || []);
      setLoading(false);
    })();
  }, []);

  // Filtre côté front
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients.filter(c =>
      `${c.prenom || ''} ${c.nom || ''} ${c.societe || ''} ${c.email || ''}`
        .toLowerCase()
        .includes(q)
    ).slice(0, 50);
  }, [clients, search]);

  async function handleLink(client) {
    setLinking(client.id);
    setError('');
    try {
      // Si le client a déjà une autre adresse email, on garde l'historique en notes
      const oldEmail = client.email;
      const newEmail = fromEmail.trim().toLowerCase();

      const update = {
        email: newEmail,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };

      const { data: updated, error: e } = await supabase
        .from('clients')
        .update(update)
        .eq('id', client.id)
        .select()
        .single();

      if (e) throw e;

      // Note : si tu veux tracer l'ancien email, tu pourrais ici insérer une interaction
      // type 'note' avec resume = `Email mis à jour de ${oldEmail} → ${newEmail}`
      // Pour la v1 on garde simple.

      onSuccess?.(updated);
      onClose();
    } catch (e) {
      console.error('[InboxClientLink]', e);
      setError(e.message || 'Erreur lors de la liaison');
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-stone-600">
        Sélectionne un client existant. Son email sera remplacé par <strong>{fromEmail}</strong>.
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, société, email..."
          autoFocus
          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="max-h-[400px] overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
        {loading && <div className="p-4 text-sm text-stone-400 text-center">Chargement...</div>}

        {!loading && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-stone-400">
            Aucun client trouvé.
          </div>
        )}

        {!loading && filtered.map(c => (
          <button
            key={c.id}
            onClick={() => handleLink(c)}
            disabled={linking !== null}
            className="w-full text-left px-4 py-3 hover:bg-purple-50 disabled:opacity-50 transition flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-stone-900 truncate">
                {c.prenom} {c.nom}
                {c.societe && <span className="text-stone-500 font-normal"> · {c.societe}</span>}
              </div>
              <div className="text-xs text-stone-500 truncate">
                {c.email || '(sans email)'}
                {c.tel && ` · ${c.tel}`}
              </div>
            </div>
            {linking === c.id ? (
              <span className="inline-block w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Link2 className="w-4 h-4 text-purple-500" />
            )}
          </button>
        ))}
      </div>

      <div className="text-xs text-stone-400 italic">
        ⚠️ L'ancienne adresse email du client sera écrasée par {fromEmail}.
      </div>

      <div className="flex justify-end pt-2 border-t border-stone-100">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Mini-composant : Field
// ─────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
