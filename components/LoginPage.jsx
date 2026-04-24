'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('login');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.includes('Invalid login credentials')) setError('Email ou mot de passe incorrect');
      else if (error.message.includes('Email not confirmed')) setError("Votre compte n'est pas encore activé. Vérifiez votre email.");
      else setError(error.message);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setLoading(false);
    if (error) setError(error.message);
    else setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-light.png" alt="Immeubles & Patrimoine" className="w-40 h-40 mb-3" />
          <p className="text-xs uppercase tracking-[0.2em] text-sage-dark">Transactions immobilières</p>
          <p className="text-xs text-cream-400 mt-0.5">Paris · Île-de-France</p>
        </div>

        <div className="bg-white rounded-2xl shadow-luxe border border-cream-dark p-8">
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">
            {mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
          </h1>
          <p className="text-sm text-sage-dark mb-6">
            {mode === 'login' 
              ? "Accès réservé à l'équipe Immeubles & Patrimoine"
              : "Entrez votre email, vous recevrez un lien de réinitialisation"}
          </p>

          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              ⚠ {error}
            </div>
          )}

          {resetSent && (
            <div className="p-3 mb-4 bg-sage-50 border border-sage-light rounded-lg text-sm text-sage-darker">
              ✓ Email envoyé ! Vérifiez votre boîte de réception (et les spams).
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-sage-dark mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@immeubles-patrimoine.fr"
                className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage"
                required
                autoComplete="email"
              />
            </div>

            {mode === 'login' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-sage-dark mb-1.5">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full px-3 py-2.5 border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-sage"
                  required
                  autoComplete="current-password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-sage-dark text-white py-2.5 rounded-lg text-sm f
