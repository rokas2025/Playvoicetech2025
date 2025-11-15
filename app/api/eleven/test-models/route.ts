import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to check which models work with a specific voice
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

    const testText = 'Labas, tai yra testas.';
    const models = [
      'eleven_v3',
      'eleven_multilingual_v2',
      'eleven_turbo_v2_5',
      'eleven_flash_v2_5',
    ];

    const results = [];

    for (const modelId of models) {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_16000`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/pcm',
            },
            body: JSON.stringify({
              text: testText,
              model_id: modelId,
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

        if (response.ok) {
          const audioSize = (await response.arrayBuffer()).byteLength;
          results.push({
            model_id: modelId,
            status: '✅ SUCCESS',
            audio_size_bytes: audioSize,
          });
        } else {
          const errorText = await response.text();
          results.push({
            model_id: modelId,
            status: '❌ FAILED',
            http_status: response.status,
            error: errorText,
          });
        }
      } catch (error: any) {
        results.push({
          model_id: modelId,
          status: '❌ ERROR',
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      voice_id: voiceId,
      test_text: testText,
      results,
      summary: {
        total_tested: models.length,
        successful: results.filter((r) => r.status === '✅ SUCCESS').length,
        failed: results.filter((r) => r.status !== '✅ SUCCESS').length,
      },
    });
  } catch (error: any) {
    console.error('Error testing models:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

