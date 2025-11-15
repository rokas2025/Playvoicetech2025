'use client';

import { useState } from 'react';

export type TimingLog = {
  id: string;
  timestamp: Date;
  stt_time: number | null;
  llm_time: number | null;
  tts_time: number | null;
  total_time: number;
  input_text: string;
  output_text: string;
  // Voice settings used
  llm_model?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
  use_speaker_boost?: boolean;
  optimize_streaming_latency?: number | null;
};

type StatisticsProps = {
  logs: TimingLog[];
  onClear?: () => void;
};

export function Statistics({ logs, onClear }: StatisticsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate averages
  const avgSTT = logs.length > 0
    ? logs.filter(l => l.stt_time).reduce((sum, l) => sum + (l.stt_time || 0), 0) / logs.filter(l => l.stt_time).length
    : 0;
  
  const avgLLM = logs.length > 0
    ? logs.reduce((sum, l) => sum + (l.llm_time || 0), 0) / logs.length
    : 0;
  
  const avgTTS = logs.length > 0
    ? logs.reduce((sum, l) => sum + (l.tts_time || 0), 0) / logs.length
    : 0;
  
  const avgTotal = logs.length > 0
    ? logs.reduce((sum, l) => sum + l.total_time, 0) / logs.length
    : 0;

  const formatTime = (ms: number | null) => {
    if (ms === null) return '-';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Statistika {logs.length > 0 && `(${logs.length} įrašų)`}
        </h2>
        <div className="flex gap-2">
          {logs.length > 0 && onClear && (
            <button
              onClick={onClear}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              🗑️ Išvalyti
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            {isExpanded ? 'Suskleisti ▲' : 'Išskleisti ▼'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">STT (Vidutinis)</div>
          <div className="text-2xl font-bold text-blue-600">{formatTime(avgSTT * 1000)}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">LLM (Vidutinis)</div>
          <div className="text-2xl font-bold text-green-600">{formatTime(avgLLM * 1000)}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">TTS (Vidutinis)</div>
          <div className="text-2xl font-bold text-purple-600">{formatTime(avgTTS * 1000)}</div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Viso (Vidutinis)</div>
          <div className="text-2xl font-bold text-indigo-600">{formatTime(avgTotal * 1000)}</div>
        </div>
      </div>

      {/* Detailed Logs */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Laikas</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">STT</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">LLM</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">TTS</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Viso</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Modelis</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Stab.</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Panaš.</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Stil.</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Greit.</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Boost</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Opt.</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Įvestis</th>
                <th className="px-2 py-2 text-left text-gray-700 font-semibold text-xs">Išvestis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.slice().reverse().map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 text-xs">
                  <td className="px-2 py-2 text-gray-600">
                    {log.timestamp.toLocaleTimeString('lt-LT')}
                  </td>
                  <td className="px-2 py-2 text-blue-600 font-mono">
                    {formatTime(log.stt_time ? log.stt_time * 1000 : null)}
                  </td>
                  <td className="px-2 py-2 text-green-600 font-mono">
                    {formatTime(log.llm_time ? log.llm_time * 1000 : null)}
                  </td>
                  <td className="px-2 py-2 text-purple-600 font-mono">
                    {formatTime(log.tts_time ? log.tts_time * 1000 : null)}
                  </td>
                  <td className="px-2 py-2 text-indigo-600 font-mono font-bold">
                    {formatTime(log.total_time * 1000)}
                  </td>
                  <td className="px-2 py-2 text-gray-700">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {log.llm_model || 'N/A'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-700 font-mono">
                    {log.stability?.toFixed(2) || '-'}
                  </td>
                  <td className="px-2 py-2 text-gray-700 font-mono">
                    {log.similarity_boost?.toFixed(2) || '-'}
                  </td>
                  <td className="px-2 py-2 text-gray-700 font-mono">
                    {log.style?.toFixed(2) || '-'}
                  </td>
                  <td className="px-2 py-2 text-gray-700 font-mono">
                    {log.speed?.toFixed(2) || '-'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {log.use_speaker_boost ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-600">✗</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-700 font-mono">
                    {log.optimize_streaming_latency ?? '-'}
                  </td>
                  <td className="px-2 py-2 text-gray-700 max-w-xs truncate">
                    {log.input_text}
                  </td>
                  <td className="px-2 py-2 text-gray-700 max-w-xs truncate">
                    {log.output_text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {logs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Dar nėra duomenų. Pradėkite pokalbį!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

