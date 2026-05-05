'use client';
import React, { useState, useEffect } from 'react';
import { User, TrendingUp, Building2, CheckSquare, Users as UsersIcon, Save, Loader2, Phone, Mail, Briefcase, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import AvatarUpload from './AvatarUpload';

/**
 * Page "Ma fiche" — espace personnel de l'utilisateur connecté.
 * 3 sous-onglets :
 *  - Profil : édition de ses infos perso (nom, prénom, fonction, tél, email, photo)
 *  - Rémunération : sa propre rémunération (composant RemunerationTab passé en prop)
 *  - Raccourcis : liens vers ses mandats / tâches / clients
 */
export default function MyProfile({ mandats = [], todos = [], clients = [], allProfiles = [], RemunerationComponent, onNavigate }) {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState('profil');

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-sage-dark mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-1">Ma fiche</h1>
        <p className="text-sage-dark text-sm">Gérer mes informations personnelles, ma rémunération et mes raccourcis</p>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 mb-6 border-b border-cream-dark overflow-x-auto">
        <TabButton active={tab === 'profil'} onClick={() => setTab('profil')} icon={User} label="Profil" />
        <TabButton active={tab === 'remuneration'} onClick={() => setTab('remuneration')} icon={TrendingUp} label="Ma rémunération" />
        <TabButton active={tab === 'raccourcis'} onClick={() => setTab('raccourcis')} icon={Building2} label="Mes raccourcis" />
      </div>

      {tab === 'profil' && (
        <ProfileEditor profile={profile} userId={user?.id} onSaved={refreshProfile} />
      )}

      {tab === 'remuneration' && RemunerationComponent && (
        <RemunerationComponent mandats={mandats} allProfiles={allProfiles} />
      )}

      {tab === 'raccourcis' && (
        <Shortcuts profile={profile} mandats={mandats} todos={todos} clients={clients} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-sage-dark text-sage-darker'
          : 'border-transparent text-ink/60 hover:text-ink hover:border-cream-dark'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Formulaire d'édition du profil (nom, prénom, fonction, tél, email, photo).
 * Utilisé dans MyProfile (édition de soi).
 */
export function ProfileEditor({ profile, userId, onSaved, allowRoleEdit = false }) {
  const [prenom, setPrenom] = useState(profile.prenom || '');
  const [nom, setNom] = useState(profile.nom || '');
  const [email, setEmail] = useState(profile.email || '');
  const [telephone, setTelephone] = useState(profile.telephone || '');
  const [fonction, setFonction] = useState(profile.fonction || '');
  const [role, setRole] = useState(profile.role || 'Commercial');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  // Resynchroniser si le profile change (ex : refreshProfile après upload avatar)
  useEffect(() => {
    setAvatarUrl(profile.avatar_url || null);
  }, [profile.avatar_url]);

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updates = { prenom, nom, telephone, fonction };
      if (allowRoleEdit) updates.role = role;
      // L'email n'est pas modifié ici (changement d'email = via Supabase Auth)

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setSavedAt(Date.now());
      onSaved?.();
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-cream-dark p-6 md:p-8">
      <div className="flex flex-col md:flex-row gap-8 mb-8">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <AvatarUpload
            profileId={profile.id}
            currentUrl={avatarUrl}
            prenom={prenom}
            nom={nom}
            size="xl"
            onUploaded={(url) => { setAvatarUrl(url); onSaved?.(); }}
            onRemoved={() => { setAvatarUrl(null); onSaved?.(); }}
          />
        </div>

        {/* Champs */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Prénom" required>
            <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} required
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </Field>
          <Field label="Nom" required>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)} required
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </Field>
          <Field label="Email" icon={Mail}>
            <input type="email" value={email} disabled
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm bg-cream-50 text-ink/60" />
            <div className="text-[10px] text-ink/50 mt-1 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> L'email est lié au compte. Contacte un admin pour le changer.
            </div>
          </Field>
          <Field label="Téléphone" icon={Phone}>
            <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
              placeholder="06.12.34.56.78"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </Field>
          <Field label="Fonction" icon={Briefcase} className="md:col-span-2">
            <input type="text" value={fonction} onChange={e => setFonction(e.target.value)}
              placeholder="ex : Directeur du développement"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
          </Field>
          {allowRoleEdit && (
            <Field label="Rôle">
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage">
                <option>Commercial</option>
                <option>Admin</option>
              </select>
            </Field>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-dark">
        {savedAt && (
          <span className="text-xs text-sage-dark">✓ Enregistré</span>
        )}
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
    </form>
  );
}

function Field({ label, icon: Icon, required, className = '', children }) {
  return (
    <div className={className}>
      <label className="text-xs text-ink/70 mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        <span>{label}{required && <span className="text-red-500">*</span>}</span>
      </label>
      {children}
    </div>
  );
}

function Shortcuts({ profile, mandats, todos, clients, onNavigate }) {
  const myMandats = mandats.filter(m => m.pourvoyeurId === profile.id || m.vendeurId === profile.id);
  const myTodos = todos.filter(t => t.assigned_to_user_id === profile.id);
  const myActiveTodos = myTodos.filter(t => t.statut !== 'Fait');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ShortcutCard
        icon={Building2}
        label="Mes mandats"
        count={myMandats.length}
        sub={`${myMandats.filter(m => m.statut !== 'Acte' && m.statut !== 'Perdu' && m.statut !== 'Vendu par autres').length} en cours`}
        onClick={() => onNavigate?.('mandats')}
      />
      <ShortcutCard
        icon={CheckSquare}
        label="Mes tâches"
        count={myActiveTodos.length}
        sub={`${myTodos.length} au total`}
        onClick={() => onNavigate?.('todos')}
      />
      <ShortcutCard
        icon={UsersIcon}
        label="Tous mes clients"
        count={clients.length}
        sub="Voir l'annuaire"
        onClick={() => onNavigate?.('clients')}
      />
    </div>
  );
}

function ShortcutCard({ icon: Icon, label, count, sub, onClick }) {
  return (
    <button onClick={onClick} className="bg-white rounded-xl border border-cream-dark p-5 text-left hover:border-sage hover:shadow-luxe transition-all">
      <div className="flex items-start justify-between mb-2">
        <Icon className="w-5 h-5 text-sage-dark" />
        <span className="text-2xl font-display font-semibold text-ink">{count}</span>
      </div>
      <div className="font-medium text-ink text-sm">{label}</div>
      <div className="text-xs text-ink/60 mt-0.5">{sub}</div>
    </button>
  );
}
