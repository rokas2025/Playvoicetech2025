import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate single-use token for ElevenLabs realtime STT WebSocket connection
 * 
 * This endpoint:
 * - Runs server-side only
 * - Requests a single-use token from ElevenLabs (expires in ~15 minutes)
 * - Returns the temporary token for WebSocket authentication
 * 
 * Security: API key stays on server, only temporary token is sent to client
 * Reference: https://elevenlabs.io/docs/api-reference/single-use-token
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

    console.log('[STT Token] Requesting single-use token from ElevenLabs...');

    // Request a single-use token from ElevenLabs
    // Token is valid for ~15 minutes and single-use only
    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[STT Token] ElevenLabs API error:', errorData);
      throw new Error(`Token API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('[STT Token] Single-use token obtained successfully');

    // Return the temporary token (expires in ~15 minutes)
    return NextResponse.json({ 
      token: data.token 
    });

  } catch (error) {
    console.error('[STT Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

