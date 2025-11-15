import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST - Save voice settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_id,
      voice_id,
      stability,
      similarity_boost,
      style,
      speed,
      use_speaker_boost,
    } = body;

    if (!agent_id || !voice_id) {
      return NextResponse.json(
        { error: 'Missing required fields: agent_id, voice_id' },
        { status: 400 }
      );
    }

    // Check if preset already exists for this agent and voice
    const { data: existing } = await supabase
      .from('voice_presets')
      .select('id')
      .eq('agent_id', agent_id)
      .eq('eleven_voice_id', voice_id)
      .single();

    let result;

    if (existing) {
      // Update existing preset
      const { data, error } = await supabase
        .from('voice_presets')
        .update({
          stability: stability ?? 0.5,
          similarity_boost: similarity_boost ?? 0.8,
          style: style ?? 0.0,
          speed: speed ?? 1.0,
          use_speaker_boost: use_speaker_boost ?? true,
          is_default: true,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new preset
      const { data, error } = await supabase
        .from('voice_presets')
        .insert({
          agent_id,
          eleven_voice_id: voice_id,
          display_name: 'Default',
          stability: stability ?? 0.5,
          similarity_boost: similarity_boost ?? 0.8,
          style: style ?? 0.0,
          speed: speed ?? 1.0,
          use_speaker_boost: use_speaker_boost ?? true,
          is_default: true,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Set all other presets for this agent to not default
    await supabase
      .from('voice_presets')
      .update({ is_default: false })
      .eq('agent_id', agent_id)
      .neq('id', result.id);

    return NextResponse.json({ preset: result });
  } catch (error: any) {
    console.error('Error saving voice settings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get voice settings for an agent
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get('agent_id');

    if (!agent_id) {
      return NextResponse.json(
        { error: 'Missing agent_id parameter' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('voice_presets')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is ok
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch voice settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ preset: data || null });
  } catch (error) {
    console.error('Error fetching voice settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

