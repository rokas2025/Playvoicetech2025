'use client';

import { useState, useRef, useEffect } from 'react';
import type { TimingLog } from './Statistics';
import { useRealtimeScribe } from '../hooks/useRealtimeScribe';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
};

type Status = 'ready' | 'listening' | 'thinking' | 'speaking';
type TtsMode = 'normal' | 'streaming-v1' | 'streaming-v2';

type VoiceChatProps = {
  onTimingLog?: (log: TimingLog) => void;
};

export function VoiceChat({ onTimingLog }: VoiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>('ready');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentTtsMode, setCurrentTtsMode] = useState<TtsMode>('normal');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSessionActiveRef = useRef(false);
  const currentTtsModeRef = useRef<TtsMode>('normal');

  // Sync refs with state
  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  useEffect(() => {
    currentTtsModeRef.current = currentTtsMode;
  }, [currentTtsMode]);

  // Initialize realtime STT using ElevenLabs React SDK
  const realtimeScribe = useRealtimeScribe({
    onPartialTranscript: (text) => {
      setPartialTranscript(text);
    },
    onCommittedTranscript: (text) => {
      if (!isSessionActiveRef.current) return;
      setPartialTranscript(''); // Clear partial
      handleTranscriptCommitted(text);
    },
    onError: (error) => {
      console.error('[VoiceChat] Realtime STT error:', error);
      setError(`Klaida: ${error}`);
      setIsSessionActive(false);
      setStatus('ready');
    },
    languageCode: 'lt', // Lithuanian
  });

  // Initialize session and load TTS mode on mount
  useEffect(() => {
    initializeSession();
    loadTtsMode();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeSession = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.session.id);
        
        // Load existing messages
        const messagesRes = await fetch(`/api/sessions/${data.session.id}/messages`);
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          const loadedMessages: Message[] = messagesData.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            text: msg.text,
            timestamp: new Date(msg.created_at),
          }));
          setMessages(loadedMessages);
        }
      }
    } catch (err) {
      console.error('Error initializing session:', err);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', text: string, voiceId?: string | null) => {
    if (!sessionId) return;

    try {
      await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          text,
          tts_voice_id: voiceId,
        }),
      });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'listening':
        return 'Klausausi...';
      case 'thinking':
        return 'Mąstau...';
      case 'speaking':
        return 'Kalbu...';
      default:
        return 'Paruošta';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'listening':
        return 'bg-red-500';
      case 'thinking':
        return 'bg-yellow-500';
      case 'speaking':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  // Load current TTS mode from settings
  const loadTtsMode = async (): Promise<TtsMode> => {
    try {
      const agentsRes = await fetch('/api/agents');
      if (!agentsRes.ok) return 'normal';
      
      const agentsData = await agentsRes.json();
      const agent = agentsData.agents?.[0];
      if (!agent) return 'normal';

      const settingsRes = await fetch(`/api/agents/voice-settings?agent_id=${agent.id}`);
      if (!settingsRes.ok) return 'normal';

      const settingsData = await settingsRes.json();
      const mode = settingsData.preset?.tts_streaming_mode || 'normal';
      
      setCurrentTtsMode(mode);
      return mode;
    } catch (err) {
      console.error('[VoiceChat] Error loading TTS mode:', err);
      return 'normal';
    }
  };

  // Start conversational mode (streaming-v2 only)
  const startConversation = async () => {
    try {
      console.log('[VoiceChat] Starting conversation...');
      setError(null);

      // Load current TTS mode
      const mode = await loadTtsMode();
      
      if (mode !== 'streaming-v2') {
        setError('Pokalbio režimas veikia tik su Streaming V2. Pakeiskite nustatymuose.');
        return;
      }

      setIsSessionActive(true);
      setStatus('listening');

      // Start realtime STT using ElevenLabs SDK
      await realtimeScribe.start();
      console.log('[VoiceChat] Conversation started');
    } catch (err) {
      console.error('[VoiceChat] Error starting conversation:', err);
      setError('Nepavyko pradėti pokalbio. Patikrinkite mikrofono leidimus.');
      setIsSessionActive(false);
      setStatus('ready');
    }
  };

  // Stop conversational mode
  const stopConversation = () => {
    console.log('[VoiceChat] Stopping conversation...');
    setIsSessionActive(false);
    realtimeScribe.stop();
    setPartialTranscript('');
    setStatus('ready');
    console.log('[VoiceChat] Conversation stopped');
  };

  // Handle committed transcript from realtime STT
  const handleTranscriptCommitted = async (text: string) => {
    if (!text.trim()) return;

    console.log('[VoiceChat] Committed transcript:', text);
    
    const startTime = performance.now();
    let sttTime: number | null = null;
    let llmTime: number | null = null;
    let ttsTime: number | null = null;
    let assistantText = '';

    try {
      setStatus('thinking');

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Save to database
      await saveMessage('user', text);

      // Get LLM response
      const llmStart = performance.now();
      
      const agentRes = await fetch('/api/agents');
      const agentData = await agentRes.json();
      const agent = agentData.agents?.[0];
      
      const llmResponse = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.text,
          })),
          model: agent?.llm_model || 'gpt-4.1-mini',
          system_prompt: agent?.system_prompt,
          agent_knowledge: {
            agent_name: agent?.agent_name,
            agent_role: agent?.agent_role,
            agent_task: agent?.agent_task,
            agent_location: agent?.agent_location,
            agent_info: agent?.agent_info,
          },
        }),
      });

      if (!llmResponse.ok) {
        throw new Error('LLM failed');
      }

      const { reply } = await llmResponse.json();
      llmTime = (performance.now() - llmStart) / 1000;
      assistantText = reply;

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Play TTS with streaming-v2
      await playAssistantReplyStreamingV2(reply, agent);

    } catch (err) {
      console.error('[VoiceChat] Error in conversation loop:', err);
      setError('Įvyko klaida apdorojant atsakymą.');
      
      // Return to listening if session still active
      if (isSessionActiveRef.current) {
        setStatus('listening');
      } else {
        setStatus('ready');
      }
    }
  };

  // Play assistant reply with streaming-v2 and mic control
  const playAssistantReplyStreamingV2 = async (replyText: string, agent: any) => {
    try {
      setStatus('speaking');
      
      // Stop microphone and WebSocket during speaking
      realtimeScribe.stop();

      // Get voice settings
      let voiceSettings = null;
      let voiceId = null;

      if (agent) {
        const settingsRes = await fetch(`/api/agents/voice-settings?agent_id=${agent.id}`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.preset) {
            voiceSettings = {
              stability: settingsData.preset.stability,
              similarity_boost: settingsData.preset.similarity_boost,
              style: settingsData.preset.style,
              speed: settingsData.preset.speed,
              use_speaker_boost: settingsData.preset.use_speaker_boost,
              optimize_streaming_latency: settingsData.preset.optimize_streaming_latency,
              tts_streaming_mode: 'streaming-v2', // Force streaming-v2
            };
            voiceId = settingsData.preset.eleven_voice_id;
          }
        }
      }

      if (!voiceId) {
        voiceId = agent?.default_voice_id;
      }

      if (!voiceId) {
        throw new Error('No voice selected');
      }

      // Call TTS API
      const ttsStart = performance.now();
      const response = await fetch('/api/eleven/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: replyText,
          voice_id: voiceId,
          voice_settings: voiceSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      // Play streaming audio
      await playStreamingV2(response, voiceId, 'streaming-v2');
      
      const ttsTime = (performance.now() - ttsStart) / 1000;
      console.log('[VoiceChat] TTS completed in', ttsTime.toFixed(2), 's');

      // Save assistant message to database
      await saveMessage('assistant', replyText, voiceId);

      // After TTS finishes, return to listening if session still active
      if (isSessionActiveRef.current) {
        console.log('[VoiceChat] Returning to listening...');
        setStatus('listening');
        // Restart microphone and WebSocket
        await realtimeScribe.start();
      } else {
        setStatus('ready');
      }

    } catch (err) {
      console.error('[VoiceChat] Error playing TTS:', err);
      setError('Klaida grojant atsakymą.');
      
      if (isSessionActiveRef.current) {
        setStatus('listening');
        // Try to restart STT
        try {
          await realtimeScribe.start();
        } catch (restartErr) {
          console.error('[VoiceChat] Failed to restart STT:', restartErr);
          setIsSessionActive(false);
          setStatus('ready');
        }
      } else {
        setStatus('ready');
      }
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('listening');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Nepavyko pradėti įrašymo. Patikrinkite mikrofono leidimus.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    const startTime = performance.now();
    let sttTime: number | null = null;
    let llmTime: number | null = null;
    let ttsTime: number | null = null;
    let userText = '';
    let assistantText = '';

    try {
      setStatus('thinking');

      // Call STT API with FormData
      const sttStart = performance.now();
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      const sttResponse = await fetch('/api/eleven/stt', {
        method: 'POST',
        body: formData,
      });

      if (!sttResponse.ok) {
        const errorData = await sttResponse.json();
        console.error('STT error:', errorData);
        throw new Error(errorData.details || 'STT failed');
      }

      const { text: transcribedText } = await sttResponse.json();
      sttTime = (performance.now() - sttStart) / 1000;
      userText = transcribedText;

      if (!transcribedText || transcribedText.trim() === '') {
        setError('Nepavyko atpažinti kalbos. Bandykite dar kartą.');
        setStatus('ready');
        return;
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: transcribedText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Save to database
      await saveMessage('user', transcribedText);

      // Get LLM response (with agent knowledge)
      const llmStart = performance.now();
      
      // Fetch agent settings to get model and knowledge
      const agentRes = await fetch('/api/agents');
      const agentData = await agentRes.json();
      const agent = agentData.agents?.[0];
      
      const llmResponse = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.text,
          })),
          model: agent?.llm_model || 'gpt-4.1-mini',
          system_prompt: agent?.system_prompt,
          agent_knowledge: {
            agent_name: agent?.agent_name,
            agent_role: agent?.agent_role,
            agent_task: agent?.agent_task,
            agent_location: agent?.agent_location,
            agent_info: agent?.agent_info,
          },
        }),
      });

      if (!llmResponse.ok) {
        throw new Error('LLM failed');
      }

      const { reply } = await llmResponse.json();
      llmTime = (performance.now() - llmStart) / 1000;
      assistantText = reply;

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Play TTS
      setStatus('speaking');
      const ttsStart = performance.now();
      const ttsResult = await playTTS(reply);
      ttsTime = (performance.now() - ttsStart) / 1000;
      
      // Save to database with voice ID
      await saveMessage('assistant', reply, ttsResult?.voiceId || null);
      
      // Get voice settings for logging
      let logVoiceSettings: any = {};
      if (agent) {
        const settingsRes = await fetch(`/api/agents/voice-settings?agent_id=${agent.id}`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.preset) {
            logVoiceSettings = {
              stability: settingsData.preset.stability,
              similarity_boost: settingsData.preset.similarity_boost,
              style: settingsData.preset.style,
              speed: settingsData.preset.speed,
              use_speaker_boost: settingsData.preset.use_speaker_boost,
              optimize_streaming_latency: settingsData.preset.optimize_streaming_latency,
            };
          }
        }
      }
      
      // Log timing with settings
      const totalTime = (performance.now() - startTime) / 1000;
      if (onTimingLog) {
        onTimingLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          stt_time: sttTime,
          llm_time: llmTime,
          tts_time: ttsTime,
          total_time: totalTime,
          input_text: userText,
          output_text: assistantText,
          llm_model: agent?.llm_model,
          tts_mode: ttsResult?.ttsMode || 'normal',
          ...logVoiceSettings,
        });
      }
      
      setStatus('ready');
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Įvyko klaida apdorojant garsą. Bandykite dar kartą.');
      setStatus('ready');
    }
  };

  const playTTS = async (text: string): Promise<{ voiceId: string | null; ttsMode: 'normal' | 'streaming-v1' | 'streaming-v2' } | null> => {
    try {
      // Get agent first
      const agentsRes = await fetch('/api/agents');
      let voiceSettings = null;
      let voiceId = null;
      let agentId = null;

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        if (agentsData.agents && agentsData.agents.length > 0) {
          const agent = agentsData.agents[0];
          agentId = agent.id;
          voiceId = agent.default_voice_id;
        }
      }

      // Get voice settings if agent exists
      if (agentId) {
        const settingsRes = await fetch(`/api/agents/voice-settings?agent_id=${agentId}`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.preset) {
            voiceSettings = {
              stability: settingsData.preset.stability,
              similarity_boost: settingsData.preset.similarity_boost,
              style: settingsData.preset.style,
              speed: settingsData.preset.speed,
              use_speaker_boost: settingsData.preset.use_speaker_boost,
              optimize_streaming_latency: settingsData.preset.optimize_streaming_latency,
              tts_streaming_mode: settingsData.preset.tts_streaming_mode || 'normal',
            };
            voiceId = settingsData.preset.eleven_voice_id;
          }
        }
      }

      if (!voiceId) {
        throw new Error('No voice selected. Please select a voice in settings.');
      }

      const response = await fetch('/api/eleven/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          voice_id: voiceId,
          voice_settings: voiceSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      // Capture TTS mode from response header
      const ttsMode = response.headers.get('X-TTS-Mode') as 'normal' | 'streaming-v1' | 'streaming-v2' || 'normal';
      console.log('[TTS] Mode used:', ttsMode);

      // ✨ CONDITIONAL PLAYBACK based on mode
      if (ttsMode === 'streaming-v2') {
        // 🚀 STREAMING V2: Chunk-by-chunk playback
        return await playStreamingV2(response, voiceId, ttsMode);
      } else {
        // 📦 NORMAL or ⚡ V1: Traditional buffering
        return await playBuffered(response, voiceId, ttsMode);
      }
    } catch (err) {
      console.error('Error playing TTS:', err);
      return null;
    }
  };

  // 📦 Traditional buffered playback (Normal + V1)
  const playBuffered = async (
    response: Response, 
    voiceId: string | null, 
    ttsMode: 'normal' | 'streaming-v1' | 'streaming-v2'
  ): Promise<{ voiceId: string | null; ttsMode: 'normal' | 'streaming-v1' | 'streaming-v2' }> => {
    const audioBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    
    // Convert PCM to AudioBuffer
    const audioBufferData = audioContext.createBuffer(1, audioBuffer.byteLength / 2, 16000);
    const channelData = audioBufferData.getChannelData(0);
    const view = new Int16Array(audioBuffer);
    
    for (let i = 0; i < view.length; i++) {
      channelData[i] = view[i] / 32768.0;
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBufferData;
    source.connect(audioContext.destination);

    return new Promise((resolve) => {
      source.onended = () => {
        audioContext.close();
        resolve({ voiceId, ttsMode });
      };
      source.start(0);
    });
  };

  // 🚀 STREAMING V2: Chunk-by-chunk playback with proper PCM frame alignment
  const playStreamingV2 = async (
    response: Response,
    voiceId: string | null,
    ttsMode: 'normal' | 'streaming-v1' | 'streaming-v2'
  ): Promise<{ voiceId: string | null; ttsMode: 'normal' | 'streaming-v1' | 'streaming-v2' }> => {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const reader = response.body!.getReader();
    
    let audioQueue: AudioBufferSourceNode[] = [];
    let nextStartTime = audioContext.currentTime + 0.05;
    let isPlaying = true;
    const FADE_DURATION = 0.004; // 4ms fade (64 samples @ 16kHz)
    const FRAME_SIZE_BYTES = 2; // PCM 16-bit mono = 2 bytes per sample
    const MIN_SAMPLES = 200; // 12.5ms @ 16kHz - skip smaller chunks
    const SPIKE_THRESHOLD = 0.8; // 80% amplitude jump = suspicious

    // 🎯 LEFTOVER BUFFER: Store incomplete PCM frames between reads
    let leftover: Uint8Array | null = null;

    // Helper: Apply fade in ONLY (no fade out - we'll overlap instead)
    const applyFadeIn = (channelData: Float32Array, fadeLength: number = 64) => {
      const len = channelData.length;
      const actualFadeLength = Math.min(fadeLength, Math.floor(len / 2));
      
      // Fade in (first samples)
      for (let i = 0; i < actualFadeLength; i++) {
        const gain = i / actualFadeLength;
        channelData[i] *= gain;
      }
    };

    // 🔍 Helper: Detect suspicious amplitude spikes (broken PCM)
    const hasSuspiciousSpike = (channelData: Float32Array): boolean => {
      for (let i = 1; i < channelData.length; i++) {
        const diff = Math.abs(channelData[i] - channelData[i - 1]);
        if (diff > SPIKE_THRESHOLD) {
          return true;
        }
      }
      return false;
    };

    try {
      console.log('[TTS V2] Starting streaming with proper PCM frame alignment...');
      
      let chunkCount = 0;
      let mutedCount = 0;
      let skippedCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log(`[TTS V2] Stream complete - Played: ${chunkCount}, Muted: ${mutedCount}, Skipped: ${skippedCount}`);
          break;
        }

        if (!isPlaying) break;
        if (!value) continue;

        // 🎯 STEP 1: Merge leftover bytes from previous read with new chunk
        let chunk = value;
        if (leftover && leftover.length > 0) {
          const merged = new Uint8Array(leftover.length + value.length);
          merged.set(leftover, 0);
          merged.set(value, leftover.length);
          chunk = merged;
          leftover = null;
        }

        // 🎯 STEP 2: Extract only FULL PCM frames (2 bytes = 1 sample)
        const fullFrames = Math.floor(chunk.length / FRAME_SIZE_BYTES);
        const fullBytes = fullFrames * FRAME_SIZE_BYTES;

        // If chunk is too small for even one frame, save for next iteration
        if (fullBytes === 0) {
          leftover = chunk;
          continue;
        }

        // Extract full frames and save remaining bytes for next iteration
        const audioBytes = chunk.subarray(0, fullBytes);
        const remaining = chunk.length - fullBytes;
        
        if (remaining > 0) {
          leftover = chunk.subarray(fullBytes);
        }

        // 🎯 STEP 3: Skip suspiciously small chunks (< 200 samples = 12.5ms)
        const sampleCount = audioBytes.length / FRAME_SIZE_BYTES;
        if (sampleCount < MIN_SAMPLES) {
          console.warn(`[TTS V2] Skipping small chunk: ${sampleCount} samples (${(sampleCount / 16).toFixed(1)}ms)`);
          skippedCount++;
          continue;
        }

        // 🎯 STEP 4: Convert to Int16Array (now guaranteed to be aligned!)
        const int16Array = new Int16Array(
          audioBytes.buffer,
          audioBytes.byteOffset,
          audioBytes.byteLength / FRAME_SIZE_BYTES
        );
        
        const audioBuffer = audioContext.createBuffer(1, int16Array.length, 16000);
        const channelData = audioBuffer.getChannelData(0);
        
        // Convert to float32 and normalize
        for (let i = 0; i < int16Array.length; i++) {
          channelData[i] = int16Array[i] / 32768.0;
        }

        // 🎯 STEP 5: Detect and mute suspicious spikes (broken PCM safety net)
        if (hasSuspiciousSpike(channelData)) {
          console.warn(`[TTS V2] Muting chunk ${chunkCount + 1} - suspicious spike detected (broken PCM?)`);
          channelData.fill(0); // Convert to silence
          mutedCount++;
        } else {
          // Apply fade in to prevent clicks (only if not muted)
          applyFadeIn(channelData);
        }

        // 🎯 STEP 6: Schedule chunk for playback with cross-fade overlap
        const now = audioContext.currentTime;
        
        let startTime;
        if (chunkCount === 0) {
          // First chunk: normal start
          startTime = Math.max(now + 0.01, nextStartTime);
        } else {
          // Subsequent chunks: start FADE_DURATION earlier to overlap
          startTime = Math.max(now + 0.01, nextStartTime - FADE_DURATION);
        }
        
        // Play audio chunk
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(startTime);
        
        // Next chunk starts at the END of this chunk
        nextStartTime = startTime + audioBuffer.duration;
        audioQueue.push(source);
        chunkCount++;
        
        console.log(`[TTS V2] Chunk ${chunkCount}: ${int16Array.length} samples (${audioBuffer.duration.toFixed(2)}s) @ ${startTime.toFixed(2)}s`);
      }

      // Wait for all chunks to finish
      return new Promise((resolve) => {
        if (audioQueue.length === 0) {
          audioContext.close();
          resolve({ voiceId, ttsMode });
          return;
        }

        const lastSource = audioQueue[audioQueue.length - 1];
        lastSource.onended = () => {
          audioContext.close();
          resolve({ voiceId, ttsMode });
        };
      });
    } catch (error) {
      console.error('[TTS V2] Streaming error:', error);
      audioContext.close();
      throw error;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!textInput.trim() || status !== 'ready') {
      return;
    }

    const userText = textInput.trim();
    setTextInput('');
    
    const startTime = performance.now();
    let llmTime: number | null = null;
    let ttsTime: number | null = null;
    let assistantText = '';

    try {
      setStatus('thinking');
      setError(null);

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: userText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Save to database
      await saveMessage('user', userText);

      // Get LLM response (with agent knowledge)
      const llmStart = performance.now();
      
      // Fetch agent settings to get model and knowledge
      const agentRes = await fetch('/api/agents');
      const agentData = await agentRes.json();
      const agent = agentData.agents?.[0];
      
      const llmResponse = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.text,
          })),
          model: agent?.llm_model || 'gpt-4.1-mini',
          system_prompt: agent?.system_prompt,
          agent_knowledge: {
            agent_name: agent?.agent_name,
            agent_role: agent?.agent_role,
            agent_task: agent?.agent_task,
            agent_location: agent?.agent_location,
            agent_info: agent?.agent_info,
          },
        }),
      });

      if (!llmResponse.ok) {
        throw new Error('LLM failed');
      }

      const { reply } = await llmResponse.json();
      llmTime = (performance.now() - llmStart) / 1000;
      assistantText = reply;

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Play TTS
      setStatus('speaking');
      const ttsStart = performance.now();
      const ttsResult = await playTTS(reply);
      ttsTime = (performance.now() - ttsStart) / 1000;
      
      // Save to database with voice ID
      await saveMessage('assistant', reply, ttsResult?.voiceId || null);
      
      // Get voice settings for logging
      let logVoiceSettings: any = {};
      if (agent) {
        const settingsRes = await fetch(`/api/agents/voice-settings?agent_id=${agent.id}`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.preset) {
            logVoiceSettings = {
              stability: settingsData.preset.stability,
              similarity_boost: settingsData.preset.similarity_boost,
              style: settingsData.preset.style,
              speed: settingsData.preset.speed,
              use_speaker_boost: settingsData.preset.use_speaker_boost,
              optimize_streaming_latency: settingsData.preset.optimize_streaming_latency,
            };
          }
        }
      }
      
      // Log timing with settings
      const totalTime = (performance.now() - startTime) / 1000;
      if (onTimingLog) {
        onTimingLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          stt_time: null, // No STT for text input
          llm_time: llmTime,
          tts_time: ttsTime,
          total_time: totalTime,
          input_text: userText,
          output_text: assistantText,
          llm_model: agent?.llm_model,
          tts_mode: ttsResult?.ttsMode || 'normal',
          ...logVoiceSettings,
        });
      }
      
      setStatus('ready');
    } catch (err) {
      console.error('Error processing text:', err);
      setError('Įvyko klaida apdorojant tekstą. Bandykite dar kartą.');
      setStatus('ready');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Status Indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
          <span className="text-lg font-medium text-gray-700">{getStatusText()}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Messages Area */}
      <div className="mb-6 h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Pradėkite pokalbį paspausdami mygtuką žemiau</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('lt-LT')}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Mode Toggle */}
      <div className="mb-4 flex justify-center gap-2">
        <button
          onClick={() => setInputMode('voice')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            inputMode === 'voice'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🎤 Balsas
        </button>
        <button
          onClick={() => setInputMode('text')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            inputMode === 'text'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          ⌨️ Tekstas
        </button>
      </div>

      {/* Voice Input */}
      {inputMode === 'voice' && (
        <>
          {/* Show partial transcript if in conversational mode */}
          {isSessionActive && partialTranscript && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Klausausi: </span>
                {partialTranscript}
              </p>
            </div>
          )}

          <div className="flex justify-center">
            {currentTtsMode === 'streaming-v2' ? (
              // Conversational mode button (streaming-v2 only)
              <button
                onClick={isSessionActive ? stopConversation : startConversation}
                disabled={status === 'thinking' || status === 'speaking'}
                className={`
                  px-8 py-4 rounded-full font-semibold text-lg transition-all
                  ${
                    isSessionActive
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg scale-105'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                  }
                  ${
                    status === 'thinking' || status === 'speaking'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:scale-105'
                  }
                `}
              >
                {isSessionActive ? '⏹ Baigti pokalbį' : '🎤 Pradėti pokalbį'}
              </button>
            ) : (
              // Push-to-talk mode button (normal, streaming-v1)
              <button
                onClick={toggleRecording}
                disabled={status === 'thinking' || status === 'speaking'}
                className={`
                  px-8 py-4 rounded-full font-semibold text-lg transition-all
                  ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg scale-105'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                  }
                  ${
                    status === 'thinking' || status === 'speaking'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:scale-105'
                  }
                `}
              >
                {isRecording ? '⏹ Sustabdyti' : '🎤 Pradėti įrašymą'}
              </button>
            )}
          </div>
          <div className="mt-4 text-center text-sm text-gray-500">
            {currentTtsMode === 'streaming-v2' ? (
              <p>
                💡 <strong>Pokalbio režimas:</strong> Pradėkite pokalbį ir kalbėkite laisvai. 
                AI automatiškai atpažins, kada baigėte kalbėti (VAD).
              </p>
            ) : (
              <p>
                Paspauskite mygtuką, kalbėkite lietuviškai, tada sustabdykite įrašymą.
                <br />
                <span className="text-xs text-blue-600">
                  Patarimas: Įjunkite Streaming V2 nustatymuose, kad galėtumėte naudoti pokalbio režimą.
                </span>
              </p>
            )}
          </div>
        </>
      )}

      {/* Text Input */}
      {inputMode === 'text' && (
        <form onSubmit={handleTextSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Įveskite savo klausimą lietuviškai..."
              disabled={status !== 'ready'}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || status !== 'ready'}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Siųsti
            </button>
          </div>
          <div className="text-center text-sm text-gray-500">
            <p>Įveskite klausimą ir gaukite atsakymą balsu</p>
          </div>
        </form>
      )}
    </div>
  );
}

