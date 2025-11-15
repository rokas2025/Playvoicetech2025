import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error('ElevenLabs API key not configured');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Get the audio blob directly from FormData
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      console.error('Missing or invalid audio data');
      return NextResponse.json(
        { error: 'Missing or invalid audio data' },
        { status: 400 }
      );
    }

    console.log('Received audio file:', {
      type: audioFile.type,
      size: audioFile.size,
    });

    // Create new FormData for ElevenLabs API
    // Reference: https://elevenlabs.io/docs/capabilities/speech-to-text
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('file', audioFile, 'audio.webm');
    elevenLabsFormData.append('model_id', 'scribe_v1'); // Scribe v1 supports 99 languages including Lithuanian
    elevenLabsFormData.append('language_code', 'lt'); // Lithuanian ISO 639-1 code
    // Optional: Add timestamps for word-level timing (useful for future features)
    // elevenLabsFormData.append('timestamps_granularity', 'word');

    console.log('Calling ElevenLabs STT API...');

    // Call ElevenLabs STT API (as per docs: https://elevenlabs.io/docs/api-reference/speech-to-text/convert)
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs STT API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return NextResponse.json(
        { 
          error: 'Failed to transcribe audio',
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('STT success:', {
      text_length: data.text?.length || 0,
      language: data.language_code,
    });

    return NextResponse.json({
      text: data.text || '',
      language: data.language_code || 'lt',
    });
  } catch (error: any) {
    console.error('Error in STT:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

