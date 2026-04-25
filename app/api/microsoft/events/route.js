import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/microsoft/events?start=2026-04-25&end=2026-05-25
// Retourne les événements Outlook de l'utilisateur dans la fenêtre temporelle
export async function GET(request) {
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

    const url = new URL(request.url);
    const start = url.searchParams.get('start') || new Date().toISOString();
    const end = url.searchParams.get('end') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Calendar View = événements expandés (récurrents inclus)
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const endpoint = `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=100&$orderby=start/dateTime&$select=id,subject,bodyPreview,start,end,location,attendees,organizer,isAllDay,onlineMeeting,webLink`;
    
    const result = await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint
    });

    return NextResponse.json({ events: result.value || [] });
  } catch (err) {
    console.error('List events error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/microsoft/events  → crée un événement
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
    const { titre, description, debut, fin, lieu, participants, allDay } = body;

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const event = {
      subject: titre,
      body: { contentType: 'HTML', content: description || '' },
      start: { dateTime: debut, timeZone: 'Europe/Paris' },
      end: { dateTime: fin, timeZone: 'Europe/Paris' },
      isAllDay: allDay || false,
      ...(lieu && { location: { displayName: lieu } }),
      ...(participants && participants.length > 0 && {
        attendees: participants.map(email => ({
          emailAddress: { address: email },
          type: 'required'
        }))
      })
    };

    const created = await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint: '/me/events',
      method: 'POST',
      body: event
    });

    return NextResponse.json({ event: created });
  } catch (err) {
    console.error('Create event error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
