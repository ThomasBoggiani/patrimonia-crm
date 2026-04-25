import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) throw new Error('UNAUTHORIZED');
  const accessToken = authHeader.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

// PATCH /api/microsoft/events/{id}  → modifie un événement
export async function PATCH(request, { params }) {
  try {
    const user = await getUser(request);
    const eventId = params.id;
    const body = await request.json();

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const update = {};
    if (body.titre !== undefined) update.subject = body.titre;
    if (body.description !== undefined) update.body = { contentType: 'HTML', content: body.description };
    if (body.debut) update.start = { dateTime: body.debut, timeZone: 'Europe/Paris' };
    if (body.fin) update.end = { dateTime: body.fin, timeZone: 'Europe/Paris' };
    if (body.lieu !== undefined) update.location = { displayName: body.lieu };
    if (body.allDay !== undefined) update.isAllDay = body.allDay;

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/microsoft/events/{id}  → supprime un événement
export async function DELETE(request, { params }) {
  try {
    const user = await getUser(request);
    const eventId = params.id;

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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete event error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
