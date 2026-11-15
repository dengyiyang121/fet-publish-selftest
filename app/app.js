/**
 * Functional Ear Trainer Studio - Main Application Controller
 */

class FunctionalEarTrainerApp {
  constructor() {
    this.audio = new window.FunctionalAudioEngine();
    this.storageKey = 'fet_studio_progress_v2';
    this.stats = this.loadStats();

    this.currentView = 'single';
    this.exerciseMode = 'single';
    this.labelMode = 'both';
    this.activeLevel = window.SINGLE_NOTE_CURRICULUM[0].levels[0];

    this.customSelectedDegrees = new Set([0, 2, 4, 5, 7, 9, 11]);
    this.handsFreeEnabled = false;
    this.handsFreeDelaySec = 1.5;
    this.noteGapMs = 550;
    this.autoAdvanceMs = 300;
    this.cadenceType = 'full';
    this.inPracticeRoom = false;

    this.sessionActive = false;
    this.awaitingAnswer = false;
    this.isBusyPlaying = false;
    this.questionIndex = 0;
    this.totalQuestions = 20;
    this.correctFirstTryCount = 0;
    this.currentStreak = 0;
    this.sessionBestStreak = 0;
    this.currentQuestionFirstTry = true;

    this.currentKeyRoot = 0;
    this.previousKeyRoot = null;
    this.targetNote = null;
    this.lastMidiNote = null;

    this.melodySequence = [];
    this.currentSlotIndex = 0;
    this.slotFirstTry = [];
    this.slotSolved = [];

    this.sessionId = null;
    this.currentSingleEntry = null;
    this.currentMelodicEntries = null;

    this.initDOM();
    this.applyTimingSettings(this.loadTimingSettings());
    this.applyTimingSettingsToUI();
    this.renderPianoKeyboard();
    this.renderResolutionNodes();
    this.renderCustomDegreeToggles();
    this.renderSavedSessions();
    this.selectLevel(window.SINGLE_NOTE_CURRICULUM[0].levels[0], 'single');
    this.bindEvents();
  }

  loadStats() {
    const defaults = {
      totalQuestions: 0,
      totalFirstTryCorrect: 0,
      bestStreak: 0,
      levelRecords: {},
      degreeStats: {},
      history: [],
      detailLog: [],
    };
    for (let i = 0; i < 12; i++) {
      defaults.degreeStats[i] = { attempts: 0, correct: 0 };
    }
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        degreeStats: { ...defaults.degreeStats, ...(parsed.degreeStats || {}) },
        levelRecords: { ...(parsed.levelRecords || {}) },
        history: Array.isArray(parsed.history) ? parsed.history : [],
        detailLog: Array.isArray(parsed.detailLog) ? parsed.detailLog : [],
      };
    } catch (_) {
      return defaults;
    }
  }

  saveStats() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.stats));
    } catch (_) {}
  }

  getTimingSettings() {
    return {
      cadenceSpeed: this.audio.cadenceSpeed,
      resolutionSpeed: this.audio.resolutionSpeed,
      noteGapMs: this.noteGapMs,
      handsFreeDelaySec: this.handsFreeDelaySec,
      autoAdvanceMs: this.autoAdvanceMs,
    };
  }

  applyTimingSettings(s) {
    if (!s) return;
    if (typeof s.cadenceSpeed === 'number') this.audio.cadenceSpeed = Math.max(0.4, Math.min(1.6, s.cadenceSpeed));
    if (typeof s.resolutionSpeed === 'number') this.audio.resolutionSpeed = Math.max(0.4, Math.min(1.6, s.resolutionSpeed));
    if (typeof s.noteGapMs === 'number') this.noteGapMs = Math.max(0, Math.min(2000, s.noteGapMs));
    if (typeof s.handsFreeDelaySec === 'number') this.handsFreeDelaySec = Math.max(0.5, Math.min(8, s.handsFreeDelaySec));
    if (typeof s.autoAdvanceMs === 'number') this.autoAdvanceMs = Math.max(0, Math.min(2000, s.autoAdvanceMs));
  }

  loadTimingSettings() {
    try {
      const raw = localStorage.getItem('fet_audio_settings_v1');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  saveTimingSettings() {
    try {
      localStorage.setItem('fet_audio_settings_v1', JSON.stringify(this.getTimingSettings()));
    } catch (_) {}
  }

  applyTimingSettingsToUI() {
    const cadPct = Math.round(this.audio.cadenceSpeed * 100);
    const resPct = Math.round(this.audio.resolutionSpeed * 100);
    const gapSec = this.noteGapMs / 1000;
    const advSec = this.autoAdvanceMs / 1000;
    document.getElementById('cadence-speed-slider').value = cadPct;
    document.getElementById('cadence-speed-val').textContent = `${cadPct}%`;
    document.getElementById('resolution-speed-slider').value = resPct;
    document.getElementById('resolution-speed-val').textContent = `${resPct}%`;
    document.getElementById('note-gap-slider').value = gapSec;
    document.getElementById('note-gap-val').textContent = `${gapSec.toFixed(2)}s`;
    document.getElementById('handsfree-pause-slider').value = this.handsFreeDelaySec;
    document.getElementById('handsfree-pause-val').textContent = `${this.handsFreeDelaySec}s`;
    document.getElementById('auto-advance-slider').value = advSec;
    document.getElementById('auto-advance-val').textContent = `${advSec.toFixed(2)}s`;
  }

  getKeyLabel() {
    const keyInfo = window.KEY_NAMES[this.currentKeyRoot || 0];
    const isMinor = this.activeLevel && this.activeLevel.mode === 'minor';
    if (!keyInfo) return 'Unknown';
    return isMinor ? keyInfo.minorLabel : keyInfo.majorLabel;
  }

  describeSemitone(semitone) {
    const meta = this.getDegreeMeta(semitone);
    const keyInfo = window.KEY_NAMES[this.currentKeyRoot || 0];
    return {
      semitone: meta.semitone,
      degree: meta.degree,
      solfege: meta.solfege,
      note: keyInfo ? keyInfo.notes[meta.semitone] : '',
    };
  }

  buildLogEntry(targetSemi, targetMidi, slotIndex, phraseLength) {
    const lvl = this.activeLevel || {};
    const target = this.describeSemitone(targetSemi);
    return {
      ts: new Date().toISOString(),
      sessionId: this.sessionId,
      mode: this.exerciseMode,
      levelCode: lvl.code || 'CUST',
      levelTitle: lvl.title || 'Custom Session',
      keyRoot: this.currentKeyRoot,
      tonality: lvl.mode || 'major',
      keyLabel: this.getKeyLabel(),
      questionIndex: this.questionIndex,
      slotIndex,
      phraseLength,
      targetSemi,
      targetDegree: target.degree,
      targetSolfege: target.solfege,
      targetNote: target.note,
      targetMidi,
      attempts: [],
      correct: false,
      firstTryCorrect: false,
    };
  }

  recordLogAttempt(entry, guessedSemitone, isCorrect) {
    if (!entry) return;
    entry.attempts.push({ ...this.describeSemitone(guessedSemitone), correct: !!isCorrect });
  }

  finalizeLogEntry(entry, firstTry) {
    if (!entry) return;
    entry.correct = true;
    entry.firstTryCorrect = !!firstTry;
    entry.attemptCount = entry.attempts.length;
    this.stats.detailLog = this.stats.detailLog || [];
    this.stats.detailLog.push(entry);
    // Cap the log so localStorage never grows unbounded.
    if (this.stats.detailLog.length > 10000) {
      this.stats.detailLog.splice(0, this.stats.detailLog.length - 10000);
    }
    this.saveStats();
  }

  async exportDetailLog() {
    const statusEl = document.getElementById('stat-export-status');
    const log = this.stats.detailLog || [];
    if (!log.length) {
      if (statusEl) statusEl.textContent = 'No detailed log entries yet - complete some questions first.';
      return;
    }
    const lines = log.map((e) => JSON.stringify(e)).join('\n');
    const filename = `ear-trainer-log-${new Date().toISOString().slice(0, 10)}.jsonl`;

    // WebView2 host object: writes to Documents\FunctionalEarTrainer.
    if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects) {
      try {
        const saver = window.chrome.webview.hostObjects.nativeFile;
        const path = await saver.SaveTextFile(filename, lines);
        if (statusEl) statusEl.textContent = `Saved ${log.length} entries to ${path}`;
        return;
      } catch (e) {
        // Fall through to the browser download fallback below.
      }
    }

    // Browser fallback: download the file.
    const blob = new Blob([lines], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (statusEl) statusEl.textContent = `Download started (${log.length} entries).`;
  }

  initDOM() {
    this.els = {
      screenHub: document.getElementById('screen-hub'),
      screenPractice: document.getElementById('screen-practice'),
      practiceProgressLine: document.getElementById('practice-progress-line'),
      hubCurriculumSection: document.getElementById('hub-curriculum-section'),
      sidebarHeading: document.getElementById('sidebar-mode-heading'),
      hubSectionSub: document.getElementById('hub-section-sub'),
      sidebarBadge: document.getElementById('sidebar-completion-badge'),
      curriculumList: document.getElementById('curriculum-list'),
      viewCustom: document.getElementById('view-custom'),
      viewStats: document.getElementById('view-stats'),
      btnResumeActiveLevel: document.getElementById('btn-resume-active-level'),
      btnBackHub: document.getElementById('btn-back-hub'),
      settingsToggleBtn: document.getElementById('settings-toggle-btn'),
      settingsPopover: document.getElementById('settings-popover'),

      levelCode: document.getElementById('active-level-code'),
      levelTitle: document.getElementById('active-level-title'),
      metricKey: document.getElementById('metric-key'),
      metricProgress: document.getElementById('metric-progress'),
      metricAccuracy: document.getElementById('metric-accuracy'),
      metricStreak: document.getElementById('metric-streak'),
      handsfreeBtn: document.getElementById('handsfree-toggle-btn'),
      handsfreeStatus: document.getElementById('handsfree-status'),

      singleStage: document.getElementById('single-note-stage'),
      statusReadout: document.getElementById('status-readout'),
      orbMain: document.getElementById('orb-main-label'),
      orbSub: document.getElementById('orb-sub-label'),
      resolutionNodes: document.getElementById('resolution-nodes'),
      resolutionCaption: document.getElementById('resolution-caption'),
      melodicStage: document.getElementById('melodic-stage'),
      melodicStatus: document.getElementById('melodic-prompt-status'),
      melodicMetaBadge: document.getElementById('melodic-meta-badge'),
      melodicSlotsRow: document.getElementById('melodic-slots-row'),
      melodicContourSvg: document.getElementById('melodic-contour-svg'),

      btnStartNext: document.getElementById('btn-start-next'),
      btnReplayNote: document.getElementById('btn-replay-note'),
      replayNoteLabel: document.getElementById('replay-note-label'),
      btnReplayCadence: document.getElementById('btn-replay-cadence'),
      btnHintResolve: document.getElementById('btn-hint-resolve'),
      btnRestartSession: document.getElementById('btn-restart-session'),
      chkAutoAdvance: document.getElementById('chk-auto-advance'),
      chkResolveOnCorrect: document.getElementById('chk-resolve-on-correct'),
      chkCadenceAlways: document.getElementById('chk-cadence-always'),
      pianoBlackRow: document.getElementById('piano-black-row'),
      pianoWhiteRow: document.getElementById('piano-white-row'),

      modal: document.getElementById('level-complete-modal'),
      modalStars: document.getElementById('modal-stars'),
      modalTitle: document.getElementById('modal-title'),
      modalSubtitle: document.getElementById('modal-subtitle'),
      modalAccuracy: document.getElementById('modal-accuracy'),
      modalStreak: document.getElementById('modal-streak'),
      modalBtnRetry: document.getElementById('modal-btn-retry'),
      modalBtnNext: document.getElementById('modal-btn-next'),
    };
  }
  getDegreeMeta(semitone) {
    return window.SCALE_DEGREES.find((d) => d.semitone === ((semitone % 12) + 12) % 12);
  }

  formatKeyLabels(degMeta) {
    const isMinor = this.activeLevel && this.activeLevel.mode === 'minor';
    const degStr = isMinor ? degMeta.minorDegree : degMeta.degree;
    const solStr = degMeta.solfege;
    const keyInfo = window.KEY_NAMES[this.currentKeyRoot || 0];
    const noteStr = keyInfo ? keyInfo.notes[degMeta.semitone] : '';

    if (this.labelMode === 'degree') return { primary: degStr, secondary: noteStr };
    if (this.labelMode === 'solfege') return { primary: solStr, secondary: degStr };
    if (this.labelMode === 'note') return { primary: noteStr, secondary: `${degStr} · ${solStr}` };
    return { primary: degStr, secondary: solStr };
  }

  renderCurriculumSidebar() {
    const curriculum =
      this.exerciseMode === 'melodic'
        ? window.MELODIC_DICTATION_CURRICULUM
        : window.SINGLE_NOTE_CURRICULUM;

    this.els.sidebarHeading.textContent =
      this.exerciseMode === 'melodic' ? 'Melodic Dictation' : 'Single-Note Training';
    this.els.hubSectionSub.textContent =
      this.exerciseMode === 'melodic'
        ? 'Select a dictation stage to open the full-screen practice room.'
        : 'Select a level to open the full-screen practice room.';

    let totalLevels = 0;
    let earnedStars = 0;
    this.els.curriculumList.innerHTML = '';

    curriculum.forEach((chapter) => {
      const block = document.createElement('div');
      block.className = 'chapter-block';

      const title = document.createElement('div');
      title.className = 'chapter-title';
      title.textContent = chapter.chapterTitle;

      const sub = document.createElement('div');
      sub.className = 'chapter-subtitle';
      sub.textContent = chapter.subtitle;

      const headerRow = document.createElement('div');
      headerRow.className = 'chapter-header-row';
      headerRow.appendChild(title);
      headerRow.appendChild(sub);
      block.appendChild(headerRow);

      const grid = document.createElement('div');
      grid.className = 'chapter-levels-grid';

      chapter.levels.forEach((lvl) => {
        totalLevels += 3;
        const rec = this.stats.levelRecords[lvl.id] || { stars: 0, bestAccuracy: 0 };
        earnedStars += rec.stars || 0;

        const item = document.createElement('div');
        item.className = 'level-item' + (this.activeLevel && this.activeLevel.id === lvl.id ? ' active' : '');
        item.dataset.levelId = lvl.id;

        const starsStr = '★'.repeat(rec.stars || 0) + '☆'.repeat(3 - (rec.stars || 0));
        item.innerHTML = `
          <div class="level-top-row">
            <span class="level-code">${lvl.code}</span>
            <span class="level-stars" title="Best: ${rec.bestAccuracy || 0}%">${starsStr}</span>
          </div>
          <div class="level-name">${lvl.title}</div>
          <div class="level-desc">${lvl.description}</div>
        `;

        item.addEventListener('click', () => this.openPracticeRoom(lvl, this.exerciseMode));
        grid.appendChild(item);
      });

      block.appendChild(grid);
      this.els.curriculumList.appendChild(block);
    });

    this.els.sidebarBadge.textContent = `${earnedStars} / ${totalLevels} ★`;
  }

  renderPianoKeyboard() {
    this.els.pianoBlackRow.innerHTML = '';
    this.els.pianoWhiteRow.innerHTML = '';

    const activeSet = new Set(this.activeLevel ? this.activeLevel.degrees : [0, 2, 4, 5, 7, 9, 11]);
    const blackLayout = [1, 3, null, 6, 8, 10, null, null];

    blackLayout.forEach((semi) => {
      if (semi === null) {
        const spacer = document.createElement('div');
        spacer.className = 'black-spacer';
        this.els.pianoBlackRow.appendChild(spacer);
        return;
      }
      const meta = this.getDegreeMeta(semi);
      this.els.pianoBlackRow.appendChild(this.createPianoKeyElement(meta, 'black-key', activeSet.has(semi)));
    });

    [0, 2, 4, 5, 7, 9, 11].forEach((semi) => {
      const meta = this.getDegreeMeta(semi);
      this.els.pianoWhiteRow.appendChild(this.createPianoKeyElement(meta, 'white-key', activeSet.has(semi)));
    });

    // High Do (octave-up tonic) at the far right.
    const highDoMeta = this.getDegreeMeta(12);
    const highDoLabels = this.formatKeyLabels(highDoMeta);
    const highDoBtn = document.createElement('button');
    highDoBtn.type = 'button';
    highDoBtn.className = 'piano-key white-key high-do-key' + (activeSet.has(0) ? '' : ' disabled-key');
    highDoBtn.dataset.semitone = '12';
    highDoBtn.innerHTML = `
      <span class="key-shortcut-hint">8</span>
      <span class="key-primary-label">${highDoLabels.primary}<sup class="octave-mark">8</sup></span>
      <span class="key-secondary-label">${highDoLabels.secondary}</span>
    `;
    highDoBtn.addEventListener('click', () => {
      if (!activeSet.has(0)) return;
      this.handleUserDegreeInput(12);
    });
    this.els.pianoWhiteRow.appendChild(highDoBtn);
  }

  createPianoKeyElement(meta, keyClass, isEnabled) {
    const btn = document.createElement('button');
    btn.className = `piano-key ${keyClass}` + (isEnabled ? '' : ' disabled-key');
    btn.dataset.semitone = meta.semitone;
    const labels = this.formatKeyLabels(meta);
    btn.innerHTML = `
      <span class="key-shortcut-hint">${meta.shortcut}</span>
      <span class="key-primary-label">${labels.primary}</span>
      <span class="key-secondary-label">${labels.secondary}</span>
    `;
    btn.addEventListener('click', () => {
      if (!isEnabled) return;
      this.handleUserDegreeInput(meta.semitone);
    });
    return btn;
  }
  renderResolutionNodes() {
    const isMinor = this.activeLevel && this.activeLevel.mode === 'minor';
    const nodes = [
      { semi: 0, deg: '1', sol: 'Do', tonic: true },
      { arrow: '←' },
      { semi: 2, deg: '2', sol: 'Re' },
      { arrow: '←' },
      { semi: isMinor ? 3 : 4, deg: isMinor ? '♭3' : '3', sol: isMinor ? 'Me' : 'Mi' },
      { arrow: '←' },
      { semi: 5, deg: '4', sol: 'Fa' },
      { divider: true },
      { semi: 7, deg: '5', sol: 'Sol' },
      { arrow: '→' },
      { semi: isMinor ? 8 : 9, deg: isMinor ? '♭6' : '6', sol: isMinor ? 'Le' : 'La' },
      { arrow: '→' },
      { semi: 11, deg: '7', sol: 'Ti' },
      { arrow: '→' },
      { semi: 12, deg: '1 (8)', sol: 'Do', tonic: true },
    ];

    const activeSet = new Set(this.activeLevel ? this.activeLevel.degrees : [0, 2, 4, 5, 7, 9, 11]);

    this.els.resolutionNodes.innerHTML = '';
    nodes.forEach((n) => {
      if (n.arrow || n.divider) {
        const sp = document.createElement('span');
        sp.className = 'res-dir-arrow';
        sp.textContent = n.arrow || '·';
        this.els.resolutionNodes.appendChild(sp);
        return;
      }
      const normSemi = ((n.semi % 12) + 12) % 12;
      const isActive = activeSet.has(normSemi);
      const box = document.createElement('div');
      box.className = 'res-node' + (n.tonic ? ' tonic' : '') + (isActive ? '' : ' disabled');
      box.dataset.resSemi = n.semi;
      box.title = `Play ${n.deg} (${n.sol})`;
      box.innerHTML = `
        <span class="res-node-deg">${n.deg}</span>
        <span class="res-node-sol">${n.sol}</span>
      `;
      if (isActive) {
        box.addEventListener('click', () => {
          this.handleUserDegreeInput(n.semi);
        });
      }
      this.els.resolutionNodes.appendChild(box);
    });
  }

  renderMelodicSlots() {
    const len = this.melodySequence.length || (this.activeLevel.sequenceLength || 4);
    this.els.melodicSlotsRow.innerHTML = '';

    for (let i = 0; i < len; i++) {
      const slot = document.createElement('div');
      slot.className = 'melodic-slot';
      if (this.awaitingAnswer && i === this.currentSlotIndex) {
        slot.classList.add('active-cursor');
      }
      if (this.slotSolved[i]) {
        slot.classList.add('solved');
      }
      slot.dataset.slotIndex = i;

      let mainTxt = '?';
      let subTxt = `Note ${i + 1}`;
      if (this.slotSolved[i] && this.melodySequence[i]) {
        const meta = this.getDegreeMeta(this.melodySequence[i].degreeSemitone);
        const labels = this.formatKeyLabels(meta);
        mainTxt = labels.primary;
        subTxt = labels.secondary;
      }

      slot.innerHTML = `
        <span class="melodic-slot-index">#${i + 1}</span>
        <span class="melodic-slot-main">${mainTxt}</span>
        <span class="melodic-slot-sub">${subTxt}</span>
      `;

      // Clicking a slot replays that individual note as an ear hint
      slot.addEventListener('click', () => {
        if (this.melodySequence[i]) {
          this.audio.playMidiNote(this.melodySequence[i].midi, 0.65, 0.85, 0);
        }
      });

      this.els.melodicSlotsRow.appendChild(slot);
    }

    this.renderMelodicContourLine();
  }

  renderMelodicContourLine() {
    const svg = this.els.melodicContourSvg;
    if (!svg) return;
    svg.innerHTML = '';
    if (!this.melodySequence || this.melodySequence.length < 2) return;

    const slots = Array.from(this.els.melodicSlotsRow.querySelectorAll('.melodic-slot'));
    if (slots.length < 2) return;

    const wrapRect = svg.getBoundingClientRect();
    if (!wrapRect.width || !wrapRect.height) return;

    const points = [];
    const midis = this.melodySequence.map((n) => n.midi);
    const minMidi = Math.min(...midis) - 2;
    const maxMidi = Math.max(...midis) + 2;

    slots.forEach((slotEl, idx) => {
      if (!this.slotSolved[idx]) return;
      const r = slotEl.getBoundingClientRect();
      const x = r.left - wrapRect.left + r.width / 2;
      const normY = (this.melodySequence[idx].midi - minMidi) / Math.max(1, maxMidi - minMidi);
      const y = wrapRect.height - 20 - normY * (wrapRect.height - 40);
      points.push(`${x},${y}`);
    });

    if (points.length >= 2) {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', points.join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', 'rgba(56, 189, 248, 0.55)');
      poly.setAttribute('stroke-width', '3');
      poly.setAttribute('stroke-linecap', 'round');
      svg.appendChild(poly);
    }
  }

  renderCustomDegreeToggles() {
    const container = document.getElementById('custom-degree-toggles');
    if (!container) return;
    container.innerHTML = '';

    window.SCALE_DEGREES.forEach((deg) => {
      const btn = document.createElement('button');
      const isSel = this.customSelectedDegrees.has(deg.semitone);
      btn.className = 'cust-deg-btn' + (isSel ? ' selected' : '');
      btn.innerHTML = `
        <strong style="font-size:15px;">${deg.degree}</strong>
        <span style="font-size:11px;">${deg.solfege}</span>
      `;
      btn.addEventListener('click', () => {
        if (this.customSelectedDegrees.has(deg.semitone)) {
          if (this.customSelectedDegrees.size > 1) {
            this.customSelectedDegrees.delete(deg.semitone);
          }
        } else {
          this.customSelectedDegrees.add(deg.semitone);
        }
        this.renderCustomDegreeToggles();
      });
      container.appendChild(btn);
    });
  }
  selectLevel(levelObj, modeType = 'single') {
    this.audio.stopAll();
    this.exerciseMode = modeType;
    this.activeLevel = levelObj;
    this.totalQuestions = levelObj.questions || 20;
    this.currentKeyRoot = levelObj.keyMode === 'fixed' ? (levelObj.fixedKey || 0) : 0;

    this.resetSessionState();
    this.renderCurriculumSidebar();
    this.renderPianoKeyboard();
    this.renderResolutionNodes();

    this.els.levelCode.textContent = levelObj.code || 'CUST';
    this.els.levelTitle.textContent = levelObj.title;
    this.els.practiceProgressLine.style.width = '0%';

    if (this.exerciseMode === 'melodic') {
      this.els.singleStage.classList.add('hidden');
      this.els.melodicStage.classList.remove('hidden');
      this.els.replayNoteLabel.textContent = 'Replay Melody';
      const seqLen = levelObj.sequenceLength || 4;
      const bpm = levelObj.bpm || 110;
      this.els.melodicMetaBadge.textContent = `${seqLen} Notes · ${bpm} BPM`;
      this.melodySequence = new Array(seqLen).fill(null);
      this.slotSolved = new Array(seqLen).fill(false);
      this.renderMelodicSlots();
    } else {
      this.els.melodicStage.classList.add('hidden');
      this.els.singleStage.classList.remove('hidden');
      this.els.replayNoteLabel.textContent = 'Repeat Note';
    }

    this.updateTelemetryUI();
  }

  resetSessionState() {
    this.audio.stopAll();
    this.sessionActive = false;
    this.awaitingAnswer = false;
    this.isBusyPlaying = false;
    this.questionIndex = 0;
    this.correctFirstTryCount = 0;
    this.currentStreak = 0;
    this.sessionBestStreak = 0;
    this.previousKeyRoot = null;
    this.targetNote = null;

    this.setStepHighlight(null);
    this.els.statusReadout.className = 'status-readout';
    this.els.orbMain.textContent = 'Ready';
    this.els.orbSub.textContent = 'Press Start or Enter';
    this.els.btnStartNext.textContent = '▶ Start';
    this.els.practiceProgressLine.style.width = '0%';
    this.els.btnReplayNote.disabled = true;
    this.els.btnReplayCadence.disabled = true;
    this.els.btnHintResolve.disabled = true;
    this.clearResolutionHighlight();
    this.clearPianoHighlights();
    this.updateTelemetryUI();
  }

  updateTelemetryUI() {
    const keyInfo = window.KEY_NAMES[this.currentKeyRoot || 0];
    const isMinor = this.activeLevel && this.activeLevel.mode === 'minor';
    const keyLabel = isMinor ? keyInfo.minorLabel : keyInfo.majorLabel;

    if (this.activeLevel && this.activeLevel.keyMode === 'roving' && !this.sessionActive) {
      this.els.metricKey.textContent = `Roving (${isMinor ? 'Minor' : 'Major'})`;
    } else {
      this.els.metricKey.textContent = keyLabel;
    }

    const qTotalStr = this.totalQuestions >= 900 ? '∞' : this.totalQuestions;
    this.els.metricProgress.textContent = `${this.questionIndex} / ${qTotalStr}`;

    const acc =
      this.questionIndex > 0
        ? Math.round((this.correctFirstTryCount / this.questionIndex) * 100)
        : 100;
    this.els.metricAccuracy.textContent = `${acc}%`;
    this.els.metricStreak.textContent = `${this.currentStreak}`;

    const pct = this.totalQuestions >= 900 ? 0 : Math.min(100, (this.questionIndex / this.totalQuestions) * 100);
    this.els.practiceProgressLine.style.width = `${pct}%`;
  }

  setStepHighlight(_stepName) {
    // The 4-step flow indicator chips were removed in the redesign.
    // Kept as a harmless no-op hook so playback code stays readable.
  }
  pickRandomMidiForDegree(keyRoot, degreeSemitone, octaves = 1, prevMidi = null) {
    const baseRoot = keyRoot >= 8 ? 48 + keyRoot : 60 + keyRoot;
    const octaveOffsets = octaves === 1 ? [0] : octaves === 2 ? [-12, 0] : [-12, 0, 12];
    const candidates = octaveOffsets.map((off) => baseRoot + off + degreeSemitone);

    if (prevMidi !== null && candidates.length > 1) {
      const filtered = candidates.filter((m) => m !== prevMidi);
      return filtered[Math.floor(Math.random() * filtered.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  generateQuestion() {
    const lvl = this.activeLevel;
    if (lvl.keyMode === 'roving') {
      let nextKey = Math.floor(Math.random() * 12);
      if (this.previousKeyRoot !== null && Math.random() < 0.85) {
        while (nextKey === this.previousKeyRoot) {
          nextKey = Math.floor(Math.random() * 12);
        }
      }
      this.currentKeyRoot = nextKey;
    } else {
      this.currentKeyRoot = lvl.fixedKey || 0;
    }

    const degrees = lvl.degrees && lvl.degrees.length ? lvl.degrees : [0, 2, 4, 5, 7, 9, 11];
    this.renderPianoKeyboard();

    if (this.exerciseMode === 'single') {
      let deg = degrees[Math.floor(Math.random() * degrees.length)];
      let midi = this.pickRandomMidiForDegree(this.currentKeyRoot, deg, lvl.octaves || 1, this.lastMidiNote);
      if (degrees.length > 1 && midi === this.lastMidiNote) {
        const alt = degrees.filter((d) => d !== deg);
        deg = alt[Math.floor(Math.random() * alt.length)];
        midi = this.pickRandomMidiForDegree(this.currentKeyRoot, deg, lvl.octaves || 1, this.lastMidiNote);
      }
      this.lastMidiNote = midi;
      this.targetNote = { midi, degreeSemitone: deg };
      this.currentQuestionFirstTry = true;
      this.currentSingleEntry = this.buildLogEntry(deg, midi, null, 1);
      this.currentMelodicEntries = null;
    } else {
      const seqLen = lvl.sequenceLength || 4;
      const maxLeap = lvl.maxLeapSemitones || 9;
      const seq = [];
      let prevMidi = null;

      for (let i = 0; i < seqLen; i++) {
        let chosen = null;
        for (let attempt = 0; attempt < 25; attempt++) {
          const deg = degrees[Math.floor(Math.random() * degrees.length)];
          const midi = this.pickRandomMidiForDegree(this.currentKeyRoot, deg, lvl.octaves || 1, prevMidi);
          if (prevMidi === null || Math.abs(midi - prevMidi) <= maxLeap) {
            if (prevMidi === null || midi !== prevMidi || degrees.length === 1 || attempt > 15) {
              chosen = { midi, degreeSemitone: deg };
              break;
            }
          }
        }
        if (!chosen) {
          const deg = degrees[Math.floor(Math.random() * degrees.length)];
          chosen = {
            midi: this.pickRandomMidiForDegree(this.currentKeyRoot, deg, 1, prevMidi),
            degreeSemitone: deg,
          };
        }
        prevMidi = chosen.midi;
        seq.push(chosen);
      }

      this.melodySequence = seq;
      this.currentSlotIndex = 0;
      this.slotFirstTry = new Array(seqLen).fill(true);
      this.slotSolved = new Array(seqLen).fill(false);
      this.currentQuestionFirstTry = true;
      this.currentMelodicEntries = seq.map((note, idx) => this.buildLogEntry(note.degreeSemitone, note.midi, idx, seqLen));
      this.currentSingleEntry = null;
      this.renderMelodicSlots();
    }
  }
  async startOrNextQuestion() {
    if (this.isBusyPlaying) return;
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      this.questionIndex = 0;
      this.correctFirstTryCount = 0;
      this.currentStreak = 0;
    }

    if (this.questionIndex >= this.totalQuestions && this.totalQuestions < 900) {
      this.showLevelCompleteModal();
      return;
    }

    this.clearResolutionHighlight();
    this.clearPianoHighlights();
    this.generateQuestion();
    this.updateTelemetryUI();

    const shouldPlayCadence =
      this.els.chkCadenceAlways.checked ||
      this.previousKeyRoot === null ||
      this.previousKeyRoot !== this.currentKeyRoot ||
      this.activeLevel.keyMode === 'roving';

    this.previousKeyRoot = this.currentKeyRoot;
    await this.playCurrentPrompt(shouldPlayCadence);
  }

  async playCurrentPrompt(includeCadence = true) {
    this.audio.stopAll();
    this.isBusyPlaying = true;
    this.awaitingAnswer = false;
    this.els.btnReplayNote.disabled = true;
    this.els.btnReplayCadence.disabled = true;
    this.els.btnHintResolve.disabled = true;
    this.els.btnStartNext.textContent = 'Playing...';

    if (includeCadence) {
      this.setStepHighlight('cadence');
      this.els.statusReadout.className = 'status-readout listening';
      this.els.orbMain.textContent = 'I–IV–V–I';
      this.els.orbSub.textContent = 'Establishing Tonal Center...';
      await this.audio.playCadence(this.currentKeyRoot, this.activeLevel.mode, this.cadenceType);
    }

    this.setStepHighlight('question');
    if (this.exerciseMode === 'single') {
      this.els.orbMain.textContent = '?';
      this.els.orbSub.textContent = 'Listen to Target Note...';
      this.audio.playMidiNote(this.targetNote.midi, 0.9, 0.85, 0);
      await this.audio._wait(this.noteGapMs);
    } else {
      this.els.melodicStatus.textContent = 'Listening to melodic phrase...';
      const bpm = this.activeLevel.bpm || 110;
      await this.audio.playMelodySequence(this.melodySequence, bpm, (idx) => {
        const slots = this.els.melodicSlotsRow.querySelectorAll('.melodic-slot');
        slots.forEach((s) => s.classList.remove('playing-pulse'));
        if (slots[idx]) slots[idx].classList.add('playing-pulse');
      });
      const slots = this.els.melodicSlotsRow.querySelectorAll('.melodic-slot');
      slots.forEach((s) => s.classList.remove('playing-pulse'));
    }

    this.isBusyPlaying = false;
    this.awaitingAnswer = true;
    this.setStepHighlight('answer');
    this.els.orbSub.textContent = 'Select Scale Degree Function';
    if (this.exerciseMode === 'melodic') {
      this.els.melodicStatus.textContent = `Identify Note #${this.currentSlotIndex + 1} of ${this.melodySequence.length}:`;
      this.renderMelodicSlots();
    }

    this.els.btnReplayNote.disabled = false;
    this.els.btnReplayCadence.disabled = false;
    this.els.btnHintResolve.disabled = false;
    this.els.btnStartNext.textContent = 'Skip / Next';

    if (this.handsFreeEnabled) {
      await this.runHandsFreeAutoCycle();
    }
  }

  async runHandsFreeAutoCycle() {
    if (!this.handsFreeEnabled || !this.sessionActive) return;
    this.els.orbSub.textContent = `Hands-Free: Thinking pause (${this.handsFreeDelaySec}s)...`;
    await this.audio._wait(this.handsFreeDelaySec * 1000);
    if (!this.handsFreeEnabled || !this.sessionActive || !this.awaitingAnswer) return;

    if (this.exerciseMode === 'single') {
      const meta = this.getDegreeMeta(this.targetNote.degreeSemitone);
      const labels = this.formatKeyLabels(meta);
      this.els.statusReadout.className = 'status-readout correct';
      this.els.orbMain.textContent = `${meta.degree} (${meta.solfege})`;
      this.els.orbSub.textContent = `Hands-Free Answer: ${labels.primary}`;
      this.setStepHighlight('resolve');
      await this.playVisualizedResolution(this.targetNote.midi, this.targetNote.degreeSemitone);
    } else {
      this.slotSolved = this.melodySequence.map(() => true);
      this.renderMelodicSlots();
      await this.audio.playMelodySequence(this.melodySequence, this.activeLevel.bpm || 110);
    }

    this.questionIndex++;
    this.correctFirstTryCount++;
    this.updateTelemetryUI();
    await this.audio._wait(this.autoAdvanceMs);
    if (this.handsFreeEnabled && this.sessionActive) {
      this.startOrNextQuestion();
    }
  }
  async handleUserDegreeInput(guessedSemitone) {
    if (this.handsFreeEnabled || !this.sessionActive || !this.awaitingAnswer || this.isBusyPlaying) {
      const previewMidi = (this.currentKeyRoot >= 8 ? 48 : 60) + this.currentKeyRoot + guessedSemitone;
      this.audio.playMidiNote(previewMidi, 0.65, 0.82, 0);
      return;
    }

    if (this.exerciseMode === 'single') {
      await this.handleSingleNoteGuess(guessedSemitone);
    } else {
      await this.handleMelodicDictationGuess(guessedSemitone);
    }
  }

  async handleSingleNoteGuess(guessedSemitone) {
    const targetSemi = this.targetNote.degreeSemitone;
    const guessed = ((guessedSemitone % 12) + 12) % 12;
    this.recordLogAttempt(this.currentSingleEntry, guessedSemitone, guessed === targetSemi);
    const keyBtn = document.querySelector(`.piano-key[data-semitone="${guessedSemitone}"]`);

    if (!this.stats.degreeStats[targetSemi]) {
      this.stats.degreeStats[targetSemi] = { attempts: 0, correct: 0 };
    }

    if (guessed === targetSemi) {
      this.awaitingAnswer = false;
      this.isBusyPlaying = true;
      if (keyBtn) keyBtn.classList.add('correct-hit');

      this.stats.degreeStats[targetSemi].attempts++;
      this.stats.totalQuestions++;

      if (this.currentQuestionFirstTry) {
        this.correctFirstTryCount++;
        this.stats.totalFirstTryCorrect++;
        this.stats.degreeStats[targetSemi].correct++;
        this.currentStreak++;
        if (this.currentStreak > this.sessionBestStreak) this.sessionBestStreak = this.currentStreak;
        if (this.currentStreak > this.stats.bestStreak) this.stats.bestStreak = this.currentStreak;
      }

      this.questionIndex++;
      this.saveStats();
      this.finalizeLogEntry(this.currentSingleEntry, this.currentQuestionFirstTry);
      this.currentSingleEntry = null;
      this.updateTelemetryUI();

      const meta = this.getDegreeMeta(targetSemi);
      const keyInfo = window.KEY_NAMES[this.currentKeyRoot];
      this.els.statusReadout.className = 'status-readout correct';
      this.els.orbMain.textContent = `${meta.degree} · ${meta.solfege}`;
      this.els.orbSub.textContent = `Correct! (${keyInfo.notes[targetSemi]} in ${this.els.metricKey.textContent})`;

      if (this.els.chkResolveOnCorrect.checked) {
        this.setStepHighlight('resolve');
        await this.playVisualizedResolution(this.targetNote.midi, targetSemi);
      } else {
        this.audio.playMidiNote(this.targetNote.midi, 0.55, 0.85, 0);
        await this.audio._wait(480);
      }

      this.isBusyPlaying = false;
      if (this.els.chkAutoAdvance.checked) {
        await this.audio._wait(this.autoAdvanceMs);
        this.startOrNextQuestion();
      } else {
        this.els.btnStartNext.textContent = '▶ Next Question';
      }
    } else {
      this.currentQuestionFirstTry = false;
      this.currentStreak = 0;
      this.updateTelemetryUI();

      if (keyBtn) {
        keyBtn.classList.add('wrong-hit');
        setTimeout(() => keyBtn.classList.remove('wrong-hit'), 450);
      }
      this.els.statusReadout.className = 'status-readout wrong';
      const wrongMeta = this.getDegreeMeta(guessedSemitone);
      this.els.orbSub.textContent = `Not ${wrongMeta.degree} (${wrongMeta.solfege}) — Try again or press Space`;

      const baseTonic = this.targetNote.midi - targetSemi;
      this.audio.playMidiNote(baseTonic + guessedSemitone, 0.45, 0.72, 0);
    }
  }
  async handleMelodicDictationGuess(guessedSemitone) {
    const idx = this.currentSlotIndex;
    const targetObj = this.melodySequence[idx];
    if (!targetObj) return;

    const targetSemi = targetObj.degreeSemitone;
    const guessed = ((guessedSemitone % 12) + 12) % 12;
    this.recordLogAttempt(this.currentMelodicEntries ? this.currentMelodicEntries[idx] : null, guessedSemitone, guessed === targetSemi);
    const keyBtn = document.querySelector(`.piano-key[data-semitone="${guessedSemitone}"]`);
    const slotEls = this.els.melodicSlotsRow.querySelectorAll('.melodic-slot');
    const activeSlotEl = slotEls[idx];

    if (!this.stats.degreeStats[targetSemi]) {
      this.stats.degreeStats[targetSemi] = { attempts: 0, correct: 0 };
    }

    if (guessed === targetSemi) {
      if (keyBtn) {
        keyBtn.classList.add('correct-hit');
        setTimeout(() => keyBtn.classList.remove('correct-hit'), 320);
      }

      this.stats.degreeStats[targetSemi].attempts++;
      if (this.slotFirstTry[idx]) {
        this.stats.degreeStats[targetSemi].correct++;
      }

      this.slotSolved[idx] = true;
      this.finalizeLogEntry(this.currentMelodicEntries ? this.currentMelodicEntries[idx] : null, this.slotFirstTry[idx]);
      this.audio.playMidiNote(targetObj.midi, 0.42, 0.82, 0);

      if (idx + 1 < this.melodySequence.length) {
        this.currentSlotIndex++;
        this.els.melodicStatus.textContent = `Great! Now identify Note #${this.currentSlotIndex + 1} of ${this.melodySequence.length}:`;
        this.renderMelodicSlots();
      } else {
        this.awaitingAnswer = false;
        this.isBusyPlaying = true;
        this.renderMelodicSlots();

        this.stats.totalQuestions++;
        if (this.currentQuestionFirstTry) {
          this.correctFirstTryCount++;
          this.stats.totalFirstTryCorrect++;
          this.currentStreak++;
          if (this.currentStreak > this.sessionBestStreak) this.sessionBestStreak = this.currentStreak;
          if (this.currentStreak > this.stats.bestStreak) this.stats.bestStreak = this.currentStreak;
        }

        this.questionIndex++;
        this.saveStats();
        this.updateTelemetryUI();

        this.setStepHighlight('resolve');
        this.els.melodicStatus.textContent = 'Phrase Complete! Replaying full melodic dictation...';
        await this.audio._wait(380);
        await this.audio.playMelodySequence(this.melodySequence, this.activeLevel.bpm || 110, (playIdx) => {
          const slots = this.els.melodicSlotsRow.querySelectorAll('.melodic-slot');
          slots.forEach((s) => s.classList.remove('playing-pulse'));
          if (slots[playIdx]) slots[playIdx].classList.add('playing-pulse');
        });

        if (this.els.chkResolveOnCorrect.checked) {
          const lastNote = this.melodySequence[this.melodySequence.length - 1];
          await this.audio.playResolution(lastNote.midi, lastNote.degreeSemitone, this.activeLevel.mode);
        }

        this.isBusyPlaying = false;
        if (this.els.chkAutoAdvance.checked) {
          await this.audio._wait(this.autoAdvanceMs);
          this.startOrNextQuestion();
        }
      }
    } else {
      this.slotFirstTry[idx] = false;
      this.currentQuestionFirstTry = false;
      this.currentStreak = 0;
      this.updateTelemetryUI();

      if (keyBtn) {
        keyBtn.classList.add('wrong-hit');
        setTimeout(() => keyBtn.classList.remove('wrong-hit'), 400);
      }
      if (activeSlotEl) {
        activeSlotEl.classList.add('wrong-flash');
        setTimeout(() => activeSlotEl.classList.remove('wrong-flash'), 400);
      }

      const wrongMeta = this.getDegreeMeta(guessedSemitone);
      this.els.melodicStatus.textContent = `Note #${idx + 1} is not ${wrongMeta.degree} (${wrongMeta.solfege}) — Try again or press Space`;
      const baseTonic = targetObj.midi - targetSemi;
      this.audio.playMidiNote(baseTonic + guessedSemitone, 0.4, 0.72, 0);
    }
  }

  async playVisualizedResolution(targetMidi, semitoneOffset) {
    this.clearResolutionHighlight();
    await this.audio.playResolution(
      targetMidi,
      semitoneOffset,
      this.activeLevel.mode,
      (stepSemiMod12, isUpperTonic) => {
        this.clearResolutionHighlight();
        const targetNodeSemi = isUpperTonic ? 12 : stepSemiMod12;
        const nodeEl = this.els.resolutionNodes.querySelector(`.res-node[data-res-semi="${targetNodeSemi}"]`);
        if (nodeEl) nodeEl.classList.add('active-step');

        const pKey = document.querySelector(`.piano-key[data-semitone="${stepSemiMod12}"]`);
        if (pKey) pKey.classList.add('correct-hit');
      }
    );
  }

  clearResolutionHighlight() {
    this.els.resolutionNodes.querySelectorAll('.res-node').forEach((n) => n.classList.remove('active-step'));
    this.clearPianoHighlights();
  }

  clearPianoHighlights() {
    document.querySelectorAll('.piano-key').forEach((k) => {
      k.classList.remove('correct-hit', 'wrong-hit');
    });
  }
  showLevelCompleteModal() {
    this.sessionActive = false;
    this.awaitingAnswer = false;

    // Hands-free is practice mode: never record stats or session history.
    if (this.handsFreeEnabled) {
      this.els.modalStars.textContent = '—';
      this.els.modalTitle.textContent = 'Practice Session Complete';
      this.els.modalSubtitle.textContent = `${this.activeLevel.code} · ${this.activeLevel.title} — not recorded`;
      this.els.modalAccuracy.textContent = '—';
      this.els.modalStreak.textContent = '—';
      this.els.modal.classList.remove('hidden');
      return;
    }

    const acc =
      this.totalQuestions > 0
        ? Math.round((this.correctFirstTryCount / this.totalQuestions) * 100)
        : 100;

    let stars = 0;
    if (acc >= 94) stars = 3;
    else if (acc >= 82) stars = 2;
    else if (acc >= 68) stars = 1;

    const lvlId = this.activeLevel.id;
    const prevRec = this.stats.levelRecords[lvlId] || { stars: 0, bestAccuracy: 0 };
    this.stats.levelRecords[lvlId] = {
      stars: Math.max(prevRec.stars || 0, stars),
      bestAccuracy: Math.max(prevRec.bestAccuracy || 0, acc),
    };

    const starsStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.stats.history.unshift({
      date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      mode: this.exerciseMode === 'melodic' ? 'Melodic Dictation' : 'Single-Note',
      level: `${this.activeLevel.code} ${this.activeLevel.title}`,
      questions: this.totalQuestions,
      accuracy: `${acc}%`,
      stars: starsStr,
    });
    if (this.stats.history.length > 40) this.stats.history.pop();
    this.saveStats();
    this.renderCurriculumSidebar();

    this.els.modalStars.textContent = starsStr;
    this.els.modalTitle.textContent = stars >= 2 ? 'Level Mastered!' : 'Session Complete!';
    this.els.modalSubtitle.textContent = `${this.activeLevel.code} — ${this.activeLevel.title}`;
    this.els.modalAccuracy.textContent = `${acc}%`;
    this.els.modalStreak.textContent = `${this.sessionBestStreak}`;
    this.els.modal.classList.remove('hidden');
  }

  findNextCurriculumLevel() {
    const curriculum =
      this.exerciseMode === 'melodic'
        ? window.MELODIC_DICTATION_CURRICULUM
        : window.SINGLE_NOTE_CURRICULUM;
    const flat = [];
    curriculum.forEach((ch) => ch.levels.forEach((l) => flat.push(l)));
    const idx = flat.findIndex((l) => l.id === this.activeLevel.id);
    if (idx >= 0 && idx + 1 < flat.length) {
      return flat[idx + 1];
    }
    return flat[0];
  }

  launchCustomSession() {
    const exType = document.getElementById('cust-exercise-type').value;
    const mode = document.getElementById('cust-mode').value;
    const keyMode = document.getElementById('cust-key-mode').value;
    const fixedKey = parseInt(document.getElementById('cust-fixed-key').value, 10) || 0;
    const octaves = parseInt(document.getElementById('cust-octaves').value, 10) || 2;
    const questions = parseInt(document.getElementById('cust-questions').value, 10) || 25;
    const seqLen = parseInt(document.getElementById('cust-seq-len').value, 10) || 4;
    const bpm = parseInt(document.getElementById('cust-bpm').value, 10) || 110;
    const maxLeap = parseInt(document.getElementById('cust-max-leap').value, 10) || 7;
    this.cadenceType = document.getElementById('cust-cadence-type').value || 'full';

    const degrees = Array.from(this.customSelectedDegrees).sort((a, b) => a - b);

    const customLevel = {
      id: 'custom-studio-session',
      code: 'CUST',
      title: exType === 'melodic' ? `Custom ${seqLen}-Note Dictation` : 'Custom Functional Session',
      description: `${degrees.length} Active Degrees · ${keyMode === 'roving' ? 'Roving Keys' : window.KEY_NAMES[fixedKey].name} ${mode === 'minor' ? 'Minor' : 'Major'} · ${octaves} Oct`,
      mode,
      keyMode,
      fixedKey,
      octaves,
      degrees,
      questions,
      sequenceLength: seqLen,
      bpm,
      maxLeapSemitones: maxLeap,
    };

    this.openPracticeRoom(customLevel, exType);
    this.startOrNextQuestion();
  }

  loadSavedSessions() {
    try {
      const raw = localStorage.getItem('fet_saved_sessions_v1');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  saveSavedSessions(list) {
    try {
      localStorage.setItem('fet_saved_sessions_v1', JSON.stringify(list));
    } catch (_) {}
  }

  captureCustomConfig() {
    return {
      exerciseType: document.getElementById('cust-exercise-type').value,
      mode: document.getElementById('cust-mode').value,
      keyMode: document.getElementById('cust-key-mode').value,
      fixedKey: parseInt(document.getElementById('cust-fixed-key').value, 10) || 0,
      octaves: parseInt(document.getElementById('cust-octaves').value, 10) || 2,
      questions: parseInt(document.getElementById('cust-questions').value, 10) || 25,
      sequenceLength: parseInt(document.getElementById('cust-seq-len').value, 10) || 4,
      bpm: parseInt(document.getElementById('cust-bpm').value, 10) || 110,
      maxLeapSemitones: parseInt(document.getElementById('cust-max-leap').value, 10) || 7,
      cadenceType: document.getElementById('cust-cadence-type').value || 'full',
      handsFreeDelaySec: this.handsFreeDelaySec,
      cadenceSpeed: this.audio.cadenceSpeed,
      resolutionSpeed: this.audio.resolutionSpeed,
      noteGapMs: this.noteGapMs,
      autoAdvanceMs: this.autoAdvanceMs,
      degrees: Array.from(this.customSelectedDegrees).sort((a, b) => a - b),
    };
  }

  applyCustomConfig(config) {
    if (!config) return;
    document.getElementById('cust-exercise-type').value = config.exerciseType || 'single';
    document.getElementById('cust-mode').value = config.mode || 'major';
    document.getElementById('cust-key-mode').value = config.keyMode || 'fixed';
    document.getElementById('cust-fixed-key').value = String(config.fixedKey ?? 0);
    document.getElementById('cust-octaves').value = String(config.octaves ?? 2);
    document.getElementById('cust-questions').value = String(config.questions ?? 25);
    document.getElementById('cust-seq-len').value = String(config.sequenceLength ?? 4);
    document.getElementById('cust-bpm').value = String(config.bpm ?? 110);
    document.getElementById('cust-max-leap').value = String(config.maxLeapSemitones ?? 7);
    document.getElementById('cust-cadence-type').value = config.cadenceType || 'full';

    document.getElementById('cust-seq-len-val').textContent = `${config.sequenceLength ?? 4} Notes`;
    document.getElementById('cust-bpm-val').textContent = `${config.bpm ?? 110} BPM`;

    this.applyTimingSettings({
      cadenceSpeed: config.cadenceSpeed,
      resolutionSpeed: config.resolutionSpeed,
      noteGapMs: config.noteGapMs,
      handsFreeDelaySec: config.handsFreeDelaySec,
      autoAdvanceMs: config.autoAdvanceMs,
    });
    this.saveTimingSettings();
    this.applyTimingSettingsToUI();

    this.customSelectedDegrees = new Set(
      config.degrees && config.degrees.length ? config.degrees : [0, 2, 4, 5, 7, 9, 11]
    );
    this.renderCustomDegreeToggles();
  }

  summarizeSavedConfig(config) {
    const parts = [];
    parts.push(config.exerciseType === 'melodic' ? 'Melodic' : 'Single-Note');
    parts.push(config.mode === 'minor' ? 'Minor' : 'Major');
    parts.push(config.keyMode === 'roving' ? 'Roving keys' : ((window.KEY_NAMES[config.fixedKey] || {}).name || 'C'));
    parts.push(`${(config.degrees || []).length} deg`);
    if (config.exerciseType === 'melodic') {
      parts.push(`${config.sequenceLength} notes @ ${config.bpm} BPM`);
    }
    return parts.join(' · ');
  }

  renderSavedSessions() {
    const list = document.getElementById('saved-sessions-list');
    if (!list) return;
    const sessions = this.loadSavedSessions();
    list.innerHTML = '';
    if (!sessions.length) {
      list.innerHTML = '<div class="ss-empty">No saved sessions yet. Configure a setup and click Save Current Setup.</div>';
      return;
    }
    sessions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'saved-session-item';

      const info = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.className = 'ss-name';
      nameEl.textContent = s.name;
      const summaryEl = document.createElement('div');
      summaryEl.className = 'ss-summary';
      summaryEl.textContent = this.summarizeSavedConfig(s.config);
      info.appendChild(nameEl);
      info.appendChild(summaryEl);

      const actions = document.createElement('div');
      actions.className = 'ss-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'ss-btn';
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => this.applyCustomConfig(s.config));

      const delBtn = document.createElement('button');
      delBtn.className = 'ss-btn ss-delete';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => this.deleteSavedSession(s.id));

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  saveCurrentSession() {
    const nameInput = document.getElementById('saved-session-name');
    const name = (nameInput.value || '').trim();
    if (!name) {
      nameInput.focus();
      nameInput.placeholder = 'Type a name first...';
      return;
    }
    const sessions = this.loadSavedSessions();
    sessions.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      createdAt: new Date().toISOString(),
      config: this.captureCustomConfig(),
    });
    this.saveSavedSessions(sessions);
    nameInput.value = '';
    this.renderSavedSessions();
  }

  deleteSavedSession(id) {
    const sessions = this.loadSavedSessions().filter((s) => s.id !== id);
    this.saveSavedSessions(sessions);
    this.renderSavedSessions();
  }

  renderStatsView() {
    document.getElementById('stat-total-questions').textContent = this.stats.totalQuestions;
    const overallAcc =
      this.stats.totalQuestions > 0
        ? Math.round((this.stats.totalFirstTryCorrect / this.stats.totalQuestions) * 100)
        : 0;
    document.getElementById('stat-overall-accuracy').textContent = `${overallAcc}%`;
    document.getElementById('stat-best-streak').textContent = `${this.stats.bestStreak}`;

    const totalStars = Object.values(this.stats.levelRecords).reduce((sum, r) => sum + (r.stars || 0), 0);
    document.getElementById('stat-total-stars').textContent = `${totalStars} ★`;

    const barsGrid = document.getElementById('degree-bars-grid');
    barsGrid.innerHTML = '';
    window.SCALE_DEGREES.forEach((deg) => {
      const st = this.stats.degreeStats[deg.semitone] || { attempts: 0, correct: 0 };
      const pct = st.attempts > 0 ? Math.round((st.correct / st.attempts) * 100) : 0;
      const col = document.createElement('div');
      col.className = 'deg-bar-col';
      col.title = `${deg.degree} (${deg.solfege}): ${st.correct} / ${st.attempts} (${pct}%)`;
      col.innerHTML = `
        <span class="deg-bar-pct">${st.attempts > 0 ? pct + '%' : '—'}</span>
        <div class="deg-bar-track">
          <div class="deg-bar-fill" style="height:${pct}%;background:${deg.color};"></div>
        </div>
        <span class="deg-bar-label">${deg.degree}</span>
      `;
      barsGrid.appendChild(col);
    });

    const tbody = document.getElementById('session-history-tbody');
    tbody.innerHTML = '';
    if (!this.stats.history.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No completed sessions yet — start a level to track your progress!</td></tr>`;
    } else {
      this.stats.history.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.date}</td>
          <td>${row.mode}</td>
          <td><strong>${row.level}</strong></td>
          <td>${row.questions}</td>
          <td>${row.accuracy}</td>
          <td style="color:var(--accent);">${row.stars}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
  switchHubTab(viewMode) {
    this.audio.stopAll();
    this.currentView = viewMode;

    document.querySelectorAll('.hub-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === viewMode);
    });

    this.els.hubCurriculumSection.classList.add('hidden');
    this.els.viewCustom.classList.add('hidden');
    this.els.viewStats.classList.add('hidden');

    if (viewMode === 'single' || viewMode === 'melodic') {
      this.els.hubCurriculumSection.classList.remove('hidden');
      if (this.exerciseMode !== viewMode) {
        const defaultLvl =
          viewMode === 'melodic'
            ? window.MELODIC_DICTATION_CURRICULUM[0].levels[0]
            : window.SINGLE_NOTE_CURRICULUM[0].levels[0];
        this.selectLevel(defaultLvl, viewMode);
      } else {
        this.renderCurriculumSidebar();
      }
    } else if (viewMode === 'custom') {
      this.els.viewCustom.classList.remove('hidden');
    } else if (viewMode === 'stats') {
      this.els.viewStats.classList.remove('hidden');
      this.renderStatsView();
    }
  }

  openPracticeRoom(levelObj, modeType = 'single') {
    this.selectLevel(levelObj, modeType);
    this.els.screenHub.classList.add('hidden');
    this.els.screenPractice.classList.remove('hidden');
    this.inPracticeRoom = true;
  }

  backToHub() {
    this.audio.stopAll();
    this.handsFreeEnabled = false;
    this.els.handsfreeBtn.classList.remove('active');
    this.els.handsfreeStatus.textContent = 'Hands-Free';
    this.els.settingsPopover.classList.add('hidden');
    this.els.screenPractice.classList.add('hidden');
    this.els.screenHub.classList.remove('hidden');
    this.inPracticeRoom = false;
    this.resetSessionState();
    this.renderCurriculumSidebar();
  }

  bindEvents() {
    document.querySelectorAll('.hub-tab').forEach((btn) => {
      btn.addEventListener('click', () => this.switchHubTab(btn.dataset.mode));
    });

    this.els.btnBackHub.addEventListener('click', () => this.backToHub());
    this.els.settingsToggleBtn.addEventListener('click', () => {
      this.els.settingsPopover.classList.toggle('hidden');
    });
    this.els.btnResumeActiveLevel.addEventListener('click', () => {
      this.openPracticeRoom(this.activeLevel, this.exerciseMode);
    });

    document.getElementById('instrument-select').addEventListener('change', (e) => {
      this.audio.setInstrument(e.target.value);
    });

    document.getElementById('label-mode-select').addEventListener('change', (e) => {
      this.labelMode = e.target.value;
      this.renderPianoKeyboard();
      if (this.exerciseMode === 'melodic') this.renderMelodicSlots();
    });

    document.getElementById('volume-slider').addEventListener('input', (e) => {
      this.audio.setVolume(parseInt(e.target.value, 10) / 100);
    });

    document.getElementById('cadence-speed-slider').addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      document.getElementById('cadence-speed-val').textContent = `${pct}%`;
      this.audio.setCadenceSpeed(pct / 100);
      this.saveTimingSettings();
    });

    document.getElementById('resolution-speed-slider').addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      document.getElementById('resolution-speed-val').textContent = `${pct}%`;
      this.audio.setResolutionSpeed(pct / 100);
      this.saveTimingSettings();
    });

    document.getElementById('note-gap-slider').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('note-gap-val').textContent = `${v}s`;
      this.noteGapMs = v * 1000;
      this.saveTimingSettings();
    });

    document.getElementById('handsfree-pause-slider').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('handsfree-pause-val').textContent = `${v}s`;
      this.handsFreeDelaySec = v;
      this.saveTimingSettings();
    });

    document.getElementById('auto-advance-slider').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('auto-advance-val').textContent = `${v}s`;
      this.autoAdvanceMs = v * 1000;
      this.saveTimingSettings();
    });

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
    });

    this.els.handsfreeBtn.addEventListener('click', () => {
      this.handsFreeEnabled = !this.handsFreeEnabled;
      this.els.handsfreeBtn.classList.toggle('active', this.handsFreeEnabled);
      this.els.handsfreeStatus.textContent = this.handsFreeEnabled ? 'Hands-Free On' : 'Hands-Free';
      if (this.handsFreeEnabled && this.sessionActive && this.awaitingAnswer) {
        this.runHandsFreeAutoCycle();
      }
    });

    this.els.btnStartNext.addEventListener('click', () => this.startOrNextQuestion());

    this.els.btnReplayNote.addEventListener('click', async () => {
      if (!this.sessionActive || this.isBusyPlaying) return;
      if (this.exerciseMode === 'single' && this.targetNote) {
        this.audio.playMidiNote(this.targetNote.midi, 0.85, 0.85, 0);
      } else if (this.exerciseMode === 'melodic' && this.melodySequence.length) {
        await this.audio.playMelodySequence(this.melodySequence, this.activeLevel.bpm || 110, (idx) => {
          const slots = this.els.melodicSlotsRow.querySelectorAll('.melodic-slot');
          slots.forEach((s) => s.classList.remove('playing-pulse'));
          if (slots[idx]) slots[idx].classList.add('playing-pulse');
        });
        this.els.melodicSlotsRow.querySelectorAll('.melodic-slot').forEach((s) => s.classList.remove('playing-pulse'));
      }
    });
    this.els.btnReplayCadence.addEventListener('click', () => {
      if (!this.sessionActive || this.isBusyPlaying) return;
      this.playCurrentPrompt(true);
    });

    this.els.btnHintResolve.addEventListener('click', async () => {
      if (!this.sessionActive || this.isBusyPlaying) return;
      this.currentQuestionFirstTry = false;
      if (this.exerciseMode === 'single' && this.targetNote) {
        await this.playVisualizedResolution(this.targetNote.midi, this.targetNote.degreeSemitone);
      } else if (this.exerciseMode === 'melodic') {
        const cur = this.melodySequence[this.currentSlotIndex];
        if (cur) {
          this.slotFirstTry[this.currentSlotIndex] = false;
          await this.audio.playResolution(cur.midi, cur.degreeSemitone, this.activeLevel.mode);
        }
      }
    });

    this.els.btnRestartSession.addEventListener('click', () => this.resetSessionState());

    this.els.modalBtnRetry.addEventListener('click', () => {
      this.els.modal.classList.add('hidden');
      this.resetSessionState();
      this.startOrNextQuestion();
    });

    this.els.modalBtnNext.addEventListener('click', () => {
      this.els.modal.classList.add('hidden');
      const nextLvl = this.findNextCurriculumLevel();
      this.selectLevel(nextLvl, this.exerciseMode);
      this.startOrNextQuestion();
    });

    document.getElementById('cust-seq-len').addEventListener('input', (e) => {
      document.getElementById('cust-seq-len-val').textContent = `${e.target.value} Notes`;
    });
    document.getElementById('cust-bpm').addEventListener('input', (e) => {
      document.getElementById('cust-bpm-val').textContent = `${e.target.value} BPM`;
    });
    document.getElementById('btn-launch-custom').addEventListener('click', () => this.launchCustomSession());
    document.getElementById('btn-save-session').addEventListener('click', () => this.saveCurrentSession());

    document.querySelectorAll('.chip-btn[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.preset;
        const map = {
          lower: [0, 2, 4, 5],
          upper: [0, 7, 9, 11],
          triad: [0, 4, 7],
          penta: [0, 2, 4, 7, 9],
          major: [0, 2, 4, 5, 7, 9, 11],
          minor: [0, 2, 3, 5, 7, 8, 10, 11],
          chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        };
        if (map[p]) {
          this.customSelectedDegrees = new Set(map[p]);
          this.renderCustomDegreeToggles();
        }
      });
    });

    document.getElementById('btn-reset-stats').addEventListener('click', () => {
      const btn = document.getElementById('btn-reset-stats');
      if (btn.dataset.armed === 'true') {
        clearTimeout(this._clearArmTimeout);
        btn.dataset.armed = 'false';
        btn.textContent = 'Clear All Statistics';
        btn.classList.remove('danger-armed');
        document.getElementById('stat-export-status').textContent = '';
        localStorage.removeItem(this.storageKey);
        this.stats = this.loadStats();
        this.renderStatsView();
        this.renderCurriculumSidebar();
      } else {
        btn.dataset.armed = 'true';
        btn.textContent = 'Click again to confirm';
        btn.classList.add('danger-armed');
        clearTimeout(this._clearArmTimeout);
        this._clearArmTimeout = setTimeout(() => {
          btn.dataset.armed = 'false';
          btn.textContent = 'Clear All Statistics';
          btn.classList.remove('danger-armed');
        }, 4000);
      }
    });

    document.getElementById('btn-export-log').addEventListener('click', () => {
      this.exportDetailLog();
    });

    window.addEventListener('keydown', (e) => {
      if (!this.inPracticeRoom) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const key = e.key.toLowerCase();
      if (key === 'enter') {
        e.preventDefault();
        this.startOrNextQuestion();
        return;
      }
      if (key === ' ') {
        e.preventDefault();
        this.els.btnReplayNote.click();
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        this.els.btnReplayCadence.click();
        return;
      }
      if (key === 'h') {
        e.preventDefault();
        this.els.btnHintResolve.click();
        return;
      }

      const shortcutMap = {
        '1': 0, 'q': 1, '2': 2, 'w': 3, '3': 4, '4': 5,
        'e': 6, '5': 7, 'r': 8, '6': 9, 't': 10, '7': 11,
        '8': 12,
      };
      if (shortcutMap[key] !== undefined) {
        const semi = shortcutMap[key];
        const activeSet = new Set(this.activeLevel ? this.activeLevel.degrees : []);
        if (activeSet.has(((semi % 12) + 12) % 12)) {
          this.handleUserDegreeInput(semi);
        }
      }
    });

    window.addEventListener('resize', () => {
      if (this.exerciseMode === 'melodic') this.renderMelodicContourLine();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.earTrainerApp = new FunctionalEarTrainerApp();
});
