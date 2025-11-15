import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all agents (create default if none exist)
export async function GET() {
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }

    // If no agents exist, create default one
    if (!agents || agents.length === 0) {
      const { data: newAgent, error: createError } = await supabase
        .from('agents')
        .insert({
          name: 'Pagrindinis asistentas',
          description: 'Lietuviškai kalbantis balso asistentas',
          system_prompt: 'Tu esi naudingas balso asistentas. Visada atsakyk lietuvių kalba. Būk mandagus, aiškus ir glaustus.',
          model_id: 'eleven_v3',
          llm_model: 'gpt-4.1-mini'
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating default agent:', createError);
        return NextResponse.json(
          { error: 'Failed to create default agent' },
          { status: 500 }
        );
      }

      return NextResponse.json({ agents: [newAgent] });
    }

    return NextResponse.json({ agents: agents || [] });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update agent settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      system_prompt, 
      default_voice_id,
      agent_name,
      agent_role,
      agent_task,
      agent_location,
      agent_info,
      llm_model
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing agent id' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (default_voice_id !== undefined) updateData.default_voice_id = default_voice_id;
    if (agent_name !== undefined) updateData.agent_name = agent_name;
    if (agent_role !== undefined) updateData.agent_role = agent_role;
    if (agent_task !== undefined) updateData.agent_task = agent_task;
    if (agent_location !== undefined) updateData.agent_location = agent_location;
    if (agent_info !== undefined) updateData.agent_info = agent_info;
    if (llm_model !== undefined) updateData.llm_model = llm_model;

    const { data, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

