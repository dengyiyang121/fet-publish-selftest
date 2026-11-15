(function () {
  'use strict';

  var NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // ---------------------------------------------------------------------------
  // Shared AudioContext + effects bus (used by the webaudiofont + sample engines,
  // so they are judged on timbre, not on different reverb/levels).
  // ---------------------------------------------------------------------------
  var newCtx = null;
  var busInput = null;

  function ensureNewCtx() {
    if (!newCtx) {
      newCtx = new (window.AudioContext || window.webkitAudioContext)();

      var compressor = newCtx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.22;

      var dry = newCtx.createGain();
      dry.gain.value = 0.84;
      var reverb = newCtx.createConvolver();
      reverb.buffer = makeImpulse(newCtx, 1.9, 2.6);
      var reverbGain = newCtx.createGain();
      reverbGain.gain.value = 0.26;
      var master = newCtx.createGain();
      master.gain.value = 1.0;

      busInput = newCtx.createGain();
      busInput.gain.value = 1.0;

      busInput.connect(compressor);
      compressor.connect(dry);
      compressor.connect(reverb);
      reverb.connect(reverbGain);
      dry.connect(master);
      reverbGain.connect(master);
      master.connect(newCtx.destination);
    }
    if (newCtx.state === 'suspended') newCtx.resume();
    return newCtx;
  }

  function makeImpulse(ctx, duration, decay) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * duration);
    var impulse = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = impulse.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        var t = i / length;
        var env = Math.pow(1 - t, decay);
        var early = i < rate * 0.045 && i % 380 < 12 ? 0.45 : 1.0;
        data[i] = (Math.random() * 2 - 1) * env * early;
      }
    }
    return impulse;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------------------------------------------------------------------------
  // Phrase definitions (C major)
  // ---------------------------------------------------------------------------
  var chordI = [48, 60, 64, 67];        // C3 C4 E4 G4
  var chordIV = [53, 60, 65, 69];       // F3 C4 F4 A4
  var chordV7 = [55, 59, 62, 65, 67];   // G3 B3 D4 F4 G4
  var CAD_GAP = 0.56;
  var CAD_STEP = 0.5;
  var CAD_FINAL = 0.8;
  var CAD_TOTAL_MS = 2900;

  // ---------------------------------------------------------------------------
  // Engine 1: the app's current additive synth (audio-engine.js)
  // ---------------------------------------------------------------------------
  var current = new window.FunctionalAudioEngine();

  // ---------------------------------------------------------------------------
  // Engines 2 & 3: WebAudioFont wavetable synthesis
  // ---------------------------------------------------------------------------
  var waf = new WebAudioFontPlayer();
  var WAF_FLUID = '_tone_0000_FluidR3_GM_sf2_file';
  var WAF_JCLIVE = '_tone_0000_JCLive_sf2_file';
  var WAF_NAMES = [WAF_FLUID, WAF_JCLIVE];

  ensureNewCtx();
  WAF_NAMES.forEach(function (n) { waf.loader.decodeAfterLoading(newCtx, n); });

  function wafLoaded(name) { return waf.loader.loaded(name); }

  async function waitWafReady() {
    for (var t = 0; t < 80; t++) {
      if (WAF_NAMES.every(wafLoaded)) return true;
      await sleep(100);
    }
    return WAF_NAMES.every(wafLoaded);
  }

  function wafNote(preset, midi, velocity, duration, whenOffset) {
    var ctx = ensureNewCtx();
    waf.queueWaveTable(ctx, busInput, window[preset], ctx.currentTime + whenOffset, midi, duration, velocity);
  }

  function wafChord(preset, midis, velocity, duration, whenOffset) {
    midis.forEach(function (m, i) { wafNote(preset, m, velocity, duration, whenOffset + i * 0.01); });
  }

  function wafCadence(preset) {
    wafChord(preset, chordI, 0.8, CAD_STEP, 0.05);
    wafChord(preset, chordIV, 0.78, CAD_STEP, 0.05 + CAD_GAP);
    wafChord(preset, chordV7, 0.82, CAD_STEP, 0.05 + CAD_GAP * 2);
    wafChord(preset, chordI, 0.85, CAD_FINAL, 0.05 + CAD_GAP * 3);
  }

  // ---------------------------------------------------------------------------
  // Engine 4: recorded samples (FluidR3 acoustic grand piano, base64 mp3)
  // ---------------------------------------------------------------------------
  var sampleMap = window.MIDI.Soundfont.acoustic_grand_piano;
  var sampleCache = {};
  var activeSampleSources = new Set();

  function midiToName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function dataURItoArrayBuffer(uri) {
    var b64 = uri.split(',')[1];
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function getSample(midi) {
    if (sampleCache[midi]) return Promise.resolve(sampleCache[midi]);
    var name = midiToName(midi);
    var uri = sampleMap[name];
    if (!uri) { console.warn('no sample for ' + name); return Promise.resolve(null); }
    var ctx = ensureNewCtx();
    return new Promise(function (resolve, reject) {
      ctx.decodeAudioData(dataURItoArrayBuffer(uri), function (buf) {
        sampleCache[midi] = buf;
        resolve(buf);
      }, function (err) {
        console.warn('sample decode failed for ' + name, err);
        reject(err);
      });
    });
  }

  function sampleNote(midi, velocity, duration, whenOffset) {
    var ctx = ensureNewCtx();
    getSample(midi).then(function (buf) {
      if (!buf) return;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var g = ctx.createGain();
      var t = ctx.currentTime + whenOffset;
      g.gain.setValueAtTime(velocity, t);
      if (duration) {
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.stop(t + duration + 0.08);
      }
      src.connect(g);
      g.connect(busInput);
      src.start(t);
      activeSampleSources.add(src);
      src.onended = function () { activeSampleSources.delete(src); };
    });
  }

  function sampleChord(midis, velocity, duration, whenOffset) {
    midis.forEach(function (m, i) { sampleNote(m, velocity, duration, whenOffset + i * 0.01); });
  }

  function sampleCadence() {
    sampleChord(chordI, 0.8, CAD_STEP, 0.05);
    sampleChord(chordIV, 0.78, CAD_STEP, 0.05 + CAD_GAP);
    sampleChord(chordV7, 0.82, CAD_STEP, 0.05 + CAD_GAP * 2);
    sampleChord(chordI, 0.85, CAD_FINAL, 0.05 + CAD_GAP * 3);
  }

  // Preload the notes used by the phrases so the sample engine is responsive.
  var PRELOAD_MIDI = [48, 53, 55, 59, 60, 62, 64, 65, 67, 69, 72, 84];
  function preloadSamples() {
    PRELOAD_MIDI.forEach(function (m) { getSample(m); });
  }

  // ---------------------------------------------------------------------------
  // Engines registry
  // ---------------------------------------------------------------------------
  var engines = [
    {
      id: 'current',
      title: 'Current additive synth',
      sub: 'The app\u2019s existing audio-engine.js (grand-piano)',
      isReady: function () { return true; },
      async play(phrase) {
        if (phrase.kind === 'cadence') {
          await current.playCadence(0, 'major', 'full');
        } else if (phrase.kind === 'note') {
          current.playMidiNote(phrase.midis[0], phrase.duration, 0.85, 0);
          await sleep(phrase.duration * 1000 + 120);
        } else {
          current.playChord(phrase.midis, phrase.duration, 0.75, 0);
          await sleep(phrase.duration * 1000 + 120);
        }
      }
    },
    {
      id: 'waf-fluid',
      title: 'WebAudioFont - FluidR3',
      sub: 'Wavetable synthesis of the FluidR3 grand piano',
      isReady: function () { return wafLoaded(WAF_FLUID); },
      async play(phrase) {
        if (phrase.kind === 'cadence') {
          wafCadence(WAF_FLUID);
          await sleep(CAD_TOTAL_MS);
        } else if (phrase.kind === 'note') {
          wafNote(WAF_FLUID, phrase.midis[0], 0.9, phrase.duration, 0.03);
          await sleep(phrase.duration * 1000 + 120);
        } else {
          wafChord(WAF_FLUID, phrase.midis, 0.8, phrase.duration, 0.03);
          await sleep(phrase.duration * 1000 + 120);
        }
      }
    },
    {
      id: 'waf-jclive',
      title: 'WebAudioFont - JCLive',
      sub: 'Wavetable synthesis of the JCLive grand piano',
      isReady: function () { return wafLoaded(WAF_JCLIVE); },
      async play(phrase) {
        if (phrase.kind === 'cadence') {
          wafCadence(WAF_JCLIVE);
          await sleep(CAD_TOTAL_MS);
        } else if (phrase.kind === 'note') {
          wafNote(WAF_JCLIVE, phrase.midis[0], 0.9, phrase.duration, 0.03);
          await sleep(phrase.duration * 1000 + 120);
        } else {
          wafChord(WAF_JCLIVE, phrase.midis, 0.8, phrase.duration, 0.03);
          await sleep(phrase.duration * 1000 + 120);
        }
      }
    },
    {
      id: 'samples',
      title: 'Recorded samples - FluidR3',
      sub: 'Raw mp3 samples (base64) via AudioBufferSourceNode',
      isReady: function () { return true; },
      async play(phrase) {
        if (phrase.kind === 'cadence') {
          sampleCadence();
          await sleep(CAD_TOTAL_MS);
        } else if (phrase.kind === 'note') {
          sampleNote(phrase.midis[0], 0.85, phrase.duration, 0.03);
          await sleep(phrase.duration * 1000 + 120);
        } else {
          sampleChord(phrase.midis, 0.75, phrase.duration, 0.03);
          await sleep(phrase.duration * 1000 + 120);
        }
      }
    }
  ];

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  var selectedPhrase = 'note';
  var noteMidi = 60;
  var grid = document.getElementById('engine-grid');
  var statusLine = document.getElementById('status-line');
  var playing = false;

  var phrases = {
    note: { kind: 'note', label: 'Single note', duration: 2.2 },
    chord: { kind: 'chord', label: 'Chord', duration: 1.8 },
    cadence: { kind: 'cadence', label: 'Cadence', duration: 2.9 }
  };

  function buildPhrase(phraseKey) {
    var p = phrases[phraseKey];
    return {
      kind: p.kind,
      duration: p.duration,
      midis: p.kind === 'chord' ? chordI : [noteMidi]
    };
  }

  var cards = {};
  engines.forEach(function (engine) {
    var card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = engine.id;
    card.innerHTML =
      '<div class="card-top">' +
        '<div>' +
          '<div class="card-title">' + engine.title + '</div>' +
          '<div class="card-sub">' + engine.sub + '</div>' +
        '</div>' +
        '<span class="badge loading" data-badge>' + (engine.isReady() ? 'ready' : 'loading') + '</span>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn" data-play>Play</button>' +
      '</div>';
    grid.appendChild(card);
    cards[engine.id] = card;

    card.querySelector('[data-play]').addEventListener('click', function () {
      playEngine(engine);
    });
  });

  function setBadge(engine, state, text) {
    var el = cards[engine.id].querySelector('[data-badge]');
    el.textContent = text;
    el.className = 'badge ' + state;
  }

  function refreshBadges() {
    engines.forEach(function (engine) {
      var ready = engine.isReady();
      setBadge(engine, ready ? 'ready' : 'loading', ready ? 'ready' : 'loading');
    });
  }

  function setPlaying(engineId) {
    Object.keys(cards).forEach(function (id) {
      cards[id].classList.toggle('playing', id === engineId && playing);
    });
  }

  async function playEngine(engine) {
    if (playing) return;
    if (!engine.isReady()) {
      statusLine.textContent = engine.title + ' is still loading\u2026';
      return;
    }
    playing = true;
    setPlaying(engine.id);
    statusLine.textContent = 'Playing: ' + engine.title;
    try {
      await engine.play(buildPhrase(selectedPhrase));
    } catch (e) {
      console.error(e);
    }
    playing = false;
    setPlaying(null);
    statusLine.textContent = 'Done.';
  }

  // Phrase segmented control
  document.getElementById('phrase-seg').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-phrase]');
    if (!btn) return;
    selectedPhrase = btn.dataset.phrase;
    document.querySelectorAll('#phrase-seg button').forEach(function (b) {
      b.classList.toggle('active', b === btn);
    });
  });

  // Note pitch selector
  document.getElementById('note-select').addEventListener('change', function (e) {
    noteMidi = parseInt(e.target.value, 10);
  });

  // Play all engines sequentially (A/B)
  document.getElementById('btn-compare').addEventListener('click', async function () {
    if (playing) return;
    playing = true;
    for (var i = 0; i < engines.length; i++) {
      var engine = engines[i];
      if (!engine.isReady()) { statusLine.textContent = 'Skipping (not ready): ' + engine.title; continue; }
      setPlaying(engine.id);
      statusLine.textContent = (i + 1) + '/4: ' + engine.title;
      await engine.play(buildPhrase(selectedPhrase));
      await sleep(420);
    }
    playing = false;
    setPlaying(null);
    statusLine.textContent = 'Comparison complete.';
  });

  // Stop
  document.getElementById('btn-stop').addEventListener('click', function () {
    current.stopAll();
    if (newCtx) waf.cancelQueue(newCtx);
    activeSampleSources.forEach(function (src) {
      try { src.stop(0); } catch (e) {}
    });
    activeSampleSources.clear();
    playing = false;
    setPlaying(null);
    statusLine.textContent = 'Stopped.';
  });

  // Boot
  (async function boot() {
    preloadSamples();
    await waitWafReady();
    refreshBadges();
    statusLine.textContent = 'Ready - press a Play button.';
    setInterval(refreshBadges, 800);
  })();
})();




