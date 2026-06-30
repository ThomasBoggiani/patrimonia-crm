'use client';
import React, { useState, useEffect } from 'react';
import { Mail, Calendar, Users as UsersIcon, Check, X, Loader2, AlertCircle, Link as LinkIcon, Unlink, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function IntegrationsTab() {
  const { user } = useAuth();
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  // Dropbox
  const [dropbox, setDropbox] = useState(null);
  const [dropboxActionLoading, setDropboxActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadIntegration();
    loadDropbox();

    // Lire les query params (success/error après redirect OAuth)
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'microsoft') {
      setMessage({ type: 'success', text: 'Microsoft 365 connecté avec succès !' });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => loadIntegration(), 500);
    } else if (params.get('dropbox') === 'connected') {
      setMessage({ type: 'success', text: 'Dropbox connecté avec succès !' });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => loadDropbox(), 500);
    } else if (params.get('dropbox') === 'config') {
      setMessage({ type: 'error', text: 'Dropbox : configuration manquante côté serveur (clés non définies).' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('dropbox') === 'error') {
      setMessage({ type: 'error', text: 'Erreur de connexion Dropbox. Réessaie.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      setMessage({ type: 'error', text: `Erreur de connexion : ${params.get('error')}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  async function loadIntegration() {
    setLoading(true);
    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();
    setIntegration(data);
    setLoading(false);
  }

  async function loadDropbox() {
    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'dropbox')
      .maybeSingle();
    setDropbox(data);
  }

  async function handleDropboxConnect() {
    setDropboxActionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    window.location.href = `/api/dropbox/connect?token=${session.access_token}`;
  }

  async function handleDropboxDisconnect() {
    if (!confirm('Déconnecter Dropbox ? L\'import de dossiers par compte ne sera plus disponible.')) return;
    setDropboxActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/dropbox/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Erreur lors de la déconnexion');
      setDropbox(null);
      setMessage({ type: 'success', text: 'Dropbox déconnecté' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setDropboxActionLoading(false);
    }
  }

  async function handleConnect() {
    setActionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    // Rediriger vers l'endpoint qui va lui-même rediriger vers Microsoft
    window.location.href = `/api/microsoft/connect?token=${session.access_token}`;
  }

  async function handleDisconnect() {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter Microsoft 365 ? Vos données Outlook ne seront plus synchronisées.')) return;
    
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/microsoft/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!res.ok) throw new Error('Erreur lors de la déconnexion');
      
      setIntegration(null);
      setMessage({ type: 'success', text: 'Microsoft 365 déconnecté' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-1">Intégrations</h1>
        <p className="text-sage-dark text-sm md:text-base">Connectez vos outils externes pour fluidifier votre travail</p>
      </div>

      {/* Message de feedback */}
      {message && (
        <div className={`mb-6 p-3 rounded-lg flex items-start gap-2 text-sm ${
          message.type === 'success' 
            ? 'bg-sage-50 border border-sage-light text-sage-darker' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <div className="flex-1">{message.text}</div>
          <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Card Microsoft 365 */}
      <div className="bg-white border border-cream-dark rounded-xl shadow-luxe overflow-hidden">
        <div className="p-5 md:p-6 border-b border-cream-dark">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-lg md:text-xl font-semibold text-ink mb-1">Microsoft 365 / Outlook</h2>
                <p className="text-sm text-ink/70">Synchronisez votre agenda, vos emails et vos contacts</p>
              </div>
            </div>
            
            {!loading && integration && (
              <span className="text-xs px-2 py-1 bg-sage-50 text-sage-darker border border-sage-light rounded-full font-medium flex items-center gap-1 flex-shrink-0">
                <Check className="w-3 h-3" /> Connecté
              </span>
            )}
          </div>
        </div>

        <div className="p-5 md:p-6">
          {loading ? (
            <div className="text-center py-4 text-ink/60 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : integration ? (
            <div className="space-y-4">
              {/* Compte connecté */}
              <div className="bg-cream-50 rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-wider text-sage-dark mb-1">Compte connecté</div>
                <div className="font-medium text-ink">{integration.account_name}</div>
                <div className="text-sm text-ink/70">{integration.account_email}</div>
                <div className="text-[10px] text-ink/50 mt-2">
                  Connecté le {new Date(integration.connected_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Permissions actives */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-sage-dark mb-2">Synchronisation active</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border border-cream-dark rounded-lg text-sm">
                    <Calendar className="w-4 h-4 text-sage-dark" />
                    <span className="text-ink/80">Agenda</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border border-cream-dark rounded-lg text-sm">
                    <Mail className="w-4 h-4 text-sage-dark" />
                    <span className="text-ink/80">Emails</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border border-cream-dark rounded-lg text-sm">
                    <UsersIcon className="w-4 h-4 text-sage-dark" />
                    <span className="text-ink/80">Contacts</span>
                  </div>
                </div>
              </div>

              {/* Bouton déconnecter */}
              <div className="pt-2">
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  Déconnecter Microsoft 365
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink/70">
                Connectez votre compte Microsoft 365 professionnel pour :
              </p>
              <ul className="space-y-1.5 text-sm text-ink/80">
                <li className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
                  <span>Synchronisation bidirectionnelle de l'agenda Outlook avec le CRM</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
                  <span>Lecture des emails reçus directement dans la fiche client</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
                  <span>Envoi d'emails depuis le CRM avec templates personnalisés</span>
                </li>
                <li className="flex items-start gap-2">
                  <UsersIcon className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
                  <span>Synchronisation des contacts CRM ↔ Outlook</span>
                </li>
              </ul>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Sécurisé :</strong> votre token est stocké de façon chiffrée. Aucun mot de passe n'est conservé. Vous pouvez révoquer l'accès à tout moment.
                </div>
              </div>

              <button
                onClick={handleConnect}
                disabled={actionLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-ink-deep text-white rounded-lg text-sm font-medium hover:bg-ink disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                Connecter Microsoft 365
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Dropbox */}
      <div className="mt-6 bg-white border border-cream-dark rounded-xl shadow-luxe overflow-hidden">
        <div className="p-5 md:p-6 border-b border-cream-dark">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 2 0 6l6 4 6-4-6-4Zm12 0-6 4 6 4 6-4-6-4ZM0 14l6 4 6-4-6-4-6 4Zm18-4-6 4 6 4 6-4-6-4ZM6 19.5l6 4 6-4-6-4-6 4Z" fill="#0061FF"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-lg md:text-xl font-semibold text-ink mb-1">Dropbox</h2>
                <p className="text-sm text-ink/70">Importez un dossier complet (n'importe quelle taille) pour créer un mandat</p>
              </div>
            </div>
            {dropbox && (
              <span className="text-xs px-2 py-1 bg-sage-50 text-sage-darker border border-sage-light rounded-full font-medium flex items-center gap-1 flex-shrink-0">
                <Check className="w-3 h-3" /> Connecté
              </span>
            )}
          </div>
        </div>

        <div className="p-5 md:p-6">
          {dropbox ? (
            <div className="space-y-4">
              <div className="bg-cream-50 rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-wider text-sage-dark mb-1">Compte connecté</div>
                <div className="font-medium text-ink">{dropbox.account_name || 'Compte Dropbox'}</div>
                {dropbox.account_email && <div className="text-sm text-ink/70">{dropbox.account_email}</div>}
                <div className="text-[10px] text-ink/50 mt-2">
                  Connecté le {new Date(dropbox.connected_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="text-sm text-ink/70">
                Tu peux maintenant coller un lien de dossier Dropbox à la création d'un mandat : l'appli récupère les fichiers un par un, sans limite de taille.
              </div>
              <div className="pt-2">
                <button
                  onClick={handleDropboxDisconnect}
                  disabled={dropboxActionLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {dropboxActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  Déconnecter Dropbox
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink/70">Connectez votre compte Dropbox pour :</p>
              <ul className="space-y-1.5 text-sm text-ink/80">
                <li className="flex items-start gap-2">
                  <LinkIcon className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
                  <span>Importer un dossier entier (mandat, DPE, diagnostics, photos…) en collant son lien</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
                  <span>Sans limite de taille (fichiers récupérés un par un)</span>
                </li>
              </ul>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div><strong>Sécurisé :</strong> accès en lecture seule. Vous pouvez révoquer à tout moment.</div>
              </div>
              <button
                onClick={handleDropboxConnect}
                disabled={dropboxActionLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-ink-deep text-white rounded-lg text-sm font-medium hover:bg-ink disabled:opacity-50"
              >
                {dropboxActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                Connecter Dropbox
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
