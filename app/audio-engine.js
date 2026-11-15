/**
 * Functional Ear Trainer Studio - Polyphonic Piano & Cadence Audio Engine
 * Pure WebAudio synthesis with multi-partial piano modeling, hammer transients,
 * stereo hall convolution reverb, voice-led cadences, and melodic resolution playback.
 */

class FunctionalAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.compressor = null;

    this.volume = 0.82;
    this.instrument = 'waf-jclive';
    this.cadenceSpeed = 0.7; // Slower, more deliberate cadence by default (adjustable in Settings).
    this.resolutionSpeed = 1.0;
    this.activeScheduledTimers = [];
    this.activeOscillators = new Set();
    this.noiseBuffer = null;

    // Sampled / wavetable instrument state (WebAudioFont + recorded FluidR3 samples).
    this.wafPlayer = null;
    this.sampleCache = {};
    this.sampleActiveSources = new Set();
    this._samplePlayLogged = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.22, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.setValueAtTime(0.84, this.ctx.currentTime);

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.26, this.ctx.currentTime);

      this.reverbNode = this.createConcertHallImpulse(1.9, 2.6);

      this.compressor.connect(this.dryGain);
      this.compressor.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbGain);

      this.dryGain.connect(this.masterGain);
      this.reverbGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Initialize the WebAudioFont wavetable player once the context exists.
      // Its output is routed through the same compressor/reverb/master chain.
      if (window.WebAudioFontPlayer) {
        this.wafPlayer = new WebAudioFontPlayer();
        this.wafPlayer.loader.decodeAfterLoading(this.ctx, '_tone_0000_FluidR3_GM_sf2_file');
        this.wafPlayer.loader.decodeAfterLoading(this.ctx, '_tone_0000_JCLive_sf2_file');
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  createConcertHallImpulse(duration = 1.8, decay = 2.5) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        const early = i < rate * 0.045 && i % 380 < 12 ? 0.45 : 1.0;
        data[i] = (Math.random() * 2 - 1) * env * early;
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setInstrument(inst) {
    this.instrument = inst;
    if (inst === 'waf-fluid' || inst === 'waf-jclive') {
      this._prepareWaf();
    } else if (inst === 'piano-samples') {
      this._prepareSamples();
    }
  }

  setCadenceSpeed(multiplier) {
    this.cadenceSpeed = Math.max(0.4, Math.min(1.6, multiplier));
  }

  setResolutionSpeed(multiplier) {
    this.resolutionSpeed = Math.max(0.4, Math.min(1.6, multiplier));
  }

  _midiToName(midi) {
    const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    return names[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  _dataURItoArrayBuffer(uri) {
    const b64 = uri.split(',')[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  _prepareWaf() {
    // init() creates the player and starts decoding the wavetable data.
    this.init();
  }

  _prepareSamples() {
    this.init();
    const sf = window.MIDI && window.MIDI.Soundfont ? window.MIDI.Soundfont.acoustic_grand_piano : null;
    if (!sf) {
      console.warn('[audio] Recorded samples data not loaded (window.MIDI.Soundfont.acoustic_grand_piano missing).');
      return;
    }
    // The app plays roughly MIDI 36-84; preload that range so first use is instant.
    for (let m = 36; m <= 84; m++) {
      this._getSample(m);
    }
  }

  _getSample(midi) {
    if (this.sampleCache[midi]) return Promise.resolve(this.sampleCache[midi]);
    const sf = window.MIDI && window.MIDI.Soundfont ? window.MIDI.Soundfont.acoustic_grand_piano : null;
    const uri = sf ? sf[this._midiToName(midi)] : null;
    if (!uri) return Promise.resolve(null);
    // Use the callback form of decodeAudioData (the same one WebAudioFont uses),
    // which is the most reliable across Chromium / WebView2 runtimes.
    return new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(
        this._dataURItoArrayBuffer(uri),
        (buffer) => {
          this.sampleCache[midi] = buffer;
          resolve(buffer);
        },
        (err) => {
          console.warn('sample decode failed for', this._midiToName(midi), err);
          reject(err);
        }
      );
    });
  }

  _playWafNote(fontVar, midi, duration, velocity, startTimeOffset) {
    const font = window[fontVar];
    if (!font || !this.wafPlayer) return;
    const anchor = this.ctx.currentTime + startTimeOffset;
    const play = (when) => {
      this.wafPlayer.queueWaveTable(this.ctx, this.compressor, font, when, midi, duration, velocity);
    };
    if (this.wafPlayer.loader.loaded(fontVar)) {
      play(anchor);
    } else {
      // Rare: instrument data still decoding on the very first note. Wait, then re-anchor.
      const poll = () => {
        if (this.wafPlayer.loader.loaded(fontVar)) {
          play(this.ctx.currentTime + Math.max(0, startTimeOffset));
        } else {
          setTimeout(poll, 30);
        }
      };
      setTimeout(poll, 0);
    }
  }

  _playSampleNote(midi, duration, velocity, startTimeOffset) {
    this._getSample(midi).then((buffer) => {
      if (!buffer) return;
      if (!this._samplePlayLogged) {
        this._samplePlayLogged = true;
        console.log('[audio] playing recorded sample note (midi ' + midi + ')');
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + startTimeOffset;
      gain.gain.setValueAtTime(velocity, t);
      if (duration) {
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.stop(t + duration + 0.08);
      }
      src.connect(gain);
      gain.connect(this.compressor);
      src.start(t);
      this.sampleActiveSources.add(src);
      src.onended = () => this.sampleActiveSources.delete(src);
    });
  }

  stopAll() {
    for (const timerId of this.activeScheduledTimers) {
      clearTimeout(timerId);
    }
    this.activeScheduledTimers = [];

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const item of this.activeOscillators) {
      try {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setValueAtTime(item.gain.gain.value || 0.001, now);
        item.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        item.osc.stop(now + 0.05);
      } catch (_) {}
    }
    this.activeOscillators.clear();

    // Stop sampled-note sources (AudioBufferSourceNode).
    for (const src of this.sampleActiveSources) {
      try { src.stop(0); } catch (_) {}
    }
    this.sampleActiveSources.clear();

    // Cancel any WebAudioFont envelope tails.
    if (this.wafPlayer) {
      try { this.wafPlayer.cancelQueue(this.ctx); } catch (_) {}
    }
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _getNoiseBuffer() {
    if (!this.noiseBuffer) {
      const length = Math.floor(this.ctx.sampleRate * 1.0);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.noiseBuffer;
  }

  playMidiNote(midi, duration = 0.75, velocity = 0.8, startTimeOffset = 0) {
    this.init();
    const now = this.ctx.currentTime + startTimeOffset;
    const freq = this.midiToFreq(midi);

    if (this.instrument === 'grand-piano') {
      this._synthGrandPiano(freq, midi, now, duration, velocity);
    } else if (this.instrument === 'waf-fluid') {
      this._playWafNote('_tone_0000_FluidR3_GM_sf2_file', midi, duration, velocity, startTimeOffset);
    } else if (this.instrument === 'waf-jclive') {
      this._playWafNote('_tone_0000_JCLive_sf2_file', midi, duration, velocity, startTimeOffset);
    } else if (this.instrument === 'piano-samples') {
      this._playSampleNote(midi, duration, velocity, startTimeOffset);
    } else if (this.instrument === 'electric-piano') {
      this._synthElectricPiano(freq, midi, now, duration, velocity);
    } else if (this.instrument === 'warm-pad') {
      this._synthWarmPad(freq, midi, now, duration, velocity);
    } else {
      this._synthClassicalPluck(freq, midi, now, duration, velocity);
    }
  }

  _synthGrandPiano(freq, midi, startTime, duration, velocity) {
    const noteGain = this.ctx.createGain();
    // Register compensation: bass carries more energy, treble is naturally thinner.
    const registerScale = midi < 48 ? 1.08 : midi < 60 ? 1.0 : midi < 72 ? 0.92 : 0.8;
    const peakGain = 0.30 * velocity * registerScale;
    const releaseStart = startTime + duration;
    const stopTime = startTime + duration + 0.6;

    // Master envelope: fast percussive attack, natural decay, then a soft damper release.
    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.004);
    noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.24, Math.max(startTime + 0.24, releaseStart));
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    // A gentle lowpass whose cutoff collapses with time (bright attack, warm body).
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const brightCutoff = Math.min(15000, 2000 + freq * 7 + velocity * 3200);
    const warmCutoff = Math.max(850, brightCutoff * 0.32);
    filter.frequency.setValueAtTime(brightCutoff, startTime);
    filter.frequency.exponentialRampToValueAtTime(warmCutoff, startTime + 0.55);
    filter.Q.setValueAtTime(0.35, startTime);

    filter.connect(noteGain);
    noteGain.connect(this.compressor);

    // Real piano strings are inharmonic: higher partials run increasingly sharp.
    // This is what gives an acoustic piano its characteristic "shimmer".
    const inharmonicity = 0.00004 + 0.0005 * Math.pow(2, (60 - midi) / 24);

    // Additive partials — each has its own decay, so high overtones die out first
    // exactly like a struck string. The first two partials use "unison" detune
    // (the 2–3 strings per note beating against each other).
    const partialCount = 12;
    for (let n = 1; n <= partialCount; n++) {
      const partialFreq = freq * n * Math.sqrt(1 + inharmonicity * n * n);
      if (partialFreq > 15000) break;

      const amp = Math.pow(1 / n, 1.12);
      const decayTime = Math.max(0.14, 1.5 / (1 + (n - 1) * 0.62));
      const unisonCents = n === 1 ? [-1.4, 0, 1.6] : n === 2 ? [-0.8, 1.0] : [0];

      unisonCents.forEach((cent) => {
        const osc = this.ctx.createOscillator();
        const pGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(partialFreq, startTime);
        if (cent !== 0) osc.detune.setValueAtTime(cent, startTime);

        pGain.gain.setValueAtTime(amp, startTime);
        pGain.gain.exponentialRampToValueAtTime(amp * 0.001, startTime + decayTime);

        osc.connect(pGain);
        pGain.connect(filter);
        osc.start(startTime);
        osc.stop(stopTime);

        const tracker = { osc, gain: noteGain };
        this.activeOscillators.add(tracker);
        osc.onended = () => this.activeOscillators.delete(tracker);
      });
    }

    // Hammer + felt strike transient: filtered noise burst for the attack click.
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this._getNoiseBuffer();
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(Math.min(6500, 1600 + freq * 2.4), startTime);
    noiseFilter.Q.setValueAtTime(1.1, startTime);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(peakGain * 0.42, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.03);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.compressor);
    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + 0.05);

    // Low "thump" of the key/hammer body hitting the string bed.
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(Math.max(70, Math.min(240, freq * 0.5)), startTime);
    thump.frequency.exponentialRampToValueAtTime(Math.max(55, freq * 0.24), startTime + 0.035);
    const thumpGain = this.ctx.createGain();
    thumpGain.gain.setValueAtTime(peakGain * 0.35, startTime);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
    thump.connect(thumpGain);
    thumpGain.connect(this.compressor);
    thump.start(startTime);
    thump.stop(startTime + 0.06);
  }

  _synthElectricPiano(freq, midi, startTime, duration, velocity) {
    const noteGain = this.ctx.createGain();
    const peakGain = 0.26 * velocity;

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
    noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.45, startTime + 0.25);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.45);

    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, startTime);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(freq * 2, startTime);

    modGain.gain.setValueAtTime(freq * 1.6 * velocity, startTime);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.15, startTime + 0.28);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(noteGain);
    noteGain.connect(this.compressor);

    const stopTime = startTime + duration + 0.48;
    modulator.start(startTime);
    carrier.start(startTime);
    modulator.stop(stopTime);
    carrier.stop(stopTime);

    const tracker = { osc: carrier, gain: noteGain };
    this.activeOscillators.add(tracker);
    carrier.onended = () => this.activeOscillators.delete(tracker);
  }

  _synthWarmPad(freq, midi, startTime, duration, velocity) {
    const noteGain = this.ctx.createGain();
    const peakGain = 0.22 * velocity;

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.06);
    noteGain.gain.setValueAtTime(peakGain * 0.85, startTime + duration * 0.7);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3.8, startTime);

    filter.connect(noteGain);
    noteGain.connect(this.compressor);

    const stopTime = startTime + duration + 0.5;
    [-6, 0, 6].forEach((det) => {
      const osc = this.ctx.createOscillator();
      osc.type = det === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.detune.setValueAtTime(det, startTime);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(det === 0 ? 0.55 : 0.22, startTime);
      osc.connect(g);
      g.connect(filter);
      osc.start(startTime);
      osc.stop(stopTime);

      const tracker = { osc, gain: noteGain };
      this.activeOscillators.add(tracker);
      osc.onended = () => this.activeOscillators.delete(tracker);
    });
  }

  _synthClassicalPluck(freq, midi, startTime, duration, velocity) {
    const noteGain = this.ctx.createGain();
    const peakGain = 0.28 * velocity;

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.004);
    noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.22, startTime + 0.16);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 7, startTime);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.8, startTime + 0.22);

    filter.connect(noteGain);
    noteGain.connect(this.compressor);

    const stopTime = startTime + duration + 0.35;
    [1, 2, 3].forEach((mult, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * mult, startTime);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(idx === 0 ? 0.85 : 0.25 / idx, startTime);
      osc.connect(g);
      g.connect(filter);
      osc.start(startTime);
      osc.stop(stopTime);

      const tracker = { osc, gain: noteGain };
      this.activeOscillators.add(tracker);
      osc.onended = () => this.activeOscillators.delete(tracker);
    });
  }

  playChord(midiNotes, duration = 0.45, velocity = 0.72, startTimeOffset = 0) {
    this.init();
    midiNotes.forEach((midi, idx) => {
      const strumOffset = idx * 0.008;
      const noteVel = idx === 0 ? velocity * 0.92 : velocity * 0.78;
      this.playMidiNote(midi, duration, noteVel, startTimeOffset + strumOffset);
    });
  }

  playCadence(keyRootSemitone = 0, mode = 'major', cadenceType = 'full') {
    this.init();
    const rootMidi = keyRootSemitone >= 8 ? 48 + keyRootSemitone : 60 + keyRootSemitone;
    const bassRoot = rootMidi - 12;

    const isMinor = mode === 'minor';
    const third = isMinor ? 3 : 4;
    const sixth = isMinor ? 8 : 9;

    const chordI = [bassRoot, rootMidi, rootMidi + third, rootMidi + 7];
    const chordIV = [bassRoot + 5, rootMidi, rootMidi + 5, rootMidi + sixth];
    const chordV7 = [bassRoot + 7, rootMidi - 1, rootMidi + 2, rootMidi + 5, rootMidi + 7];

    const speed = this.cadenceSpeed || 1.0;

    if (cadenceType === 'tonic-only') {
      const dur = 0.65 / speed;
      this.playChord(chordI, dur, 0.78, 0);
      return this._wait((dur + 0.18) * 1000);
    }

    const stepDur = 0.36 / speed;
    const finalDur = 0.56 / speed;
    const gap = 0.39 / speed;

    this.playChord(chordI, stepDur, 0.76, 0);
    this.playChord(chordIV, stepDur, 0.74, gap);
    this.playChord(chordV7, stepDur, 0.78, gap * 2);
    this.playChord(chordI, finalDur, 0.82, gap * 3);

    const totalMs = (gap * 3 + finalDur + 0.22) * 1000;
    return this._wait(totalMs);
  }

  getResolutionSemitones(semitoneOffset, mode = 'major') {
    const s = ((semitoneOffset % 12) + 12) % 12;
    const isMinor = mode === 'minor';
    const d3 = isMinor ? 3 : 4;
    const d6 = isMinor ? 8 : 9;

    switch (s) {
      case 0: return [0];
      case 1: return [1, 0];
      case 2: return [2, 0];
      case 3: return [3, 2, 0];
      case 4: return isMinor ? [4, 3, 2, 0] : [4, 2, 0];
      case 5: return [5, d3, 2, 0];
      case 6: return [6, 7, d6, 11, 12];
      case 7: return [7, d6, 11, 12];
      case 8: return isMinor ? [8, 11, 12] : [8, 7, 9, 11, 12];
      case 9: return [9, 11, 12];
      case 10: return [10, 11, 12];
      case 11: return [11, 12];
      default: return [0];
    }
  }

  playResolution(targetMidi, semitoneOffset, mode = 'major', onStep = null) {
    this.init();
    const path = this.getResolutionSemitones(semitoneOffset, mode);
    const baseTonicMidi = targetMidi - (((semitoneOffset % 12) + 12) % 12);
    const speed = this.resolutionSpeed || 1.0;
    const stepGap = 0.29 / speed;
    const finalDur = 0.65 / speed;

    path.forEach((stepSemi, idx) => {
      const isLast = idx === path.length - 1;
      const noteMidi = baseTonicMidi + stepSemi;
      const dur = isLast ? finalDur : stepGap * 0.92;
      const vel = isLast ? 0.88 : 0.76;
      const offsetSec = idx * stepGap;

      this.playMidiNote(noteMidi, dur, vel, offsetSec);

      if (onStep) {
        const timerId = setTimeout(() => {
          onStep(stepSemi % 12, stepSemi === 12, idx, path.length);
        }, offsetSec * 1000);
        this.activeScheduledTimers.push(timerId);
      }
    });

    const totalMs = ((path.length - 1) * stepGap + finalDur + 0.15) * 1000;
    return this._wait(totalMs);
  }

  playMelodySequence(sequence, bpm = 110, onNotePlay = null) {
    this.init();
    const beatSec = 60 / bpm;
    const noteDur = beatSec * 0.88;

    sequence.forEach((noteObj, idx) => {
      const offsetSec = idx * beatSec;
      this.playMidiNote(noteObj.midi, noteDur, 0.84, offsetSec);
      if (onNotePlay) {
        const timerId = setTimeout(() => {
          onNotePlay(idx, noteObj);
        }, offsetSec * 1000);
        this.activeScheduledTimers.push(timerId);
      }
    });

    const totalMs = (sequence.length * beatSec + 0.15) * 1000;
    return this._wait(totalMs);
  }

  speakAnswer(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.05;
        utter.pitch = 1.0;
        utter.volume = Math.min(1, this.volume + 0.1);
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
      } catch (_) {
        resolve();
      }
    });
  }

  _wait(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(resolve, ms);
      this.activeScheduledTimers.push(id);
    });
  }
}

window.FunctionalAudioEngine = FunctionalAudioEngine;

