'use client';
import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Clock, Mail, X, Check, Loader2, AlertCircle, Trash2, Edit2, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, isAdmin } from '@/lib/auth';
import AvatarUpload from './AvatarUpload';

export default function TeamTab() {
  const { profile: currentProfile, refreshProfile } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    setMembers(data || []);
    setLoading(false);
  }

  const deleteMember = async (member) => {
    if (!confirm(`Supprimer ${member.prenom} ${member.nom} ? Il n'aura plus accès au CRM.`)) return;
    // On désactive plutôt que supprimer (pour préserver la traçabilité des données créées)
    await supabase.from('profiles').update({ actif: false }).eq('id', member.id);
    loadMembers();
  };

  const reactivateMember = async (id) => {
    await supabase.from('profiles').update({ actif: true }).eq('id', id);
    loadMembers();
  };

  const formatLastSeen = (ts) => {
    if (!ts) return 'Jamais';
    const diff = (Date.now() - new Date(ts).getTime()) / 1000 / 60;
    if (diff < 5) return "À l'instant";
    if (diff < 60) return `Il y a ${Math.floor(diff)} min`;
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)}h`;
    return `Il y a ${Math.floor(diff / 1440)}j`;
  };

  const userIsAdmin = isAdmin(currentProfile);

  // Quelqu'un peut éditer un membre si :
  //  - c'est lui-même, OU
  //  - c'est un admin (TE/TB)
  const canEdit = (member) => member.id === currentProfile?.id || userIsAdmin;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-1">Équipe</h1>
          <p className="text-sage-dark text-sm">
            {userIsAdmin ? "Gérer les membres de l'agence ayant accès au CRM" : "Membres de l'agence"}
          </p>
        </div>
        {userIsAdmin && (
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-ink text-sm font-medium">
            <UserPlus className="w-4 h-4" /> Inviter un collègue
          </button>
        )}
      </div>

      {!userIsAdmin && (
        <div className="bg-cream-50 border border-cream-dark rounded-lg p-3 text-xs text-ink/70 mb-4 flex items-start gap-2">
          <Shield className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
          <div>
            Seuls les administrateurs peuvent inviter ou désactiver des membres. Tu peux modifier ta propre fiche en cliquant sur l'icône ✏️ à côté de ton nom.
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-ink/60">Chargement…</div>
      ) : (
        <div className="bg-white rounded-xl border border-cream-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/70">Membre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/70">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/70">Tél.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/70">Rôle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/70">Fonction</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/70">Connexion</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/70">État</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-t border-cream hover:bg-cream-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-medium text-white flex-shrink-0 ${m.actif ? 'gradient-sage-dark' : 'bg-stone-400'}`}>
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{(m.prenom?.[0] || '?')}{(m.nom?.[0] || '')}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-ink">{m.prenom} {m.nom}</div>
                          {m.id === currentProfile?.id && <div className="text-[10px] text-sage-dark">(vous)</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/70 text-xs">{m.email}</td>
                    <td className="px-4 py-3 text-ink/70 text-xs">
                      {m.telephone ? (
                        <a href={`tel:${m.telephone}`} className="hover:text-sage-dark flex items-center gap-1">
                          <Phone className="w-3 h-3" />{m.telephone}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.role === 'Admin' ? 'bg-sage-50 text-sage-darker border border-sage-light' : 'bg-cream-100 text-ink/70'
                      }`}>
                        {m.role === 'Admin' && <Shield className="w-3 h-3 inline mr-0.5" />}
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/70 text-xs">{m.fonction || '—'}</td>
                    <td className="px-4 py-3 text-ink/60 text-xs">
                      <Clock className="w-3 h-3 inline mr-1" />{formatLastSeen(m.last_seen)}
                    </td>
                    <td className="px-4 py-3">
                      {m.actif ? (
                        <span className="text-xs bg-sage-50 text-sage-dark px-2 py-0.5 rounded-full">Actif</span>
                      ) : (
                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Désactivé</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {canEdit(m) && (
                          <button onClick={() => setEditing(m)} className="p-1 text-ink/60 hover:text-sage-dark" title="Modifier">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {userIsAdmin && m.id !== currentProfile?.id && (m.actif ? (
                          <button onClick={() => deleteMember(m)} className="p-1 text-ink/60 hover:text-red-600" title="Désactiver">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => reactivateMember(m.id)} className="p-1 text-sage-dark hover:underline text-xs" title="Réactiver">
                            Réactiver
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteForm onClose={() => setShowInvite(false)} onInvited={() => { setShowInvite(false); loadMembers(); }} />
      )}

      {editing && (
        <EditMemberForm
          member={editing}
          isAdminEditing={userIsAdmin && editing.id !== currentProfile?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            const wasMyself = editing.id === currentProfile?.id;
            setEditing(null);
            loadMembers();
            if (wasMyself) refreshProfile?.();
          }}
        />
      )}
    </div>
  );
}

function InviteForm({ onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [role, setRole] = useState('Commercial');
  const [fonction, setFonction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ email, prenom, nom, role, fonction })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur inconnue');

      setSuccess(true);
      setTimeout(() => onInvited(), 1500);
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
          <h2 className="font-display text-xl font-semibold text-ink">Inviter un collègue</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mx-5 mt-4 p-3 bg-sage-50 border border-sage-light rounded-lg text-sm text-sage-darker flex items-start gap-2">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-sage-dark" />
            <div>Invitation envoyée par email !</div>
          </div>
        )}

        <form onSubmit={handleInvite} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-ink/70 block mb-1">Email professionnel</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              placeholder="prenom.nom@immeubles-patrimoine.fr"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink/70 block mb-1">Prénom</label>
              <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} required
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
            </div>
            <div>
              <label className="text-xs text-ink/70 block mb-1">Nom</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)} required
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Fonction</label>
            <input type="text" value={fonction} onChange={e => setFonction(e.target.value)}
              placeholder="ex : Directeur commercial - Vente en bloc"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage">
              <option>Commercial</option>
              <option>Admin</option>
            </select>
            <p className="text-[10px] text-ink/50 mt-1">Admin = peut inviter d'autres membres. Commercial = accès complet aux données, mais pas à la gestion d'équipe.</p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading || success}
              className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50 flex items-center gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Envoyer l'invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal d'édition d'un membre.
 * - isAdminEditing : true si l'admin édite quelqu'un d'autre (autorise modif rôle)
 * - Sinon (édition de soi) : pas de modif rôle, mais photo + tél + fonction OK
 */
function EditMemberForm({ member, isAdminEditing = false, onClose, onSaved }) {
  const [prenom, setPrenom] = useState(member.prenom || '');
  const [nom, setNom] = useState(member.nom || '');
  const [role, setRole] = useState(member.role || 'Commercial');
  const [fonction, setFonction] = useState(member.fonction || '');
  const [telephone, setTelephone] = useState(member.telephone || '');
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const updates = { prenom, nom, fonction, telephone };
      if (isAdminEditing) updates.role = role;
      const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', member.id);
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-white z-10">
          <h2 className="font-display text-xl font-semibold text-ink">
            {isAdminEditing ? `Modifier ${member.prenom} ${member.nom}` : 'Modifier ma fiche'}
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Avatar */}
          <div className="flex justify-center pb-2 border-b border-cream-dark">
            <AvatarUpload
              profileId={member.id}
              currentUrl={avatarUrl}
              prenom={prenom}
              nom={nom}
              size="lg"
              onUploaded={(url) => setAvatarUrl(url)}
              onRemoved={() => setAvatarUrl(null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink/70 block mb-1">Prénom</label>
              <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} required
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
            </div>
            <div>
              <label className="text-xs text-ink/70 block mb-1">Nom</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)} required
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
            </div>
          </div>

          <div>
            <label className="text-xs text-ink/70 block mb-1">Téléphone</label>
            <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
              placeholder="06.12.34.56.78"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </div>

          <div>
            <label className="text-xs text-ink/70 block mb-1">Fonction</label>
            <input type="text" value={fonction} onChange={e => setFonction(e.target.value)}
              placeholder="ex : Directeur commercial"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </div>

          {isAdminEditing && (
            <div>
              <label className="text-xs text-ink/70 block mb-1">Rôle</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage">
                <option>Commercial</option>
                <option>Admin</option>
              </select>
            </div>
          )}

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
