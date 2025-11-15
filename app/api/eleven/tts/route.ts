import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, voice_id, voice_settings } = body;
    const streamingEnabled = voice_settings?.tts_streaming_enabled ?? false;

    console.log('[TTS] Request:', {
      voice_id,
      text_length: text.length,
      streaming_enabled: streamingEnabled,
      timestamp: new Date().toISOString(),
    });

    if (!text || !voice_id) {
      return NextResponse.json(
        { error: 'Missing required fields: text, voice_id' },
        { status: 400 }
      );
    }

    // Voice settings for eleven_v3 model (as per rules)
    const settings = {
      stability: voice_settings?.stability ?? 0.5,
      similarity_boost: voice_settings?.similarity_boost ?? 0.8,
      style: voice_settings?.style ?? 0.0,
      speed: voice_settings?.speed ?? 1.0,
      use_speaker_boost: voice_settings?.use_speaker_boost ?? true,
    };

    // Build request body
    const requestBody: any = {
      text,
      model_id: 'eleven_v3', // Eleven v3 alpha - most emotionally rich, expressive model
      voice_settings: settings,
    };

    // Only add optimize_streaming_latency if it's explicitly set (not null/undefined)
    // Some voices may not work with this parameter
    const optimizeLatency = voice_settings?.optimize_streaming_latency;
    if (optimizeLatency !== null && optimizeLatency !== undefined) {
      requestBody.optimize_streaming_latency = optimizeLatency;
    }

    // Call ElevenLabs TTS API with eleven_v3 model (as per rules - supports 70+ languages including Lithuanian)
    // Reference: https://elevenlabs.io/docs/models#eleven-v3-alpha
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream?output_format=pcm_16000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/pcm',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        voice_id,
        model_id: 'eleven_v3',
        streaming_enabled: streamingEnabled,
      });
      return NextResponse.json(
        { 
          error: 'Failed to generate speech', 
          details: errorText,
          voice_id,
          model: 'eleven_v3'
        },
        { status: response.status }
      );
    }

    // ✨ CONDITIONAL: Streaming V1 arba Normal buffering
    if (streamingEnabled) {
      console.log('[TTS] Using STREAMING V1 mode - direct passthrough');
      
      if (!response.body) {
        console.error('[TTS] No response body from ElevenLabs');
        return NextResponse.json(
          { error: 'No response body from upstream' },
          { status: 502 }
        );
      }

      // Stream audio directly - no buffering!
      return new NextResponse(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'audio/pcm',
          'X-TTS-Mode': 'streaming-v1', // Custom header for tracking
        },
      });
    } else {
      console.log('[TTS] Using NORMAL buffering mode');
      
      // Traditional buffering (original behavior)
      const audioBuffer = await response.arrayBuffer();
      
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/pcm',
          'Content-Length': audioBuffer.byteLength.toString(),
          'X-TTS-Mode': 'normal', // Custom header for tracking
        },
      });
    }
  } catch (error) {
    console.error('Error in TTS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

