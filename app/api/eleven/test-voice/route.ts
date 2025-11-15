import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to check if a specific voice ID works with eleven_v3 model
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get('voice_id') || 'rUjkmAIbnXhCdNuEPZGZ';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // First, check if voice exists
    const voicesResponse = await fetch('https://api.elevenlabs.io/v2/voices?show_legacy=true', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!voicesResponse.ok) {
      return NextResponse.json({
        error: 'Failed to fetch voices',
        status: voicesResponse.status,
      });
    }

    const voicesData = await voicesResponse.json();
    const voice = voicesData.voices?.find((v: any) => v.voice_id === voiceId);

    if (!voice) {
      return NextResponse.json({
        error: 'Voice not found',
        voice_id: voiceId,
        available_voices: voicesData.voices?.map((v: any) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
        })),
      });
    }

    // Test TTS with this voice
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_16000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/pcm',
        },
        body: JSON.stringify({
          text: 'Labas, tai yra testas.',
          model_id: 'eleven_v3',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            speed: 1.0,
            use_speaker_boost: true,
          },
          optimize_streaming_latency: 3,
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      return NextResponse.json({
        error: 'TTS test failed',
        voice_id: voiceId,
        voice_name: voice.name,
        status: ttsResponse.status,
        statusText: ttsResponse.statusText,
        details: errorText,
      });
    }

    return NextResponse.json({
      success: true,
      voice_id: voiceId,
      voice_name: voice.name,
      voice_category: voice.category,
      model: 'eleven_v3',
      message: 'Voice works with eleven_v3 model!',
    });
  } catch (error: any) {
    console.error('Error testing voice:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

