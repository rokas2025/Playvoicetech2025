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
};

type SettingsPanelProps = {
  onClose?: () => void;
};

const DEFAULT_AGENT_ID = '00000000-0000-0000-0000-000000000001'; // We'll use a fixed agent ID

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.0,
    speed: 1.0,
    use_speaker_boost: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          setSystemPrompt(agent.system_prompt || '');
          setSelectedVoiceId(agent.default_voice_id || '');
        }
      }

      // Load voice settings
      const settingsRes = await fetch(`/api/agents/voice-settings?agent_id=${DEFAULT_AGENT_ID}`);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.preset) {
          setVoiceSettings({
            stability: settingsData.preset.stability,
            similarity_boost: settingsData.preset.similarity_boost,
            style: settingsData.preset.style,
            speed: settingsData.preset.speed,
            use_speaker_boost: settingsData.preset.use_speaker_boost,
          });
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setMessage({ type: 'error', text: 'Nepavyko įkelti duomenų' });
    } finally {
      setLoading(false);
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

      // Update agent settings
      const agentRes = await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: DEFAULT_AGENT_ID,
          system_prompt: systemPrompt,
          default_voice_id: selectedVoiceId,
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
          agent_id: DEFAULT_AGENT_ID,
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Pasirinkite balsą...</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            placeholder="Įveskite sistemos pranešimą lietuvių kalba..."
          />
        </div>

        {/* Voice Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Balso nustatymai</h3>

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
          </div>

          {/* Speaker Boost */}
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

