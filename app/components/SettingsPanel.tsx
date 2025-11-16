'use client';

import { useState, useEffect } from 'react';

type Voice = {
  id: string;
  name: string;
  description?: string;
};

type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
  optimize_streaming_latency?: number | null;
  tts_streaming_mode?: 'normal' | 'streaming-v1' | 'streaming-v2';
};

type SettingsPanelProps = {
  onClose?: () => void;
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    stability: 0.4, // Lower = faster processing (0.4 recommended for speed)
    similarity_boost: 0.75, // Slightly lower for faster generation
    style: 0.0, // Keep at 0 for fastest response
    speed: 1.1, // Slightly faster speech (1.1 = 10% faster)
    use_speaker_boost: false, // Disable for lower latency (adds processing time)
    optimize_streaming_latency: 4, // Maximum optimization (4 = most aggressive)
    tts_streaming_mode: 'normal', // Default to normal mode (most stable)
  });
  
  // Agent knowledge fields
  const [agentName, setAgentName] = useState<string>('AI Asistentas');
  const [agentRole, setAgentRole] = useState<string>('Virtualus asistentas');
  const [agentTask, setAgentTask] = useState<string>('Padėti vartotojams su jų klausimais');
  const [agentLocation, setAgentLocation] = useState<string>('Lietuva');
  const [agentInfo, setAgentInfo] = useState<string>('Esu draugiškas AI asistentas, kuris kalba lietuviškai.');
  const [llmModel, setLlmModel] = useState<string>('gpt-4.1-mini');
  
  // VAD settings for conversational mode
  const [vadSilenceThresholdSecs, setVadSilenceThresholdSecs] = useState<number>(1.5);
  const [vadThreshold, setVadThreshold] = useState<number>(0.4);
  const [minSpeechDurationMs, setMinSpeechDurationMs] = useState<number>(100);
  const [minSilenceDurationMs, setMinSilenceDurationMs] = useState<number>(100);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load voices from ElevenLabs
      const voicesRes = await fetch('/api/eleven/voices');
      if (voicesRes.ok) {
        const voicesData = await voicesRes.json();
        setVoices(voicesData.voices || []);
      } else {
        console.error('Failed to load voices:', await voicesRes.text());
      }

      // Load saved settings from database
      const agentsRes = await fetch('/api/agents');
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        if (agentsData.agents && agentsData.agents.length > 0) {
          const agent = agentsData.agents[0];
          setAgentId(agent.id);
          setSystemPrompt(agent.system_prompt || '');
          setSelectedVoiceId(agent.default_voice_id || '');
          
          // Load agent knowledge fields
          setAgentName(agent.agent_name || 'AI Asistentas');
          setAgentRole(agent.agent_role || 'Virtualus asistentas');
          setAgentTask(agent.agent_task || 'Padėti vartotojams su jų klausimais');
          setAgentLocation(agent.agent_location || 'Lietuva');
          setAgentInfo(agent.agent_info || 'Esu draugiškas AI asistentas, kuris kalba lietuviškai.');
          setLlmModel(agent.llm_model || 'gpt-4.1-mini');
          
          // Load VAD settings
          setVadSilenceThresholdSecs(agent.vad_silence_threshold_secs ?? 1.5);
          setVadThreshold(agent.vad_threshold ?? 0.4);
          setMinSpeechDurationMs(agent.min_speech_duration_ms ?? 100);
          setMinSilenceDurationMs(agent.min_silence_duration_ms ?? 100);
          
          // Load voice settings for this agent
          const settingsRes = await fetch(`/api/agents/voice-settings?agent_id=${agent.id}`);
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            if (settingsData.preset) {
              setVoiceSettings({
                stability: settingsData.preset.stability,
                similarity_boost: settingsData.preset.similarity_boost,
                style: settingsData.preset.style,
                speed: settingsData.preset.speed,
                use_speaker_boost: settingsData.preset.use_speaker_boost,
                optimize_streaming_latency: settingsData.preset.optimize_streaming_latency ?? 3,
                tts_streaming_mode: settingsData.preset.tts_streaming_mode || 'normal',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setMessage({ type: 'error', text: 'Nepavyko įkelti duomenų' });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!selectedVoiceId || !systemPrompt.trim()) {
      setMessage({ type: 'error', text: 'Pasirinkite balsą ir įveskite sistemos pranešimą' });
      return;
    }

    try {
      setTesting(true);
      setMessage(null);

      // Test TTS with system prompt
      const response = await fetch('/api/eleven/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: systemPrompt,
          voice_id: selectedVoiceId,
          voice_settings: voiceSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS test failed');
      }

      // Play the audio
      const audioBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      
      const audioBufferData = audioContext.createBuffer(1, audioBuffer.byteLength / 2, 16000);
      const channelData = audioBufferData.getChannelData(0);
      const view = new Int16Array(audioBuffer);
      
      for (let i = 0; i < view.length; i++) {
        channelData[i] = view[i] / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBufferData;
      source.connect(audioContext.destination);
      source.start(0);

      source.onended = () => {
        audioContext.close();
        setTesting(false);
      };

      setMessage({ type: 'success', text: 'Testuojama...' });
    } catch (err) {
      console.error('Error testing voice:', err);
      setMessage({ type: 'error', text: 'Nepavyko išbandyti balso' });
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (!selectedVoiceId) {
        setMessage({ type: 'error', text: 'Pasirinkite balsą' });
        return;
      }

      if (!agentId) {
        setMessage({ type: 'error', text: 'Agentas nerastas. Perkraukite puslapį.' });
        return;
      }

      // Update agent settings including knowledge fields and VAD settings
      const agentRes = await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: agentId,
          system_prompt: systemPrompt,
          default_voice_id: selectedVoiceId,
          agent_name: agentName,
          agent_role: agentRole,
          agent_task: agentTask,
          agent_location: agentLocation,
          agent_info: agentInfo,
          llm_model: llmModel,
          vad_silence_threshold_secs: vadSilenceThresholdSecs,
          vad_threshold: vadThreshold,
          min_speech_duration_ms: minSpeechDurationMs,
          min_silence_duration_ms: minSilenceDurationMs,
        }),
      });

      if (!agentRes.ok) {
        throw new Error('Failed to update agent');
      }

      // Save voice settings
      const settingsRes = await fetch('/api/agents/voice-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          voice_id: selectedVoiceId,
          ...voiceSettings,
        }),
      });

      if (!settingsRes.ok) {
        throw new Error('Failed to save voice settings');
      }

      setMessage({ type: 'success', text: 'Nustatymai išsaugoti sėkmingai!' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: 'Nepavyko išsaugoti nustatymų' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Nustatymai</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 lg:hidden"
          >
            ✕
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Voice Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Balsas
          </label>
          <select
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value="" className="text-gray-500">Pasirinkite balsą...</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id} className="text-gray-900">
                {voice.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Arba įveskite balso ID rankiniu būdu žemiau
          </p>
        </div>

        {/* Custom Voice ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Arba įveskite balso ID rankiniu būdu
          </label>
          <input
            type="text"
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            placeholder="pvz: rUjkmAIbnXhCdNuEPZGZ"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            Naudokite šį lauką, jei jūsų balsas nematomas dropdown'e
          </p>
        </div>

        {/* Agent Knowledge Section */}
        <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">📋 Agento žinios</h3>
          
          <div className="space-y-3">
            {/* Agent Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Vardas
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white text-sm"
                placeholder="pvz: Rokas"
              />
            </div>

            {/* Agent Role */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Profesija / Rolė
              </label>
              <input
                type="text"
                value={agentRole}
                onChange={(e) => setAgentRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white text-sm"
                placeholder="pvz: Klientų aptarnavimo specialistas"
              />
            </div>

            {/* Agent Task */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Užduotis
              </label>
              <input
                type="text"
                value={agentTask}
                onChange={(e) => setAgentTask(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white text-sm"
                placeholder="pvz: Padėti klientams su užsakymais"
              />
            </div>

            {/* Agent Location */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Vieta
              </label>
              <input
                type="text"
                value={agentLocation}
                onChange={(e) => setAgentLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white text-sm"
                placeholder="pvz: Vilnius, Lietuva"
              />
            </div>

            {/* Agent Info */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Papildoma informacija
              </label>
              <textarea
                value={agentInfo}
                onChange={(e) => setAgentInfo(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-gray-900 bg-white text-sm"
                placeholder="Įveskite papildomą informaciją apie agentą..."
              />
            </div>

            {/* LLM Model Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                LLM Modelis
              </label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white text-sm"
              >
                <option value="gpt-4.1-mini">GPT-4.1 Mini (greičiausias, 83% pigesnis, NAUJAS! ⚡)</option>
                <option value="gpt-4.1-nano">GPT-4.1 Nano (mažiausias, dar greitesnis)</option>
                <option value="gpt-4o-mini">GPT-4o Mini (senas greitas modelis)</option>
                <option value="gpt-4.1">GPT-4.1 (naujas protingiausias)</option>
                <option value="gpt-4o">GPT-4o (senas protingas)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (seniausias)</option>
              </select>
            </div>

            {/* Quick Knowledge Templates */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Greitos šablonai
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAgentName('Rokas');
                    setAgentRole('Klientų aptarnavimo vadybininkas');
                    setAgentTask('Padėti klientams su užsakymais ir atsakyti į klausimus');
                    setAgentLocation('Vilnius, Lietuva');
                    setAgentInfo('Esu draugiškas ir profesionalus klientų aptarnavimo specialistas. Mano tikslas - užtikrinti puikią klientų patirtį.');
                  }}
                  className="flex-1 px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium"
                >
                  👔 Klientų aptarnavimas
                </button>
                <button
                  onClick={() => {
                    setAgentName('Laura');
                    setAgentRole('Pardavimų konsultantė');
                    setAgentTask('Padėti klientams pasirinkti geriausius produktus ir paslaugas');
                    setAgentLocation('Kaunas, Lietuva');
                    setAgentInfo('Esu energinga pardavimų konsultantė su dideliu produktų žiniomis. Mėgstu padėti žmonėms rasti tai, ko jiems reikia.');
                  }}
                  className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                >
                  💼 Pardavimai
                </button>
                <button
                  onClick={() => {
                    setAgentName('Jonas');
                    setAgentRole('Techninis palaikymo specialistas');
                    setAgentTask('Spręsti technines problemas ir padėti su programine įranga');
                    setAgentLocation('Klaipėda, Lietuva');
                    setAgentInfo('Esu patyręs IT specialistas, kuris mėgsta spręsti sudėtingas technines problemas. Stengiuosi viską paaiškinti paprastai ir suprantamai.');
                  }}
                  className="flex-1 px-3 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors text-xs font-medium"
                >
                  🔧 IT Palaikymas
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sistemos pranešimas
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Įveskite sistemos pranešimą lietuvių kalba..."
          />
          <button
            onClick={handleTest}
            disabled={testing || !selectedVoiceId || !systemPrompt.trim()}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {testing ? '🔊 Testuojama...' : '🔊 Išbandyti balsą'}
          </button>
        </div>

        {/* Voice Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Balso nustatymai</h3>
            <button
              onClick={() => {
                setVoiceSettings({
                  stability: 0.4,
                  similarity_boost: 0.75,
                  style: 0.0,
                  speed: 1.1,
                  use_speaker_boost: false,
                  optimize_streaming_latency: 4,
                  tts_streaming_mode: 'normal',
                });
              }}
              className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              ↻ Atstatyti į numatytuosius (greičiui)
            </button>
          </div>

          {/* Stability */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Stabilumas: {voiceSettings.stability.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings.stability}
              onChange={(e) =>
                setVoiceSettings({ ...voiceSettings, stability: parseFloat(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              ⚡ Greičiui: 0.3-0.5 (žemesnis = greitesnis)
            </p>
          </div>

          {/* Similarity Boost */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Panašumas: {voiceSettings.similarity_boost.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings.similarity_boost}
              onChange={(e) =>
                setVoiceSettings({ ...voiceSettings, similarity_boost: parseFloat(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              ⚡ Greičiui: 0.7-0.8 (žemesnis = greitesnis)
            </p>
          </div>

          {/* Style */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Stilius: {voiceSettings.style.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings.style}
              onChange={(e) =>
                setVoiceSettings({ ...voiceSettings, style: parseFloat(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              ⚡ Greičiui: 0.0 (laikykite 0 greičiausiam atsakymui)
            </p>
          </div>

          {/* Speed */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Greitis: {voiceSettings.speed.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.7"
              max="1.2"
              step="0.01"
              value={voiceSettings.speed}
              onChange={(e) =>
                setVoiceSettings({ ...voiceSettings, speed: parseFloat(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              ⚡ Greičiui: 1.1-1.2 (didesnis = greitesnis kalbėjimas)
            </p>
          </div>

          {/* Speaker Boost */}
          <div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="speaker-boost"
                checked={voiceSettings.use_speaker_boost}
                onChange={(e) =>
                  setVoiceSettings({ ...voiceSettings, use_speaker_boost: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="speaker-boost" className="ml-2 text-sm text-gray-700">
                Garsiakalbio pastiprinimas
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              ⚡ Greičiui: <strong>Išjungti</strong> (prideda apdorojimo laiką)
            </p>
          </div>

          {/* Optimize Streaming Latency */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Streaming optimizavimas (latency)
            </label>
            <select
              value={voiceSettings.optimize_streaming_latency ?? 'disabled'}
              onChange={(e) => {
                const val = e.target.value;
                setVoiceSettings({
                  ...voiceSettings,
                  optimize_streaming_latency: val === 'disabled' ? null : parseInt(val),
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="disabled">Išjungta (gali padėti su kai kuriais balsais)</option>
              <option value="0">0 - Mažiausias (aukščiausia kokybė)</option>
              <option value="1">1 - Žemas</option>
              <option value="2">2 - Vidutinis</option>
              <option value="3">3 - Agresyvus (mažiausia latency)</option>
              <option value="4">4 - Maksimalus (greičiausias)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              ⚡ Rekomenduojama: <strong>4 (Maksimalus)</strong> greičiausiam atsakymui. Jei TTS neveikia, pabandykite išjungti.
            </p>
          </div>

          {/* TTS Streaming Mode Selection */}
          <div className="border-t pt-4 mt-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    TTS Streaming Režimai (A/B/C Testing)
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Pasirinkite TTS streaming režimą ir palyginkite rezultatus statistikoje.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Normal Mode */}
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="tts-mode"
                  value="normal"
                  checked={voiceSettings.tts_streaming_mode === 'normal' || !voiceSettings.tts_streaming_mode}
                  onChange={(e) =>
                    setVoiceSettings({ 
                      ...voiceSettings, 
                      tts_streaming_mode: 'normal'
                    })
                  }
                  className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <span className="font-semibold text-gray-900">Normal (Tradicinis)</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Default</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Tradicinis buffering režimas. Stabiliausias, bet lėčiausias (~2.0s latency).
                  </p>
                </div>
              </label>

              {/* Streaming V1 */}
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="tts-mode"
                  value="streaming-v1"
                  checked={voiceSettings.tts_streaming_mode === 'streaming-v1'}
                  onChange={(e) =>
                    setVoiceSettings({ 
                      ...voiceSettings, 
                      tts_streaming_mode: 'streaming-v1'
                    })
                  }
                  className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <span className="font-semibold text-gray-900">Streaming V1</span>
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Beta</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Backend streaming, frontend buffering. Vidutinis greitis (~1.8s latency).
                  </p>
                </div>
              </label>

              {/* Streaming V2 */}
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="tts-mode"
                  value="streaming-v2"
                  checked={voiceSettings.tts_streaming_mode === 'streaming-v2'}
                  onChange={(e) =>
                    setVoiceSettings({ 
                      ...voiceSettings, 
                      tts_streaming_mode: 'streaming-v2'
                    })
                  }
                  className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <span className="font-semibold text-gray-900">Streaming V2 (Full Streaming)</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Greičiausias</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Pilnas streaming (backend + frontend). Greičiausias (~0.9s latency). Eksperimentinis!
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                💡 <strong>Patarimas:</strong> Išbandykite visus 3 režimus ir palyginkite rezultatus 
                Statistika lentelėje. V2 turėtų būti ~50% greičiau nei Normal.
              </p>
            </div>
          </div>

          {/* VAD Settings (for Streaming V2 conversational mode) */}
          {voiceSettings.tts_streaming_mode === 'streaming-v2' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🎙️ VAD Nustatymai (Pokalbio režimas)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Voice Activity Detection nustatymai pokalbio režimui su Streaming V2. 
                Šie nustatymai kontroliuoja, kaip sistema nustato, kada jūs baigėte kalbėti.
              </p>

              {/* VAD Silence Threshold */}
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Tylos laikas prieš užbaigimą: {vadSilenceThresholdSecs.toFixed(1)}s
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={vadSilenceThresholdSecs}
                  onChange={(e) => setVadSilenceThresholdSecs(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Kiek sekundžių tylos reikia, kad sistema suprastų, jog baigėte kalbėti. 
                  Žemesnis = greitesnis atsakymas, bet gali nutraukti per anksti.
                </p>
              </div>

              {/* VAD Threshold */}
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Balso aptikimo jautrumas: {vadThreshold.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={vadThreshold}
                  onChange={(e) => setVadThreshold(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Kaip jautriai sistema aptinka balsą. Žemesnis = jautresnis (aptiks tylesnį kalbėjimą).
                </p>
              </div>

              {/* Min Speech Duration */}
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Min. kalbėjimo trukmė: {minSpeechDurationMs}ms
                </label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={minSpeechDurationMs}
                  onChange={(e) => setMinSpeechDurationMs(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimali kalbėjimo trukmė, kad būtų užfiksuota. Apsaugo nuo trumpų triukšmų.
                </p>
              </div>

              {/* Min Silence Duration */}
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Min. tylos trukmė: {minSilenceDurationMs}ms
                </label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={minSilenceDurationMs}
                  onChange={(e) => setMinSilenceDurationMs(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimali tylos trukmė, kad būtų užfiksuota. Apsaugo nuo trumpų pauzių kalbėjime.
                </p>
              </div>

              {/* Reset VAD Settings */}
              <button
                type="button"
                onClick={() => {
                  setVadSilenceThresholdSecs(1.5);
                  setVadThreshold(0.4);
                  setMinSpeechDurationMs(100);
                  setMinSilenceDurationMs(100);
                }}
                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                ↻ Atstatyti VAD nustatymus
              </button>

              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 <strong>Patarimas:</strong> Jei sistema nutraukia jus per anksti, padidinkite "Tylos laikas". 
                  Jei nereaguoja į tylesnį kalbėjimą, sumažinkite "Balso aptikimo jautrumas".
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !selectedVoiceId}
          className={`
            w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors
            ${
              saving || !selectedVoiceId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }
          `}
        >
          {saving ? 'Išsaugoma...' : 'Išsaugoti nustatymus'}
        </button>
      </div>
    </div>
  );
}

