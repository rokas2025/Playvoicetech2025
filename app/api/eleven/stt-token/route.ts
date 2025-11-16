import { NextRequest, NextResponse } from 'next/server';

/**
 * Return API key for ElevenLabs realtime STT WebSocket connection
 * 
 * This endpoint:
 * - Runs server-side only
 * - Returns the ELEVENLABS_API_KEY for WebSocket authentication
 * - API key is passed via query params (WebSocket doesn't support custom headers)
 * 
 * Security: API key is returned from server-side only, never exposed in client code
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

    console.log('[STT Token] Returning API key for WebSocket connection');

    // Return the API key for WebSocket authentication
    // WebSocket doesn't support custom headers, so it must be passed via query params
    return NextResponse.json({ 
      apiKey: apiKey
    });

  } catch (error) {
    console.error('[STT Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

