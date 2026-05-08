import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/microsoft/events/[eventId] - Modifie un événement Outlook
export async function PATCH(request, { params }) {
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

    const { eventId } = await params;
    const body = await request.json();
    const { titre, description, debut, fin, lieu, participants, allDay } = body;

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const update = {
      ...(titre !== undefined && { subject: titre }),
      ...(description !== undefined && { body: { contentType: 'HTML', content: description || '' } }),
      ...(debut && { start: { dateTime: debut, timeZone: 'Europe/Paris' } }),
      ...(fin && { end: { dateTime: fin, timeZone: 'Europe/Paris' } }),
      ...(allDay !== undefined && { isAllDay: allDay }),
      ...(lieu !== undefined && { location: { displayName: lieu || '' } }),
      ...(participants !== undefined && {
        attendees: (participants || []).map(email => ({
          emailAddress: { address: email },
          type: 'required'
        }))
      })
    };

    const updated = await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint: `/me/events/${eventId}`,
      method: 'PATCH',
      body: update
    });

    return NextResponse.json({ event: updated });
  } catch (err) {
    console.error('Update event error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/microsoft/events/[eventId] - Supprime un événement Outlook
export async function DELETE(request, { params }) {
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

    const { eventId } = await params;

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint: `/me/events/${eventId}`,
      method: 'DELETE'
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete event error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
