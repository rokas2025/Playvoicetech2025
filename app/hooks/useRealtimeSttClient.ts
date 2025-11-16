'use client';

import { useRef, useCallback } from 'react';

type RealtimeSttClientOptions = {
  onPartialTranscript?: (text: string) => void;
  onCommittedTranscript?: (text: string) => void;
  onError?: (error: string) => void;
};

type RealtimeSttClient = {
  start: () => Promise<void>;
  stop: () => void;
  isActive: () => boolean;
};

/**
 * Hook for ElevenLabs realtime STT via WebSocket with VAD
 * 
 * Features:
 * - Direct browser → ElevenLabs WebSocket connection
 * - Authenticated via ephemeral token from /api/eleven/stt-token
 * - Captures mic audio, converts to PCM 16kHz Int16
 * - Sends base64-encoded audio chunks to ElevenLabs
 * - Receives partial and committed transcripts
 * 
 * Mic Control:
 * - start() opens WebSocket AND starts microphone
 * - stop() closes WebSocket AND stops microphone (full cleanup)
 */
export function useRealtimeSttClient(options: RealtimeSttClientOptions): RealtimeSttClient {
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isActiveRef = useRef(false);

  const stop = useCallback(() => {
    console.log('[Realtime STT] Stopping...');
    
    isActiveRef.current = false;

    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // Disconnect audio nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all microphone tracks (fully close mic)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[Realtime STT] Stopped mic track:', track.label);
      });
      mediaStreamRef.current = null;
    }

    console.log('[Realtime STT] Stopped and cleaned up');
  }, []);

  const start = useCallback(async () => {
    try {
      console.log('[Realtime STT] Starting...');

      // If already active, stop first
      if (isActiveRef.current) {
        console.log('[Realtime STT] Already active, stopping first...');
        stop();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      isActiveRef.current = true;

      // Step 1: Get single-use token from server
      console.log('[Realtime STT] Fetching single-use token...');
      const tokenResponse = await fetch('/api/eleven/stt-token');
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to get token');
      }

      const { token } = await tokenResponse.json();
      console.log('[Realtime STT] Got single-use token');

      // Step 2: Open WebSocket to ElevenLabs
      // Using single-use token for secure authentication (expires in ~15 min)
      // NOTE: Do NOT include model_id - it causes 403 error
      const wsUrl = new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime');
      wsUrl.searchParams.set('language_code', 'lt'); // Lithuanian
      wsUrl.searchParams.set('commit_strategy', 'vad'); // Voice Activity Detection
      wsUrl.searchParams.set('token', token); // Single-use token

      console.log('[Realtime STT] Connecting to WebSocket with token...');
      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      // WebSocket event handlers
              ws.onopen = () => {
                console.log('[Realtime STT] WebSocket connected');
              };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Log all messages for debugging
          console.log('[Realtime STT] Message:', message.message_type);
          
          // Handle session started
          if (message.message_type === 'session_started') {
            console.log('[Realtime STT] Session started:', message.session_id);
          }
          
          // Handle partial transcripts
          if (message.message_type === 'partial_transcript' && message.text) {
            console.log('[Realtime STT] Partial:', message.text);
            options.onPartialTranscript?.(message.text);
          }
          
          // Handle committed transcripts (VAD detected end of utterance)
          if (message.message_type === 'transcript' && message.text) {
            console.log('[Realtime STT] Transcript:', message.text);
            options.onCommittedTranscript?.(message.text);
          }
          
          // Handle errors
          if (message.message_type === 'error' || message.message_type === 'input_error') {
            console.error('[Realtime STT] Server error:', message.error);
            options.onError?.(message.error);
          }
        } catch (err) {
          console.error('[Realtime STT] Error parsing message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[Realtime STT] WebSocket error:', error);
        options.onError?.('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[Realtime STT] WebSocket closed:', event.code, event.reason);
        if (isActiveRef.current) {
          // Unexpected close
          options.onError?.('WebSocket connection closed unexpectedly');
        }
      };

      // Wait for WebSocket to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        });
      });

      // Step 3: Request microphone access
      console.log('[Realtime STT] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      mediaStreamRef.current = stream;
      console.log('[Realtime STT] Microphone access granted');

      // Step 4: Setup AudioContext and audio processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use ScriptProcessorNode for audio processing
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // For production, consider migrating to AudioWorklet
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        // Only send audio if WebSocket is open and we're still active
        if (!isActiveRef.current || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 [-1, 1] to Int16 PCM
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert Int16Array to base64
        const uint8Array = new Uint8Array(int16Array.buffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));

        // Send to ElevenLabs as raw base64 string (NOT JSON)
        ws.send(base64);
      };

      // Connect audio nodes
      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log('[Realtime STT] Audio processing started');

    } catch (error) {
      console.error('[Realtime STT] Error starting:', error);
      stop(); // Cleanup on error
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      options.onError?.(errorMessage);
      throw error;
    }
  }, [options, stop]);

  const isActive = useCallback(() => {
    return isActiveRef.current;
  }, []);

  return {
    start,
    stop,
    isActive,
  };
}

