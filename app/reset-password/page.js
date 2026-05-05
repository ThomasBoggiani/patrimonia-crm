'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Type de flow détecté depuis l'URL : 'invite', 'recovery', ou null
  const [flowType, setFlowType] = useState(null);
  // True quand on a confirmé qu'une session valide est en place
  const [sessionReady, setSessionReady] = useState(false);
  // True tant qu'on attend la détection du token
  const [checking, setChecking] = useState(true);
  // Email/prénom récupérés depuis user metadata pour personnaliser
  const [userInfo, setUserInfo] = useState({ email: '', prenom: '' });

  useEffect(() => {
    // ─── 1. Lire le hash de l'URL pour identifier le type de flow ────
    // Supabase envoie #access_token=...&refresh_token=...&type=invite
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const type = params.get('type');
      if (type) setFlowType(type);

      // Si error_code dans le hash, l'afficher
      const errorDescription = params.get('error_description');
      if (errorDescription) {
        setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        setChecking(false);
        return;
      }
    }

    // ─── 2. Écouter les events Supabase pour savoir quand la session est prête ────
    let alreadyHandled = false;

    const handleSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        alreadyHandled = true;
        setSessionReady(true);
        setUserInfo({
          email: session.user.email || '',
          prenom: session.user.user_metadata?.prenom || ''
        });
        setChecking(false);
      }
    };

    // Check immédiat (au cas où la session est déjà chargée)
    handleSession();

    // Listener pour les events asynchrones (token traité après le mount)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (alreadyHandled) return;
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          alreadyHandled = true;
          setSessionReady(true);
          setUserInfo({
            email: session.user.email || '',
            prenom: session.user.user_metadata?.prenom || ''
          });
          setChecking(false);
        }
      }
    });

    // Timeout de sécurité : si après 3s aucune session n'est détectée, on arrête le spinner
    const timeout = setTimeout(() => {
      if (!alreadyHandled) {
        setChecking(false);
      }
    }, 3000);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères');

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }
  };

  const isInvite = flowType === 'invite';

  // ─── Affichage conditionnel selon le contexte ─────────────────────────
  const title = isInvite ? 'Bienvenue dans Patrimonia' : 'Nouveau mot de passe';
  const subtitle = isInvite
    ? 'Définissez votre mot de passe pour accéder au CRM'
    : "Choisissez un mot de passe d'au moins 8 caractères";
  const buttonLabel = isInvite ? 'Activer mon compte' : 'Mettre à jour';
  const successMsg = isInvite
    ? 'Compte activé ! Bienvenue dans Patrimonia.'
    : 'Mot de passe mis à jour ! Redirection en cours...';

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-light.png" alt="Immeubles & Patrimoine" className="w-40 h-40" />
        </div>

        <div className="bg-white rounded-2xl shadow-luxe border border-cream-dark p-8">
          {/* État de chargement initial : on attend la détection du token */}
          {checking && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-sage-dark mb-3" />
              <div className="text-sm text-ink/70">Vérification du lien…</div>
            </div>
          )}

          {/* Pas de session détectée + pas en train de checker = lien invalide ou expiré */}
          {!checking && !sessionReady && !error && (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h1 className="font-display text-lg font-semibold text-ink mb-2">Lien invalide ou expiré</h1>
              <p className="text-sm text-ink/70 mb-4">
                Ce lien ne semble plus valide. Demande à un administrateur de t'envoyer une nouvelle invitation, ou utilise "Mot de passe oublié" depuis la page de connexion.
              </p>
              <a href="/" className="inline-block text-sm text-sage-dark hover:underline">
                ← Retour à l'accueil
              </a>
            </div>
          )}

          {/* Erreur explicite (depuis le hash error_description) */}
          {!checking && error && !sessionReady && (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
              <h1 className="font-display text-lg font-semibold text-ink mb-2">Lien expiré</h1>
              <p className="text-sm text-ink/70 mb-4">{error}</p>
              <a href="/" className="inline-block text-sm text-sage-dark hover:underline">
                ← Retour à l'accueil
              </a>
            </div>
          )}

          {/* Session OK : on affiche le formulaire */}
          {!checking && sessionReady && (
            <>
              <div className="flex items-start gap-2 mb-1">
                {isInvite && <Sparkles className="w-5 h-5 text-sage-dark flex-shrink-0 mt-0.5" />}
                <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
              </div>
              <p className="text-sm text-sage-dark mb-6">{subtitle}</p>

              {/* Bandeau personnalisé si on a récupéré le prénom */}
              {isInvite && userInfo.prenom && (
                <div className="mb-5 p-3 bg-sage-50 border border-sage-light rounded-lg text-sm text-sage-darker">
                  Bonjour <strong>{userInfo.prenom}</strong> 👋<br />
                  Ton compte <span className="font-mono text-xs">{userInfo.email}</span> est prêt. Définis ton mot de passe pour commencer.
                </div>
              )}

              {error && (
                <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {success && (
                <div className="p-3 mb-4 bg-sage-50 border border-sage-light rounded-lg text-sm text-sage-darker flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-sage-dark" />
                  <div>{successMsg}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-sage-dark mb-1.5">
                    {isInvite ? 'Choisir un mot de passe' : 'Nouveau mot de passe'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Au moins 8 caractères" required autoFocus
                      className="w-full pl-10 pr-3 py-2.5 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-sage-dark mb-1.5">Confirmer</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Répétez le mot de passe" required
                      className="w-full pl-10 pr-3 py-2.5 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage" />
                  </div>
                </div>
                <button type="submit" disabled={loading || success}
                  className="w-full gradient-sage-dark text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {buttonLabel}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
