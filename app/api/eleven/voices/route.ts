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
    const response = await fetch('https://api.elevenlabs.io/v2/voices', {
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

    // Transform the response to a simpler format
    const voices = data.voices?.map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
      description: voice.description || '',
      category: voice.category || 'generated',
      preview_url: voice.preview_url || null,
    })) || [];

    return NextResponse.json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

