'use client';
import { createContext, useContext, useEffect, useState, createElement } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({ user: null, profile: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    setLoading(false);
    if (data) {
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return createElement(
    AuthContext.Provider,
    { value: { user, profile, loading, signOut, refreshProfile: () => user && loadProfile(user.id), reloadProfile: () => user && loadProfile(user.id) } },
    children
  );
}

export const useAuth = () => useContext(AuthContext);

export function getCurrentUserName(profile) {
  if (!profile) return 'Utilisateur';
  return `${profile.prenom} ${profile.nom}`.trim();
}

export function getCurrentUserInitials(profile) {
  if (!profile) return '?';
  return `${(profile.prenom || '?')[0]}${(profile.nom || '')[0] || ''}`.toUpperCase();
}

export function isAdmin(profile) {
  return profile?.role === 'Admin';
}
