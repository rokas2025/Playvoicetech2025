'use client';

import { VoiceChat } from './components/VoiceChat';
import { SettingsPanel } from './components/SettingsPanel';
import { Statistics, type TimingLog } from './components/Statistics';
import { useState, useEffect } from 'react';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [timingLogs, setTimingLogs] = useState<TimingLog[]>([]);

  // Load logs from localStorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('timing_logs');
    if (savedLogs) {
      try {
        const parsed = JSON.parse(savedLogs);
        // Convert timestamp strings back to Date objects
        const logsWithDates = parsed.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
        setTimingLogs(logsWithDates);
      } catch (err) {
        console.error('Error loading logs:', err);
      }
    }
  }, []);

  const handleTimingLog = (log: TimingLog) => {
    setTimingLogs(prev => {
      const newLogs = [...prev, log];
      // Save to localStorage
      localStorage.setItem('timing_logs', JSON.stringify(newLogs));
      return newLogs;
    });
  };

  const handleClearLogs = () => {
    if (confirm('Ar tikrai norite išvalyti visą statistiką?')) {
      setTimingLogs([]);
      localStorage.removeItem('timing_logs');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Lietuvių Balso Asistentas
          </h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showSettings ? 'Uždaryti' : 'Nustatymai'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voice Chat - Takes 2 columns on large screens */}
          <div className={`${showSettings ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <VoiceChat onTimingLog={handleTimingLog} />
          </div>

          {/* Settings Panel - Shows on large screens or when toggled */}
          {showSettings && (
            <div className="lg:col-span-1">
              <SettingsPanel onClose={() => setShowSettings(false)} />
            </div>
          )}
        </div>

        {/* Statistics Section */}
        <div className="mt-6">
          <Statistics logs={timingLogs} onClear={handleClearLogs} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-gray-600 pb-6">
        <p>Sukurta su ElevenLabs ir OpenAI</p>
      </footer>
    </div>
  );
}
