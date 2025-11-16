import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate ephemeral token for ElevenLabs realtime STT WebSocket connection
 * 
 * This endpoint:
 * - Runs server-side only
 * - Uses ELEVENLABS_API_KEY to request a short-lived token
 * - Returns ONLY the ephemeral token to the browser (never the API key)
 * 
 * Security: API key never exposed to browser
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error('[STT Token] ElevenLabs API key not configured');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    console.log('[STT Token] Requesting ephemeral token from ElevenLabs...');

    // Request single-use token for realtime STT
    // Based on ElevenLabs docs: https://elevenlabs.io/docs/api-reference/speech-to-text/realtime
    const response = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STT Token] ElevenLabs token request failed:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to generate token',
          details: `ElevenLabs API responded with status ${response.status}`
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.token) {
      console.error('[STT Token] No token in response:', data);
      return NextResponse.json(
        { error: 'Invalid token response from ElevenLabs' },
        { status: 502 }
      );
    }

    console.log('[STT Token] Successfully generated ephemeral token');

    // Return ONLY the token, never the API key
    return NextResponse.json({ 
      token: data.token 
    });

  } catch (error) {
    console.error('[STT Token] Error generating token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

