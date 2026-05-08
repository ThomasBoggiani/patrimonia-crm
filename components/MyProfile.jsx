'use client';
import React, { useState, useEffect } from 'react';
import {
  User, TrendingUp, Building2, CheckSquare, Users as UsersIcon,
  Save, Loader2, Phone, Mail, Briefcase, Lock,
  Link2, Copy, ExternalLink, Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import AvatarUpload from './AvatarUpload';

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

  const isManager = profile.role === 'admin'
    || (profile.prenom === 'Thomas' && (profile.nom === 'Ezquerra' || profile.nom === 'Boggiani'));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-1">Ma fiche</h1>
        <p className="text-sage-dark text-sm">Gérer mes informations, mon lien questionnaire, ma rémunération et mes raccourcis</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-cream-dark overflow-x-auto">
        <TabButton active={tab === 'profil'} onClick={() => setTab('profil')} icon={User} label="Profil" />
        <TabButton active={tab === 'questionnaire'} onClick={() => setTab('questionnaire')} icon={Link2} label="Mon questionnaire" />
        <TabButton active={tab === 'remuneration'} onClick={() => setTab('remuneration')} icon={TrendingUp} label="Ma rémunération" />
        <TabButton active={tab === 'signature'} onClick={() => setTab('signature')} icon={Mail} label="Ma signature" />
      </div>

      {tab === 'profil' && (
        <ProfileEditor profile={profile} userId={user?.id} onSaved={refreshProfile} />
      )}

      {tab === 'questionnaire' && (
        <QuestionnaireSection profile={profile} isManager={isManager} allProfiles={allProfiles} />
      )}

      {tab === 'remuneration' && RemunerationComponent && (
        <RemunerationComponent mandats={mandats} allProfiles={allProfiles} />
      )}

      {tab === 'signature' && (
        <div className="bg-white rounded-xl border border-cream-dark p-6">
          <h2 className="font-display text-xl font-semibold text-ink mb-2">Ma signature email</h2>
          <p className="text-sm text-ink/60 mb-4">
            Aperçu et copie de ta signature email avec ton lien questionnaire personnel.
          </p>
          <a
            href="/signature"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink"
          >
            <ExternalLink className="w-4 h-4" />
            Ouvrir ma signature
          </a>
        </div>
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

// ─────────────────────────────────────────────────────────
// Section "Mon questionnaire" — token + lien copiable + stats
// ─────────────────────────────────────────────────────────
function QuestionnaireSection({ profile, isManager, allProfiles }) {
  const [stats, setStats] = useState({ total: 0, lastSubmittedAt: null });
  const [allTokens, setAllTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://patrimonia-crm.vercel.app';

  useEffect(() => {
    (async () => {
      // Stats du user connecté
      const { data: mySubmissions } = await supabase
        .from('questionnaires')
        .select('id, created_at, statut')
        .eq('profile_id', profile.id)
        .eq('statut', 'Complété')
        .order('created_at', { ascending: false });
      const total = mySubmissions?.length || 0;
      const lastSubmittedAt = mySubmissions?.[0]?.created_at || null;
      setStats({ total, lastSubmittedAt });

      // Si manager : récupère les tokens de toute l'équipe
      if (isManager) {
        const { data: profilesWithTokens } = await supabase
          .from('profiles')
          .select('id, prenom, nom, questionnaire_token, fonction')
          .not('questionnaire_token', 'is', null)
          .neq('id', profile.id)
          .order('prenom');

        // Pour chaque collègue, compter ses soumissions
        const enriched = await Promise.all((profilesWithTokens || []).map(async p => {
          const { count } = await supabase
            .from('questionnaires')
            .select('id', { count: 'exact', head: true })
            .eq('profile_id', p.id)
            .eq('statut', 'Complété');
          return { ...p, nbSubmissions: count || 0 };
        }));

        setAllTokens(enriched);
      }
      setLoading(false);
    })();
  }, [profile.id, isManager]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-cream-dark p-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-sage-dark mx-auto" />
      </div>
    );
  }

  if (!profile.questionnaire_token) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
        Vous n'avez pas encore de token de questionnaire. Contactez un admin pour qu'il en génère un.
      </div>
    );
  }

  const myLink = `${baseUrl}/q/${profile.questionnaire_token}`;

  return (
    <div className="space-y-6">
      {/* Mon lien */}
      <div className="bg-white rounded-xl border border-cream-dark p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink mb-1">Mon lien questionnaire</h2>
            <p className="text-xs text-ink/60">
              Ce lien est <strong>permanent</strong> et personnel. Mets-le dans ta signature email, sur LinkedIn, sur tes cartes de visite. Toutes les soumissions atterrissent dans ton CRM.
            </p>
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <div className="text-3xl font-display font-semibold text-sage-darker">{stats.total}</div>
            <div className="text-xs text-ink/60">soumission{stats.total > 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="bg-cream-50 rounded-lg p-3 mb-4 break-all font-mono text-sm text-ink">
          {myLink}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(myLink);
              // Petit toast visuel
              const btn = document.activeElement;
              if (btn) {
                const original = btn.textContent;
                btn.textContent = '✓ Copié !';
                setTimeout(() => { btn.textContent = original; }, 1500);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink"
          >
            <Copy className="w-3.5 h-3.5" /> Copier le lien
          </button>
          <a
            href={myLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-cream-dark text-ink rounded-lg text-sm hover:bg-cream-50"
          >
            <Eye className="w-3.5 h-3.5" /> Aperçu
          </a>
          <a
            href="/signature"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-cream-dark text-ink rounded-lg text-sm hover:bg-cream-50"
          >
            <Mail className="w-3.5 h-3.5" /> Ma signature email
          </a>
        </div>

        {stats.lastSubmittedAt && (
          <div className="mt-4 pt-4 border-t border-cream text-xs text-ink/60">
            Dernière soumission : {new Date(stats.lastSubmittedAt).toLocaleString('fr-FR')}
          </div>
        )}
      </div>

      {/* Liens de l'équipe (managers seulement) */}
      {isManager && allTokens.length > 0 && (
        <div className="bg-white rounded-xl border border-cream-dark p-6">
          <h2 className="font-display text-xl font-semibold text-ink mb-4">
            Liens de l'équipe <span className="text-sm font-normal text-ink/50">({allTokens.length})</span>
          </h2>
          <div className="space-y-2">
            {allTokens.map(p => {
              const link = `${baseUrl}/q/${p.questionnaire_token}`;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 border border-cream rounded-lg hover:bg-cream-50">
                  <div className="flex-shrink-0 w-9 h-9 bg-sage-50 rounded-full flex items-center justify-center text-sage-darker font-medium text-sm">
                    {p.prenom?.[0]}{p.nom?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-ink">
                      {p.prenom} {p.nom}
                      {p.fonction && <span className="text-xs text-ink/50 font-normal ml-2">{p.fonction}</span>}
                    </div>
                    <div className="text-xs text-ink/50 truncate font-mono">{link}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-ink">{p.nbSubmissions}</div>
                    <div className="text-[10px] text-ink/50">soumission{p.nbSubmissions > 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(link)}
                    className="p-2 text-ink/60 hover:text-sage-dark hover:bg-cream-100 rounded"
                    title="Copier le lien"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-ink/60 hover:text-sage-dark hover:bg-cream-100 rounded"
                    title="Aperçu"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ProfileEditor (inchangé)
// ─────────────────────────────────────────────────────────
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
