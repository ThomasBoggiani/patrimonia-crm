'use client';
import React, { useState, useEffect, useMemo } from 'react';
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

  const isManager = profile.role === 'Admin'
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
        <EmailSignatureEditor profile={profile} onSaved={refreshProfile} />
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
      const { data: mySubmissions } = await supabase
        .from('questionnaires')
        .select('id, created_at, statut')
        .eq('profile_id', profile.id)
        .eq('statut', 'Complété')
        .order('created_at', { ascending: false });
      const total = mySubmissions?.length || 0;
      const lastSubmittedAt = mySubmissions?.[0]?.created_at || null;
      setStats({ total, lastSubmittedAt });

      if (isManager) {
        const { data: profilesWithTokens } = await supabase
          .from('profiles')
          .select('id, prenom, nom, questionnaire_token, fonction')
          .not('questionnaire_token', 'is', null)
          .neq('id', profile.id)
          .order('prenom');

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
        </div>

        {stats.lastSubmittedAt && (
          <div className="mt-4 pt-4 border-t border-cream text-xs text-ink/60">
            Dernière soumission : {new Date(stats.lastSubmittedAt).toLocaleString('fr-FR')}
          </div>
        )}
      </div>

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

// ─────────────────────────────────────────────────────────
// EmailSignatureEditor V3 - Générateur automatique avec preview live
// ─────────────────────────────────────────────────────────

const BASE_URL_PROD = 'https://patrimonia-crm.vercel.app';
const LOGO_URL = `${BASE_URL_PROD}/logo-light.png`;

function buildSignatureHtml({ prenom, nom, fonction, telephone, email, questionnaireToken, includeCta }) {
  const baseUrl = BASE_URL_PROD;
  const ctaLink = questionnaireToken ? `${baseUrl}/q/${questionnaireToken}` : '#';

  // HTML inline-styles pour compatibilité maximale clients mail
  const wrapperStyle = "font-family: Georgia, 'Times New Roman', serif; color: #1c1c1c; font-size: 14px; line-height: 1.5; max-width: 600px;";
  const tableStyle = "border-collapse: collapse; max-width: 600px;";
  const logoCellStyle = "vertical-align: top; padding-right: 20px; width: 120px;";
  const textCellStyle = "vertical-align: top; border-left: 2px solid #5d6e5d; padding-left: 20px;";
  const nameStyle = "font-size: 19px; font-weight: bold; margin: 0; color: #1c1c1c;";
  const titleStyle = "font-style: italic; color: #444; margin: 4px 0 14px 0; font-size: 14px;";
  const contactStyle = "font-size: 13px; color: #333; margin: 3px 0;";
  const companyBlockStyle = "margin-top: 12px;";
  const companyNameStyle = "font-weight: bold; color: #5d6e5d; font-size: 14px;";
  const companyAddrStyle = "font-size: 13px; color: #555; margin-top: 2px;";
  const ctaBarStyle = "margin-top: 18px; background: #faf9f5; border: 1px solid #5d6e5d; padding: 14px 20px; border-radius: 6px; font-size: 13px;";
  const ctaTitleStyle = "display: block; margin-bottom: 6px; color: #1c1c1c; font-weight: bold;";
  const ctaLinkStyle = "color: #5d6e5d; text-decoration: none; font-weight: 600; border-bottom: 1px solid #5d6e5d;";

  const cta = includeCta && questionnaireToken ? `
<div style="${ctaBarStyle}">
  <strong style="${ctaTitleStyle}">Vous cherchez à investir dans le patrimonial ?</strong>
  <a href="${ctaLink}" style="${ctaLinkStyle}">Définissons votre profil en 3 minutes <span style="color: #5d6e5d;">→</span></a>
</div>` : '';

  return `<div style="${wrapperStyle}">
<table cellpadding="0" cellspacing="0" border="0" style="${tableStyle}">
  <tr>
    <td style="${logoCellStyle}">
      <a href="https://www.immeubles-patrimoine.fr/" title="notre site"><img src="${LOGO_URL}" alt="Immeubles & Patrimoine" width="120" height="120" style="display: block; border-radius: 4px; border: 0;"></a>
    </td>
    <td style="${textCellStyle}">
      <p style="${nameStyle}">${prenom || ''} ${nom || ''}</p>
      <p style="${titleStyle}">${fonction || ''}</p>
      <p style="${contactStyle}">${telephone || ''}</p>
      <p style="${contactStyle}">${email || ''}</p>
      <div style="${companyBlockStyle}">
        <div style="${companyNameStyle}">Immeubles &amp; Patrimoine</div>
        <div style="${companyAddrStyle}">7 rue de Penthièvre · 75008 Paris</div>
      </div>
    </td>
  </tr>
</table>
${cta}
</div>`;
}

function EmailSignatureEditor({ profile, onSaved }) {
  // Champs éditables (peuvent diverger du profile principal si besoin)
  const [telephone, setTelephone] = useState(profile.telephone || '');
  const [fonction, setFonction] = useState(profile.fonction || '');
  const [includeCta, setIncludeCta] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  const signatureHtml = useMemo(() => buildSignatureHtml({
    prenom: profile.prenom,
    nom: profile.nom,
    fonction,
    telephone,
    email: profile.email,
    questionnaireToken: profile.questionnaire_token,
    includeCta
  }), [profile.prenom, profile.nom, profile.email, profile.questionnaire_token, fonction, telephone, includeCta]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // On enregistre le HTML généré dans email_signature
      // ET on met à jour telephone et fonction du profile si modifiés
      const updates = {
        email_signature: signatureHtml,
        telephone,
        fonction
      };
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
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-cream-dark p-6">
        <div className="mb-4">
          <h2 className="font-display text-xl font-semibold text-ink mb-1">Ma signature email</h2>
          <p className="text-sm text-ink/60">
            Ta signature est générée automatiquement à partir de ton profil. Elle est ajoutée à la fin des emails envoyés par l'Assistant Patrimonia.
          </p>
        </div>

        {/* Champs éditables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Field label="Téléphone affiché" icon={Phone}>
            <input
              type="tel"
              value={telephone}
              onChange={e => setTelephone(e.target.value)}
              placeholder="06 63 64 94 43"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage"
            />
          </Field>
          <Field label="Fonction" icon={Briefcase}>
            <input
              type="text"
              value={fonction}
              onChange={e => setFonction(e.target.value)}
              placeholder="Directeur du développement"
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage"
            />
          </Field>
        </div>

        {/* Toggle CTA */}
        <div className="mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCta}
              onChange={e => setIncludeCta(e.target.checked)}
              className="w-4 h-4 accent-sage-dark"
            />
            <span className="text-sm text-ink">Inclure l'encart questionnaire (CTA)</span>
          </label>
          {!profile.questionnaire_token && includeCta && (
            <p className="text-xs text-amber-700 mt-1 ml-6">⚠️ Pas de token questionnaire — l'encart ne sera pas affiché.</p>
          )}
        </div>

        {/* Preview live */}
        <div className="mb-5">
          <label className="text-xs text-ink/70 mb-2 block">Aperçu</label>
          <div className="border border-cream-dark rounded-lg p-4 bg-cream-50">
            <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-dark">
          {savedAt && (
            <span className="text-xs text-sage-dark">✓ Signature enregistrée</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer la signature
          </button>
        </div>
      </div>
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
