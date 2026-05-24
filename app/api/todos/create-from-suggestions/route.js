// app/api/todos/create-from-suggestions/route.js
// L'utilisateur valide une ou plusieurs suggestions IA pour un email donné.
// Cette route crée les todos correspondantes et marque l'email comme "validé".

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const accessToken = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

    const body = await request.json();
    const { messageId, selectedTodos, clientId } = body;
    if (!messageId) {
      return NextResponse.json({ error: 'messageId requis' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let todosCreated = 0;

    if (Array.isArray(selectedTodos) && selectedTodos.length > 0) {
      const todosToInsert = selectedTodos.slice(0, 5).map(t => {
        const echeanceJours = Math.max(1, Math.min(30, t.echeance_jours || 3));
        const echeance = new Date();
        echeance.setDate(echeance.getDate() + echeanceJours);
        return {
          titre: (t.titre || 'Action à traiter').slice(0, 200),
          priorite: ['Haute', 'Moyenne', 'Basse'].includes(t.priorite) ? t.priorite : 'Moyenne',
          statut: 'À faire',
          echeance: echeance.toISOString().split('T')[0],
          lien_type: clientId ? 'client' : null,
          lien_id: clientId || null,
          created_by: user.id,
          assigned_to_user_id: user.id
        };
      });

      const { error: todoErr } = await adminSupabase
        .from('todos')
        .insert(todosToInsert);

      if (todoErr) {
        console.error('[create-from-suggestions] todo insert error:', todoErr);
        return NextResponse.json({ error: 'Erreur création tâches : ' + todoErr.message }, { status: 500 });
      }
      todosCreated = todosToInsert.length;
    }

    // Marque les suggestions comme validées (qu'elles aient été acceptées ou refusées)
    await adminSupabase
      .from('email_categories')
      .update({
        suggestions_validated_at: new Date().toISOString(),
        todos_count: todosCreated,
        suggested_todos: null // on nettoie après validation
      })
      .eq('message_id', messageId)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      todosCreated
    });
  } catch (err) {
    console.error('[create-from-suggestions] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
