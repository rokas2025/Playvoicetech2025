import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
      // Get the first agent
      const { data: agents } = await supabase
        .from('agents')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!agents || agents.length === 0) {
        return NextResponse.json(
          { error: 'No agent found. Please create an agent first.' },
          { status: 404 }
        );
      }

      const agentId = agents[0].id;

      // Get latest active session or create new one
      const { data: existingSessions, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('agent_id', agentId)
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
          agent_id: agentId,
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

    // If no agent_id provided, get the first agent
    let finalAgentId = agent_id;
    if (!finalAgentId) {
      const { data: agents } = await supabase
        .from('agents')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!agents || agents.length === 0) {
        return NextResponse.json(
          { error: 'No agent found' },
          { status: 404 }
        );
      }
      finalAgentId = agents[0].id;
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        agent_id: finalAgentId,
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

