# 🎯 Checkpoint v1.2 - PCM Frame Alignment Fix

**Date**: 2025-01-15  
**Tag**: `v1.2-pcm-alignment-fix`  
**Status**: ✅ **READY FOR TESTING**

---

## 📊 Overview

Implemented **proper PCM frame alignment** to eliminate radio noise caused by broken sample boundaries.

### **Root Cause Analysis**

Previous implementation had a critical flaw:

```typescript
// ❌ PROBLEM (v1.1):
if (byteLength % 2 !== 0) {
  // Drop 1 byte to make it even
  alignedBuffer = new ArrayBuffer(byteLength - 1);
}
```

**Why this caused radio noise:**
1. PCM 16-bit mono = **2 bytes = 1 sample**
2. Stream chunks arrive at **arbitrary byte boundaries**
3. Dropping 1 byte → **breaks sample alignment**
4. Next chunk's samples are **offset by 1 byte**
5. Result: `-200 → +30000` amplitude jumps = **radio noise/clicks** 📻

---

## 🔧 Solution: 6-Step Approach

### **1. Leftover Buffer System** 🎯
```typescript
let leftover: Uint8Array | null = null;

// Merge leftover from previous read with new chunk
if (leftover && leftover.length > 0) {
  const merged = new Uint8Array(leftover.length + value.length);
  merged.set(leftover, 0);
  merged.set(value, leftover.length);
  chunk = merged;
}
```

**Result:** Never drop bytes, always preserve incomplete frames ✅

---

### **2. Proper Frame Extraction** 🎯
```typescript
const FRAME_SIZE_BYTES = 2; // 16-bit mono
const fullFrames = Math.floor(chunk.length / FRAME_SIZE_BYTES);
const fullBytes = fullFrames * FRAME_SIZE_BYTES;

const audioBytes = chunk.subarray(0, fullBytes);
const remaining = chunk.length - fullBytes;

if (remaining > 0) {
  leftover = chunk.subarray(fullBytes); // Save for next iteration
}
```

**Result:** Only process complete samples, never break boundaries ✅

---

### **3. Aggressive Small Chunk Filtering** 🎯
```typescript
const MIN_SAMPLES = 200; // 12.5ms @ 16kHz

if (sampleCount < MIN_SAMPLES) {
  console.warn(`[TTS V2] Skipping small chunk: ${sampleCount} samples`);
  skippedCount++;
  continue;
}
```

**Result:** Skip likely metadata/noise chunks ✅

---

### **4. Spike Detection (Safety Net)** 🎯
```typescript
const SPIKE_THRESHOLD = 0.8; // 80% amplitude jump

const hasSuspiciousSpike = (channelData: Float32Array): boolean => {
  for (let i = 1; i < channelData.length; i++) {
    const diff = Math.abs(channelData[i] - channelData[i - 1]);
    if (diff > SPIKE_THRESHOLD) {
      return true;
    }
  }
  return false;
};

if (hasSuspiciousSpike(channelData)) {
  console.warn('[TTS V2] Muting chunk - suspicious spike detected');
  channelData.fill(0); // Convert to silence
  mutedCount++;
}
```

**Result:** Broken PCM → silence instead of noise ✅

---

### **5. Cross-Fade (Now Works on Clean PCM)** 🎯
```typescript
// 4ms overlap (existing implementation)
if (chunkCount > 0) {
  startTime = nextStartTime - FADE_DURATION; // -4ms overlap
}

// Fade in only (no fade out)
applyFadeIn(channelData);
```

**Result:** Smooth transitions on properly aligned samples ✅

---

### **6. Detailed Logging** 🎯
```typescript
console.log(`[TTS V2] Stream complete - Played: ${chunkCount}, Muted: ${mutedCount}, Skipped: ${skippedCount}`);
```

**Result:** Easy debugging and performance tracking ✅

---

## 📊 Technical Comparison

| Aspect | v1.1 (Cross-fade) | v1.2 (PCM Alignment) |
|--------|-------------------|----------------------|
| **Sample boundaries** | ❌ Can break | ✅ Always preserved |
| **Odd byte handling** | ❌ Drop 1 byte | ✅ Save to leftover |
| **Frame alignment** | ❌ Not guaranteed | ✅ Guaranteed |
| **Small chunks** | ⚠️ Skip < 100 samples | ✅ Skip < 200 samples |
| **Spike detection** | ❌ None | ✅ 80% threshold |
| **Broken PCM handling** | ❌ Plays as noise | ✅ Mutes to silence |
| **Cross-fade** | ✅ 4ms overlap | ✅ 4ms overlap |
| **Logging** | ⚠️ Basic | ✅ Detailed stats |

---

## 🎯 Expected Results

### **Before (v1.1):**
```
[TTS V2] Chunk 1: 8519 samples
[TTS V2] Odd chunk size (35533 bytes), aligning...  ← PROBLEM!
[TTS V2] Chunk 2: 640 samples
[TTS V2] Chunk 3: 671 samples
→ Result: Radio noise between chunks 📻
```

### **After (v1.2):**
```
[TTS V2] Starting streaming with proper PCM frame alignment...
[TTS V2] Chunk 1: 8519 samples (0.53s) @ 0.05s
[TTS V2] Chunk 2: 6560 samples (0.41s) @ 0.576s
[TTS V2] Skipping small chunk: 40 samples (2.5ms)
[TTS V2] Chunk 3: 13136 samples (0.82s) @ 0.982s
[TTS V2] Stream complete - Played: 15, Muted: 0, Skipped: 2
→ Result: Clean continuous audio, no noise! ✨
```

---

## 🔍 What Changed in Code

### **File Modified:**
- `app/components/VoiceChat.tsx` - `playStreamingV2` function

### **Lines Changed:**
- **Removed:** Lines 459-465 (old odd-byte alignment)
- **Added:** Lines 423-447 (leftover buffer + spike detection)
- **Modified:** Lines 467-551 (proper frame extraction + filtering)

### **Key Variables:**
```typescript
const FRAME_SIZE_BYTES = 2;      // PCM 16-bit mono
const MIN_SAMPLES = 200;         // 12.5ms @ 16kHz
const SPIKE_THRESHOLD = 0.8;     // 80% amplitude jump
let leftover: Uint8Array | null; // Persistent between reads
let mutedCount = 0;              // Track muted chunks
let skippedCount = 0;            // Track skipped chunks
```

---

## 🧪 Testing Instructions

### **1. Deploy to Vercel**
```bash
git push origin master
# Wait ~2-3 minutes for deployment
```

### **2. Test Streaming V2**
1. Go to **Nustatymai** (Settings)
2. Select **🚀 Streaming V2 (Full Streaming)**
3. Click **Išsaugoti nustatymus**
4. Test with:
   - **Text input:** "Labas, kaip sekasi?"
   - **Voice input:** Speak in Lithuanian

### **3. Check Console Logs**
Open browser DevTools (F12) and look for:

```javascript
[TTS V2] Starting streaming with proper PCM frame alignment...
[TTS V2] Chunk 1: 8519 samples (0.53s) @ 0.05s
[TTS V2] Chunk 2: 6560 samples (0.41s) @ 0.576s
[TTS V2] Stream complete - Played: 15, Muted: 0, Skipped: 2
```

**Good signs:**
- ✅ No "Odd chunk size, aligning..." messages
- ✅ `Muted: 0` (no broken PCM detected)
- ✅ `Skipped: 1-3` (normal - tiny chunks filtered)
- ✅ No radio noise or clicks

**Bad signs:**
- ❌ `Muted: 5+` (many broken chunks - investigate)
- ❌ Still hearing radio noise (check backend)
- ❌ Audio cuts off (check error logs)

---

## 🎧 Audio Quality Checklist

Test and verify:
- [ ] No radio-like noise between chunks
- [ ] No clicks or pops
- [ ] No abrupt silence gaps
- [ ] Smooth continuous playback
- [ ] Natural voice quality (not robotic)
- [ ] Proper Lithuanian pronunciation
- [ ] No distortion or artifacts

---

## 🐛 Troubleshooting

### **If still hearing noise:**

1. **Check if spike detection is working:**
   ```javascript
   // Look for this in console:
   [TTS V2] Muting chunk X - suspicious spike detected
   ```
   - If `Muted: 0` but still noise → increase `MIN_SAMPLES` to 300

2. **Check backend streaming:**
   ```javascript
   // In browser Network tab, check TTS response:
   Content-Type: audio/pcm  ✅
   X-TTS-Mode: streaming-v2  ✅
   ```

3. **Try adjusting thresholds:**
   ```typescript
   // In VoiceChat.tsx:
   const MIN_SAMPLES = 300;        // More aggressive filtering
   const SPIKE_THRESHOLD = 0.5;    // More sensitive detection
   ```

4. **Fallback to Streaming V1:**
   - If V2 still has issues, use V1 (backend streaming only)
   - Should be stable with ~1.8s latency

---

## 🔄 Rollback Instructions

If critical issues occur:

```bash
# Rollback to v1.1 (cross-fade without PCM alignment)
git checkout v1.1-streaming-v2

# Or revert specific commit
git revert 459e5af

# Or use Normal mode in UI
# Settings → Select "Normal (Tradicinis)" → Save
```

---

## 📚 Technical References

### **PCM Audio Basics**
- PCM 16-bit mono: 2 bytes per sample
- Sample rate: 16000 Hz (16 kHz)
- Duration: samples / sample_rate (e.g., 16000 samples = 1 second)

### **Why Sample Alignment Matters**
```
Correct alignment:
[byte0][byte1] [byte2][byte3] [byte4][byte5]
  sample1        sample2        sample3      ✅

Broken alignment (after dropping 1 byte):
[byte0][byte1] [byte2][byte3] [byte4][byte5]
  sample1      [byte1][byte2] [byte3][byte4]  ❌
                 BROKEN!        BROKEN!
```

### **Amplitude Spike Example**
```
Normal audio:  0.1 → 0.15 → 0.2 → 0.18 → 0.1  ✅
Broken PCM:    0.1 → 0.15 → 0.95 → -0.87 → 0.1  ❌
                              ↑ SPIKE (radio noise)
```

---

## 🎯 Next Steps

### **After Testing:**
1. Verify no radio noise in production
2. Check statistics for muted/skipped chunk counts
3. If successful → create v1.2 git tag
4. Document any edge cases found

### **Future Improvements:**
1. **Adaptive thresholds:** Adjust MIN_SAMPLES based on chunk size distribution
2. **Spectral analysis:** Detect noise in frequency domain (more accurate)
3. **Machine learning:** Train model to detect broken PCM patterns
4. **Compression:** Use Opus codec for lower bandwidth (requires decoder)

---

## ✅ Success Criteria

**v1.2 is successful if:**
- ✅ No radio noise in 10 consecutive tests
- ✅ `Muted: 0-1` in most sessions (< 5% chunks muted)
- ✅ `Skipped: 1-3` per session (normal filtering)
- ✅ Latency remains ~0.9s (no regression)
- ✅ Audio quality is professional (smooth, natural)

---

## 📞 Credits

**Solution inspired by:** ChatGPT analysis  
**Problem identified by:** User feedback ("radio noise between chunks")  
**Root cause:** Broken PCM sample boundaries from dropping odd bytes  
**Fix:** Leftover buffer system + spike detection + aggressive filtering  

---

## 📝 Summary

**Version**: v1.2-pcm-alignment-fix  
**Status**: ✅ Ready for Testing  
**Key Fix**: Proper PCM frame alignment with leftover buffer  
**Expected Result**: Zero radio noise, clean audio  
**Risk**: Low (can rollback to v1.1)  
**Testing Required**: Yes (verify in production)  

**Git Commit**: `459e5af`  
**Date**: 2025-01-15  
**Files Changed**: 1 (`app/components/VoiceChat.tsx`)  
**Lines Changed**: +73 / -25  

---

**Ready to test! 🚀**

