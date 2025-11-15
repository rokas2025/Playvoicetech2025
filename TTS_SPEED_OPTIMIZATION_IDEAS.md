# TTS Greičio Optimizavimas - Idėjos

## Dabartinė situacija
- Naudojame ElevenLabs `eleven_v3` modelį su `pcm_16000` išvestimi
- `optimize_streaming_latency` parametras nustatytas į `3` (agresyviausias)
- Visas tekstas siunčiamas vienu kartu į TTS API

## Optimizavimo strategijos

### 1. **Streaming su chunking** (Rekomenduojama)
**Problema:** Dabar laukiame viso TTS atsakymo prieš pradedant groti.

**Sprendimas:**
- Skaityti TTS response kaip stream
- Groti audio chunks iš karto kai jie ateina
- Naudoti Web Audio API su `AudioWorklet` arba `ScriptProcessorNode`

**Implementacija:**
```typescript
// Vietoj response.arrayBuffer(), naudoti stream:
const reader = response.body?.getReader();
const audioContext = new AudioContext({ sampleRate: 16000 });

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // Konvertuoti PCM chunk į AudioBuffer ir groti iš karto
  const audioBuffer = audioContext.createBuffer(1, value.length / 2, 16000);
  // ... decode ir play
}
```

**Laukiamas rezultatas:** -30-50% latency

---

### 2. **Sentence-level chunking** (Vidutinė sudėtis)
**Problema:** Ilgi LLM atsakymai užtrunka ilgai generuoti TTS.

**Sprendimas:**
- Suskaidyti LLM atsakymą į sakinius
- Siųsti kiekvieną sakinį į TTS atskirai
- Groti audio chunks nuosekliai

**Implementacija:**
```typescript
const sentences = reply.split(/[.!?]+/).filter(s => s.trim());

for (const sentence of sentences) {
  const audioChunk = await fetchTTS(sentence);
  await playAudioChunk(audioChunk);
}
```

**Laukiamas rezultatas:** -20-40% latency ilgiems tekstams

---

### 3. **LLM Streaming + TTS Overlap** (Sudėtinga, bet efektyviausia)
**Problema:** Laukiame viso LLM atsakymo prieš pradedant TTS.

**Sprendimas:**
- Naudoti OpenAI streaming API (`stream: true`)
- Kai tik gauname pilną sakinį iš LLM, siųsti į TTS
- TTS ir LLM dirba lygiagrečiai

**Implementacija:**
```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  stream: true,
});

let buffer = '';
for await (const chunk of stream) {
  buffer += chunk.choices[0]?.delta?.content || '';
  
  // Kai turime pilną sakinį, siųsti į TTS
  const sentenceMatch = buffer.match(/^(.*?[.!?])\s/);
  if (sentenceMatch) {
    const sentence = sentenceMatch[1];
    buffer = buffer.slice(sentence.length);
    
    // Siųsti į TTS ir groti
    fetchAndPlayTTS(sentence);
  }
}
```

**Laukiamas rezultatas:** -50-70% total latency

---

### 4. **Pre-warming audio context** (Paprasta)
**Problema:** AudioContext initialization užtrunka ~50-100ms.

**Sprendimas:**
- Sukurti AudioContext iš anksto (component mount)
- Reuse tą patį context visiems TTS calls

**Implementacija:**
```typescript
// VoiceChat.tsx
const audioContextRef = useRef<AudioContext | null>(null);

useEffect(() => {
  audioContextRef.current = new AudioContext({ sampleRate: 16000 });
  return () => audioContextRef.current?.close();
}, []);
```

**Laukiamas rezultatas:** -50-100ms per call

---

### 5. **Parallel TTS requests** (Vidutinė sudėtis)
**Problema:** Ilgi tekstai generuojami nuosekliai.

**Sprendimas:**
- Suskaidyti tekstą į chunks
- Siųsti kelis TTS requests lygiagrečiai
- Groti juos nuosekliai (bet generation buvo parallel)

**Implementacija:**
```typescript
const chunks = splitIntoChunks(text, 200); // 200 char chunks
const audioPromises = chunks.map(chunk => fetchTTS(chunk));
const audioBuffers = await Promise.all(audioPromises);

// Groti nuosekliai
for (const buffer of audioBuffers) {
  await playAudio(buffer);
}
```

**Laukiamas rezultatas:** -20-30% latency ilgiems tekstams

---

### 6. **Reduce audio quality** (Trade-off)
**Problema:** `pcm_16000` yra high quality, bet didelis.

**Sprendimas:**
- Pabandyti `pcm_8000` (žemesnė kokybė, bet 2x mažesnis)
- Arba `mp3_22050_32` (compressed, bet reikia decoder)

**Implementacija:**
```typescript
// TTS API route
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream?output_format=pcm_8000`,
  // ...
);
```

**Laukiamas rezultatas:** -30-40% download time, bet blogesnė kokybė

---

### 7. **Cache common responses** (Paprasta)
**Problema:** Tie patys atsakymai generuojami iš naujo.

**Sprendimas:**
- Cache TTS audio blobs `localStorage` arba `IndexedDB`
- Key: `hash(text + voice_id + settings)`

**Implementacija:**
```typescript
const cacheKey = `tts_${hashString(text + voiceId)}`;
const cached = localStorage.getItem(cacheKey);

if (cached) {
  return base64ToBlob(cached);
}

const audio = await fetchTTS(text);
localStorage.setItem(cacheKey, blobToBase64(audio));
return audio;
```

**Laukiamas rezultatas:** 0ms latency cached responses

---

## Prioritetai (Rekomenduojama tvarka)

1. **Pre-warming audio context** (lengva, greitas win)
2. **TTS streaming** (vidutinė, didelis impact)
3. **LLM streaming + TTS overlap** (sudėtinga, didžiausias impact)
4. **Sentence-level chunking** (vidutinė, geras fallback)
5. **Cache common responses** (lengva, naudinga specifiniams use cases)

---

## Papildomi patarimai

### ElevenLabs parametrai:
- `optimize_streaming_latency: 4` - dar agresyvesnis (jei palaiko)
- Tikrinti ar `eleven_flash_v2_5` modelis veikia su jūsų balsu (greitesnis už v3)

### LLM optimizavimas:
- `max_tokens: 100-150` - trumpesni atsakymai = greičiau
- `temperature: 0.5` - mažiau "mąstymo" = greičiau
- Naudoti `gpt-4o-mini` (greičiausias OpenAI modelis)
- Arba `gpt-3.5-turbo` (dar greitesnis, bet blogesnė kokybė)

### Network:
- Naudoti HTTP/2 (Vercel palaiko automatiškai)
- Compression headers (gzip/brotli)
- CDN edge functions (Vercel Edge Runtime)

---

## Matavimas

Pridėti detailed timing logs:
```typescript
console.log({
  llm_start: llmStart,
  llm_end: llmEnd,
  llm_duration: llmEnd - llmStart,
  
  tts_start: ttsStart,
  tts_fetch_end: ttsFetchEnd,
  tts_decode_end: ttsDecodeEnd,
  tts_play_start: ttsPlayStart,
  
  total_duration: ttsPlayStart - llmStart,
});
```

Tai padės identifikuoti bottlenecks.

