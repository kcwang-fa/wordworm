/* ================= 音效（WebAudio 合成，零外部資源） ================= */
const AUDIO_MUTED_KEY = 'wordworm_audio_muted';
const MUSIC_MUTED_KEY = 'wordworm_music_muted';
const savedAudioMuted = localStorage.getItem(AUDIO_MUTED_KEY);
let AC = null, muted = savedAudioMuted === '1' || (savedAudioMuted === null && localStorage.getItem(MUSIC_MUTED_KEY) === '1'), bgmTimer = null;
let musicMuted = muted;
let audioUnlocked = false;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
function playTone(freq, dur = .09, type = 'triangle', vol = .18, when = 0) {
  const ctx = ac(), o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + when + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime + when); o.stop(ctx.currentTime + when + dur + .02);
}
function beep(freq, dur = .09, type = 'triangle', vol = .18, when = 0) {
  if (muted) return;
  playTone(freq, dur, type, vol, when);
}
const sfx = {
  pick: n => beep(320 + n * 45, .07, 'triangle', .14),          // 越選越高（原版精髓）
  ok: len => { for (let i = 0; i < Math.min(len, 7); i++) beep(420 + i * 90, .1, 'triangle', .16, i * .06); },
  bad: () => { beep(160, .18, 'sawtooth', .12); beep(120, .2, 'sawtooth', .1, .1); },
  burn: () => { beep(220, .25, 'square', .1); beep(180, .3, 'square', .09, .15); },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .16, 'triangle', .18, i * .1)),
  over: () => [400, 320, 240, 160].forEach((f, i) => beep(f, .3, 'sawtooth', .14, i * .2))
};
/* 合成式 BGM：經典模式一首，冒險模式每章切換不同主題 */
const BGM_THEMES = {
  classic: {
    notes: [392, 440, 523, 587, 523, 440, 392, 330, 392, 523, 587, 659, 587, 523, 440, 392],
    tempoMs: 380,
    wave: 'sine',
    noteDur: .22,
    volume: .05,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .4,
    bassVolume: .04,
  },
  'dusty-library': {
    notes: [392, 440, 523, 587, 523, 440, 392, 330, 392, 523, 587, 659, 587, 523, 440, 392],
    tempoMs: 380,
    wave: 'sine',
    noteDur: .22,
    volume: .052,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .4,
    bassVolume: .04,
  },
  'ink-gallery': {
    notes: [330, 392, 466, 523, 466, 392, 370, 311, 330, 392, 523, 587, 523, 466, 392, 330],
    tempoMs: 340,
    wave: 'triangle',
    noteDur: .2,
    volume: .048,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .34,
    bassVolume: .038,
  },
  'crooked-fairytale': {
    notes: [523, 659, 784, 880, 784, 659, 587, 523, 659, 784, 988, 880, 784, 698, 659, 523],
    tempoMs: 320,
    wave: 'triangle',
    noteDur: .18,
    volume: .045,
    bassEvery: 8,
    bassDivisor: 4,
    bassWave: 'sine',
    bassDur: .48,
    bassVolume: .035,
  },
  'star-chart-room': {
    notes: [262, 392, 523, 784, 698, 523, 392, 330, 294, 440, 587, 880, 784, 587, 440, 392],
    tempoMs: 440,
    wave: 'sine',
    noteDur: .3,
    volume: .043,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'triangle',
    bassDur: .55,
    bassVolume: .032,
  },
  'forbidden-greenhouse': {
    notes: [349, 392, 523, 392, 466, 523, 622, 523, 392, 466, 587, 466, 349, 392, 466, 392],
    tempoMs: 360,
    wave: 'triangle',
    noteDur: .24,
    volume: .047,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'sine',
    bassDur: .44,
    bassVolume: .036,
  },
  'storm-index-harbor': {
    notes: [294, 349, 440, 523, 440, 349, 294, 262, 330, 392, 494, 587, 494, 392, 330, 294],
    tempoMs: 300,
    wave: 'square',
    noteDur: .16,
    volume: .032,
    bassEvery: 2,
    bassDivisor: 2,
    bassWave: 'sawtooth',
    bassDur: .22,
    bassVolume: .024,
  },
  'living-type-core': {
    notes: [196, 247, 294, 370, 440, 370, 294, 247, 220, 277, 330, 415, 494, 415, 330, 277],
    tempoMs: 280,
    wave: 'sawtooth',
    noteDur: .14,
    volume: .034,
    bassEvery: 4,
    bassDivisor: 2,
    bassWave: 'square',
    bassDur: .28,
    bassVolume: .026,
  },
};
let activeBgmThemeId = 'classic';
let activeBgmTheme = BGM_THEMES.classic;
let bgmStep = 0;
function setBgmTheme(themeId = 'classic') {
  const nextId = BGM_THEMES[themeId] ? themeId : 'classic';
  if (nextId === activeBgmThemeId) return;
  activeBgmThemeId = nextId;
  activeBgmTheme = BGM_THEMES[nextId];
  bgmStep = 0;
  if (bgmTimer) {
    stopBgm();
    startBgm();
  }
}
function setBgmThemeForLevel(level) {
  setBgmTheme(level && level.chapterId ? level.chapterId : 'classic');
}
function bgmTick() {
  const theme = activeBgmTheme || BGM_THEMES.classic;
  const notes = theme.notes || BGM_THEMES.classic.notes;
  const note = notes[bgmStep % notes.length];
  if (!muted && !musicMuted) {
    playTone(note, theme.noteDur || .22, theme.wave || 'sine', theme.volume || .05);
    if (theme.bassEvery && bgmStep % theme.bassEvery === 0) {
      playTone(note / (theme.bassDivisor || 2), theme.bassDur || .4, theme.bassWave || 'sine', theme.bassVolume || .04);
    }
  }
  bgmStep++;
}
function updateSoundButtons() {
  const buttons = [document.getElementById('mute'), document.getElementById('sound-toggle')].filter(Boolean);
  for (const btn of buttons) {
    btn.textContent = muted ? '🔊 開啟音效' : '🔇 關閉音效';
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.title = muted ? '開啟音效' : '關閉音效';
  }
}
function setAudioMuted(nextMuted) {
  muted = !!nextMuted;
  musicMuted = muted;
  localStorage.setItem(AUDIO_MUTED_KEY, muted ? '1' : '0');
  localStorage.setItem(MUSIC_MUTED_KEY, muted ? '1' : '0');
  if (muted) stopBgm();
  else if (audioUnlocked) startBgm();
  updateSoundButtons();
}
function toggleAudioMuted() {
  setAudioMuted(!muted);
}
function stopBgm() {
  if (!bgmTimer) return;
  clearInterval(bgmTimer);
  bgmTimer = null;
}
function startBgm() {
  if (muted || musicMuted) return;
  stopBgm();
  bgmTimer = setInterval(bgmTick, (activeBgmTheme || BGM_THEMES.classic).tempoMs || 380);
}
document.addEventListener('pointerdown', function once() {
  audioUnlocked = true;
  ac().resume();
  startBgm();
  document.removeEventListener('pointerdown', once);
}, { once: true });
document.getElementById('mute').onclick = toggleAudioMuted;
document.getElementById('sound-toggle').onclick = toggleAudioMuted;
updateSoundButtons();

