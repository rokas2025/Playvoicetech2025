'use client';

import { useScribe, CommitStrategy } from '@elevenlabs/react';
import type { ScribeHookOptions } from '@elevenlabs/react';

/**
 * Wrapper hook for ElevenLabs useScribe with our app-specific configuration
 * 
 * This hook provides real-time speech-to-text transcription using ElevenLabs Scribe v2 Realtime.
 * It handles WebSocket connection, microphone access, and VAD (Voice Activity Detection) automatically.
 * 
 * Usage:
 * ```tsx
 * const scribe = useRealtimeScribe({
 *   onPartialTranscript: (text) => console.log('Partial:', text),
 *   onCommittedTranscript: (text) => console.log('Final:', text),
 * });
 * 
 * // Start transcription
 * await scribe.start();
 * 
 * // Stop transcription
 * scribe.stop();
 * ```
 */

type RealtimeScribeOptions = {
  onPartialTranscript?: (text: string) => void;
  onCommittedTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  languageCode?: string;
  // VAD settings (can be overridden from database)
  vadSilenceThresholdSecs?: number;
  vadThreshold?: number;
  minSpeechDurationMs?: number;
  minSilenceDurationMs?: number;
};

export function useRealtimeScribe(options: RealtimeScribeOptions = {}) {
  const {
    onPartialTranscript,
    onCommittedTranscript,
    onError,
    onConnect,
    onDisconnect,
    languageCode = 'lt', // Lithuanian by default
    vadSilenceThresholdSecs = 1.5,
    vadThreshold = 0.4,
    minSpeechDurationMs = 100,
    minSilenceDurationMs = 100,
  } = options;

  // Configure the ElevenLabs useScribe hook
  const scribeOptions: ScribeHookOptions = {
    modelId: 'scribe_v2_realtime',
    baseUri: 'wss://api.elevenlabs.io', // Standard server (not EU)
    commitStrategy: CommitStrategy.VAD, // VAD-based automatic commit
    languageCode,
    
    // VAD settings (from options or defaults)
    vadSilenceThresholdSecs, // Seconds of silence before commit
    vadThreshold, // Voice detection sensitivity (0.0-1.0)
    minSpeechDurationMs, // Minimum speech duration
    minSilenceDurationMs, // Minimum silence duration
    
    // Microphone settings
    microphone: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    
    // Event callbacks
    onSessionStarted: () => {
      console.log('[Realtime Scribe] Session started');
      onConnect?.();
    },
    
    onPartialTranscript: (data) => {
      console.log('[Realtime Scribe] 📝 Partial:', data.text, '| Full data:', data);
      onPartialTranscript?.(data.text);
    },
    
    onCommittedTranscript: (data) => {
      console.log('[Realtime Scribe] ✅ Committed:', data.text, '| Full data:', data);
      console.log('[Realtime Scribe] 📊 Commit details - Length:', data.text?.length, 'chars, Trimmed:', data.text?.trim().length);
      onCommittedTranscript?.(data.text);
    },
    
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Realtime Scribe] Error:', errorMessage);
      onError?.(errorMessage);
    },
    
    onAuthError: (data) => {
      console.error('[Realtime Scribe] Auth error:', data.error);
      onError?.(data.error);
    },
    
    onQuotaExceededError: (data) => {
      console.error('[Realtime Scribe] Quota exceeded:', data.error);
      onError?.(data.error);
    },
    
    onConnect: () => {
      console.log('[Realtime Scribe] WebSocket connected');
    },
    
    onDisconnect: () => {
      console.log('[Realtime Scribe] WebSocket disconnected');
      onDisconnect?.();
    },
  };

  const scribe = useScribe(scribeOptions);

  /**
   * Start real-time transcription
   * Fetches a single-use token from the server and connects to ElevenLabs
   */
  const start = async () => {
    try {
      console.log('[Realtime Scribe] Starting...');
      
      // Fetch single-use token from our backend
      const response = await fetch('/api/eleven/stt-token');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get token');
      }
      
      const { token } = await response.json();
      console.log('[Realtime Scribe] Got token, connecting...');
      
      // Connect with token and microphone settings
      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      console.log('[Realtime Scribe] Connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Realtime Scribe] Failed to start:', errorMessage);
      onError?.(errorMessage);
      throw error;
    }
  };

  /**
   * Stop transcription and disconnect
   */
  const stop = () => {
    console.log('[Realtime Scribe] Stopping...');
    scribe.disconnect();
  };

  /**
   * Clear all transcripts from state
   */
  const clearTranscripts = () => {
    scribe.clearTranscripts();
  };

  return {
    // State
    status: scribe.status,
    isConnected: scribe.isConnected,
    isTranscribing: scribe.isTranscribing,
    partialTranscript: scribe.partialTranscript,
    committedTranscripts: scribe.committedTranscripts,
    error: scribe.error,
    
    // Methods
    start,
    stop,
    clearTranscripts,
    
    // Direct access to underlying scribe if needed
    scribe,
  };
}

