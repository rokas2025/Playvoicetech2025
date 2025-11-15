import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_AGENT_ID = '00000000-0000-0000-0000-000000000001';

// GET - Get or create current session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (sessionId) {
      // Get existing session
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return NextResponse.json({ session: data });
    } else {
      // Get latest active session or create new one
      const { data: existingSessions, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('agent_id', DEFAULT_AGENT_ID)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (existingSessions && existingSessions.length > 0) {
        return NextResponse.json({ session: existingSessions[0] });
      }

      // Create new session
      const { data: newSession, error: createError } = await supabase
        .from('sessions')
        .insert({
          agent_id: DEFAULT_AGENT_ID,
          meta: { browser: 'web' },
        })
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({ session: newSession });
    }
  } catch (error: any) {
    console.error('Error in sessions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, meta } = body;

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        agent_id: agent_id || DEFAULT_AGENT_ID,
        meta: meta || {},
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data });
  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

