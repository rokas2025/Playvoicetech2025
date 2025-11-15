'use client';

import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
};

type Status = 'ready' | 'listening' | 'thinking' | 'speaking';

export function VoiceChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>('ready');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    try {
      setStatus('thinking');

      // Convert audio to base64 for STT
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        // Call STT API
        const sttResponse = await fetch('/api/eleven/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64Audio }),
        });

        if (!sttResponse.ok) {
          throw new Error('STT failed');
        }

        const { text: transcribedText } = await sttResponse.json();

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

        // Get LLM response
        const llmResponse = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.text,
            })),
          }),
        });

        if (!llmResponse.ok) {
          throw new Error('LLM failed');
        }

        const { reply } = await llmResponse.json();

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
        await playTTS(reply);
        
        setStatus('ready');
      };
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Įvyko klaida apdorojant garsą. Bandykite dar kartą.');
      setStatus('ready');
    }
  };

  const playTTS = async (text: string) => {
    try {
      const response = await fetch('/api/eleven/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      return new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = reject;
        audio.play();
      });
    } catch (err) {
      console.error('Error playing TTS:', err);
      throw err;
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

      // Get LLM response
      const llmResponse = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.text,
          })),
        }),
      });

      if (!llmResponse.ok) {
        throw new Error('LLM failed');
      }

      const { reply } = await llmResponse.json();

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
      await playTTS(reply);
      
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
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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

