'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères');
    
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    
    if (error) setError(error.message);
    else {
      setSuccess(true);
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-light.png" alt="Immeubles & Patrimoine" className="w-40 h-40" />
        </div>
        
        <div className="bg-white rounded-2xl shadow-luxe border border-cream-dark p-8">
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">Nouveau mot de passe</h1>
          <p className="text-sm text-sage-dark mb-6">Choisissez un mot de passe d'au moins 8 caractères</p>

          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="p-3 mb-4 bg-sage-50 border border-sage-light rounded-lg text-sm text-sage-darker flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-sage-dark" />
              <div>Mot de passe mis à jour ! Redirection en cours...</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-sage-dark mb-1.5">Nouveau mot de passe</label>
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
              Mettre à jour
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
