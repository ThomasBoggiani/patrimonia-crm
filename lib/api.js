// lib/api.js
// Wrapper autour de fetch qui joint automatiquement le jeton d'authentification
// Supabase (Authorization: Bearer <access_token>) aux appels vers les routes
// API internes protégées. À utiliser à la place de fetch() côté front.

import { supabase } from './supabase';

export async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
