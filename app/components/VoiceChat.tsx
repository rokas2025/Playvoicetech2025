'use client';

import { useState, useRef, useEffect } from 'react';
import type { TimingLog } from './Statistics';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
};

type Status = 'ready' | 'listening' | 'thinking' | 'speaking';

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
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
          model: agent?.llm_model || 'gpt-4o-mini',
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
      const voiceId = await playTTS(reply);
      ttsTime = (performance.now() - ttsStart) / 1000;
      
      // Save to database with voice ID
      await saveMessage('assistant', reply, voiceId);
      
      // Log timing
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
        });
      }
      
      setStatus('ready');
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Įvyko klaida apdorojant garsą. Bandykite dar kartą.');
      setStatus('ready');
    }
  };

  const playTTS = async (text: string): Promise<string | null> => {
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

      // Handle PCM audio playback using Web Audio API
      const audioBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      
      // Convert PCM to AudioBuffer
      const audioBufferData = audioContext.createBuffer(1, audioBuffer.byteLength / 2, 16000);
      const channelData = audioBufferData.getChannelData(0);
      const view = new Int16Array(audioBuffer);
      
      for (let i = 0; i < view.length; i++) {
        channelData[i] = view[i] / 32768.0; // Convert to float32
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBufferData;
      source.connect(audioContext.destination);

      return new Promise<string | null>((resolve, reject) => {
        source.onended = () => {
          audioContext.close();
          resolve(voiceId);
        };
        source.start(0);
      });
    } catch (err) {
      console.error('Error playing TTS:', err);
      return null;
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
          model: agent?.llm_model || 'gpt-4o-mini',
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
      const voiceId = await playTTS(reply);
      ttsTime = (performance.now() - ttsStart) / 1000;
      
      // Save to database with voice ID
      await saveMessage('assistant', reply, voiceId);
      
      // Log timing
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
          <div className="flex justify-center">
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
              {isRecording ? '⏹ Sustabdyti' : '🎤 Pradėti kalbėti'}
            </button>
          </div>
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>Paspauskite mygtuką, kalbėkite lietuviškai, tada sustabdykite įrašymą</p>
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

