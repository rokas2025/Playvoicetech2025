import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Call ElevenLabs API to get voices (v2 endpoint as per rules)
    // Include show_legacy to get ALL voices including custom cloned voices
    const response = await fetch('https://api.elevenlabs.io/v2/voices?show_legacy=true', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch voices from ElevenLabs' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log all voices for debugging
    console.log('ElevenLabs API returned', data.voices?.length || 0, 'voices');
    if (data.voices) {
      console.log('Voice IDs:', data.voices.map((v: any) => `${v.name} (${v.voice_id})`).join(', '));
    }

    // Transform the response to a simpler format - return ALL voices
    const voices = data.voices?.map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
      description: voice.description || '',
      category: voice.category || 'generated',
      preview_url: voice.preview_url || null,
    })) || [];

    console.log('Returning', voices.length, 'voices to frontend');
    return NextResponse.json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

