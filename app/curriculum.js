/**
 * Functional Ear Trainer Studio - Complete Curriculum & Scale Degree Metadata
 */

const SCALE_DEGREES = [
  { semitone: 0, degree: '1', minorDegree: '1', solfege: 'Do', minorSolfege: 'Do', isChromatic: false, row: 'white', whiteIndex: 0, shortcut: '1', color: '#38bdf8' },
  { semitone: 1, degree: '♭2', minorDegree: '♭2', solfege: 'Ra', minorSolfege: 'Ra', isChromatic: true, row: 'black', afterWhiteIndex: 0, shortcut: 'q', color: '#a78bfa' },
  { semitone: 2, degree: '2', minorDegree: '2', solfege: 'Re', minorSolfege: 'Re', isChromatic: false, row: 'white', whiteIndex: 1, shortcut: '2', color: '#60a5fa' },
  { semitone: 3, degree: '♭3', minorDegree: '♭3', solfege: 'Me', minorSolfege: 'Me', isChromatic: true, row: 'black', afterWhiteIndex: 1, shortcut: 'w', color: '#c084fc' },
  { semitone: 4, degree: '3', minorDegree: '♮3', solfege: 'Mi', minorSolfege: 'Mi', isChromatic: false, row: 'white', whiteIndex: 2, shortcut: '3', color: '#34d399' },
  { semitone: 5, degree: '4', minorDegree: '4', solfege: 'Fa', minorSolfege: 'Fa', isChromatic: false, row: 'white', whiteIndex: 3, shortcut: '4', color: '#fbbf24' },
  { semitone: 6, degree: '♯4', minorDegree: '♯4', solfege: 'Fi', minorSolfege: 'Fi', isChromatic: true, row: 'black', afterWhiteIndex: 3, shortcut: 'e', color: '#f472b6' },
  { semitone: 7, degree: '5', minorDegree: '5', solfege: 'Sol', minorSolfege: 'Sol', isChromatic: false, row: 'white', whiteIndex: 4, shortcut: '5', color: '#fb923c' },
  { semitone: 8, degree: '♭6', minorDegree: '♭6', solfege: 'Le', minorSolfege: 'Le', isChromatic: true, row: 'black', afterWhiteIndex: 4, shortcut: 'r', color: '#e879f9' },
  { semitone: 9, degree: '6', minorDegree: '♮6', solfege: 'La', minorSolfege: 'La', isChromatic: false, row: 'white', whiteIndex: 5, shortcut: '6', color: '#f87171' },
  { semitone: 10, degree: '♭7', minorDegree: '♭7', solfege: 'Te', minorSolfege: 'Te', isChromatic: true, row: 'black', afterWhiteIndex: 5, shortcut: 't', color: '#fb7185' },
  { semitone: 11, degree: '7', minorDegree: '7', solfege: 'Ti', minorSolfege: 'Ti', isChromatic: false, row: 'white', whiteIndex: 6, shortcut: '7', color: '#818cf8' },
];

const KEY_NAMES = [
  { semitone: 0, name: 'C', majorLabel: 'C Major', minorLabel: 'C Minor', notes: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] },
  { semitone: 1, name: 'D♭', majorLabel: 'D♭ Major', minorLabel: 'C♯ Minor', notes: ['D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C'] },
  { semitone: 2, name: 'D', majorLabel: 'D Major', minorLabel: 'D Minor', notes: ['D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B', 'C', 'C♯'] },
  { semitone: 3, name: 'E♭', majorLabel: 'E♭ Major', minorLabel: 'E♭ Minor', notes: ['E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C', 'D♭', 'D'] },
  { semitone: 4, name: 'E', majorLabel: 'E Major', minorLabel: 'E Minor', notes: ['E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B', 'C', 'C♯', 'D', 'D♯'] },
  { semitone: 5, name: 'F', majorLabel: 'F Major', minorLabel: 'F Minor', notes: ['F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C', 'D♭', 'D', 'E♭', 'E'] },
  { semitone: 6, name: 'G♭', majorLabel: 'G♭ Major', minorLabel: 'F♯ Minor', notes: ['G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C', 'D♭', 'D', 'E♭', 'E', 'F'] },
  { semitone: 7, name: 'G', majorLabel: 'G Major', minorLabel: 'G Minor', notes: ['G', 'A♭', 'A', 'B♭', 'B', 'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯'] },
  { semitone: 8, name: 'A♭', majorLabel: 'A♭ Major', minorLabel: 'G♯ Minor', notes: ['A♭', 'A', 'B♭', 'B', 'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G'] },
  { semitone: 9, name: 'A', majorLabel: 'A Major', minorLabel: 'A Minor', notes: ['A', 'B♭', 'B', 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯'] },
  { semitone: 10, name: 'B♭', majorLabel: 'B♭ Major', minorLabel: 'B♭ Minor', notes: ['B♭', 'B', 'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A'] },
  { semitone: 11, name: 'B', majorLabel: 'B Major', minorLabel: 'B Minor', notes: ['B', 'C', 'C♯', 'D', 'D♯', 'E', 'E♯', 'F♯', 'G', 'G♯', 'A', 'A♯'] },
];

const SINGLE_NOTE_CURRICULUM = [
  {
    chapterId: 'ch1-c-major',
    chapterTitle: 'Chapter 1: C Major Scale',
    subtitle: 'Internalize the 7 diatonic scale degrees in a fixed key',
    levels: [
      { id: 'sn-1-1', code: '1.1', title: 'Lower Tetrachord (Do–Fa)', description: 'Downward resolving notes: Do (1), Re (2), Mi (3), Fa (4) in C Major, 1 octave.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 5], questions: 20 },
      { id: 'sn-1-2', code: '1.2', title: 'Upper Tetrachord (Sol–Do)', description: 'Upward resolving notes: Sol (5), La (6), Ti (7), Do (1) in C Major, 1 octave.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 7, 9, 11], questions: 20 },
      { id: 'sn-1-3', code: '1.3', title: 'Full C Major Octave', description: 'All 7 diatonic degrees (1–7) within a single octave in C Major.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 5, 7, 9, 11], questions: 25 },
      { id: 'sn-1-4', code: '1.4', title: 'C Major Multi-Octave', description: 'All 7 diatonic degrees across 3 octaves in C Major—listen for chroma, not pitch height.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 3, degrees: [0, 2, 4, 5, 7, 9, 11], questions: 30 },
    ],
  },
  {
    chapterId: 'ch2-roving-major',
    chapterTitle: 'Chapter 2: Roving Major Keys',
    subtitle: 'True relative pitch: the key changes every question',
    levels: [
      { id: 'sn-2-1', code: '2.1', title: 'Roving Lower Half (1–4)', description: 'Do, Re, Mi, Fa across all 12 Major keys (changing every question).', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 5], questions: 20 },
      { id: 'sn-2-2', code: '2.2', title: 'Roving Upper Half (5–1)', description: 'Sol, La, Ti, Do across all 12 Major keys (changing every question).', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 1, degrees: [0, 7, 9, 11], questions: 20 },
      { id: 'sn-2-3', code: '2.3', title: 'Roving Full Octave (1–7)', description: 'All 7 scale degrees in random Major keys within 1 octave.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 5, 7, 9, 11], questions: 25 },
      { id: 'sn-2-4', code: '2.4', title: 'Roving Multi-Octave Master', description: 'All 7 scale degrees across multiple octaves in random Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 3, degrees: [0, 2, 4, 5, 7, 9, 11], questions: 30 },
    ],
  },
  {
    chapterId: 'ch3-minor-keys',
    chapterTitle: 'Chapter 3: Minor Keys',
    subtitle: 'Master the dark, expressive functions of Minor tonality',
    levels: [
      { id: 'sn-3-1', code: '3.1', title: 'Minor Lower Half (1, 2, ♭3, 4)', description: 'Do, Re, Me (♭3), Fa in C Minor.', mode: 'minor', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 2, 3, 5], questions: 20 },
      { id: 'sn-3-2', code: '3.2', title: 'Harmonic Upper Half (5, ♭6, 7, 1)', description: 'Sol, Le (♭6), Ti (7), Do in C Minor.', mode: 'minor', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 7, 8, 11], questions: 20 },
      { id: 'sn-3-3', code: '3.3', title: 'Full Minor Scale (Fixed + Melodic ♭7)', description: '1, 2, ♭3, 4, 5, ♭6, ♭7, 7 in C Minor.', mode: 'minor', keyMode: 'fixed', fixedKey: 0, octaves: 2, degrees: [0, 2, 3, 5, 7, 8, 10, 11], questions: 25 },
      { id: 'sn-3-4', code: '3.4', title: 'Roving Minor Keys (Multi-Octave)', description: 'Full minor scale degrees across all 12 Minor keys.', mode: 'minor', keyMode: 'roving', fixedKey: 0, octaves: 3, degrees: [0, 2, 3, 5, 7, 8, 10, 11], questions: 30 },
    ],
  },
  {
    chapterId: 'ch4-chromatic',
    chapterTitle: 'Chapter 4: Chromatic Scale Degrees',
    subtitle: 'Recognize all 12 chromatic tones within a tonal center',
    levels: [
      { id: 'sn-4-1', code: '4.1', title: 'Lower Chromatics (1 to ♯4)', description: 'Diatonic 1–4 plus ♭2 (Ra), ♭3 (Me), and ♯4 (Fi) in C Major.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 1, 2, 3, 4, 5, 6], questions: 25 },
      { id: 'sn-4-2', code: '4.2', title: 'Upper Chromatics (5 to 1)', description: 'Diatonic 5–7 plus ♭6 (Le) and ♭7 (Te) in C Major.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 7, 8, 9, 10, 11], questions: 25 },
      { id: 'sn-4-3', code: '4.3', title: 'All 12 Chromatic Notes (C Major)', description: 'Every chromatic note in C Major across 2 octaves.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 2, degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], questions: 30 },
      { id: 'sn-4-4', code: '4.4', title: 'Roving 12-Tone Chromatic Master', description: 'All 12 chromatic degrees in random roving Major keys across 3 octaves.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 3, degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], questions: 35 },
    ],
  },
];

const MELODIC_DICTATION_CURRICULUM = [
  {
    chapterId: 'md-ch1-triads',
    chapterTitle: 'Stage 1: Tonic Triad (Do–Mi–Sol)',
    subtitle: '3- and 4-note melodies built on the Major Triad (1, 3, 5)',
    levels: [
      { id: 'md-1-1', code: 'M1.1', title: 'Tonic Triad - 3 Notes (C Major)', description: 'Identify a string of 3 notes using Do (1), Mi (3), and Sol (5) in C Major.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 4, 7], sequenceLength: 3, bpm: 105, maxLeapSemitones: 12, questions: 15 },
      { id: 'md-1-2', code: 'M1.2', title: 'Tonic Triad - 4 Notes (C Major)', description: 'Classic 4-note melodic dictation using Do (1), Mi (3), and Sol (5).', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 4, 7], sequenceLength: 4, bpm: 110, maxLeapSemitones: 12, questions: 15 },
      { id: 'md-1-3', code: 'M1.3', title: 'Tonic Triad - 4 Notes (Roving Keys)', description: '4-note Do–Mi–Sol strings in random roving Major keys across 2 octaves.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 2, degrees: [0, 4, 7], sequenceLength: 4, bpm: 112, maxLeapSemitones: 12, questions: 15 },
    ],
  },
  {
    chapterId: 'md-ch2-pentatonic',
    chapterTitle: 'Stage 2: Major Pentatonic (1, 2, 3, 5, 6)',
    subtitle: 'Expand your melodic memory to the 5 most common song degrees',
    levels: [
      { id: 'md-2-1', code: 'M2.1', title: 'Pentatonic - 3 Notes (C Major)', description: '3-note melodies using Do, Re, Mi, Sol, La (1, 2, 3, 5, 6).', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 7, 9], sequenceLength: 3, bpm: 105, maxLeapSemitones: 9, questions: 15 },
      { id: 'md-2-2', code: 'M2.2', title: 'Pentatonic - 4 Notes (C Major)', description: '4-note pentatonic phrases in C Major.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 7, 9], sequenceLength: 4, bpm: 110, maxLeapSemitones: 9, questions: 15 },
      { id: 'md-2-3', code: 'M2.3', title: 'Pentatonic - 4 Notes (Roving Keys)', description: '4-note pentatonic phrases in random Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 2, degrees: [0, 2, 4, 7, 9], sequenceLength: 4, bpm: 115, maxLeapSemitones: 10, questions: 20 },
    ],
  },
  {
    chapterId: 'md-ch3-tetrachords',
    chapterTitle: 'Stage 3: Lower & Upper Tetrachords',
    subtitle: 'Stepwise and small-leap 4-note melodies in each half of the scale',
    levels: [
      { id: 'md-3-1', code: 'M3.1', title: 'Lower Tetrachord (1–4) - 4 Notes', description: '4-note melodies using Do, Re, Mi, Fa in roving Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 5], sequenceLength: 4, bpm: 108, maxLeapSemitones: 7, questions: 15 },
      { id: 'md-3-2', code: 'M3.2', title: 'Upper Tetrachord (5–1) - 4 Notes', description: '4-note melodies using Sol, La, Ti, Do in roving Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 1, degrees: [0, 7, 9, 11], sequenceLength: 4, bpm: 108, maxLeapSemitones: 7, questions: 15 },
    ],
  },
  {
    chapterId: 'md-ch4-full-major',
    chapterTitle: 'Stage 4: Full Major Scale Dictation',
    subtitle: 'Transcribe 4, 5, and 6-note melodies using all 7 diatonic degrees',
    levels: [
      { id: 'md-4-1', code: 'M4.1', title: 'Full C Major - 4 Notes', description: '4-note melodies using all 7 degrees (1–7) in C Major.', mode: 'major', keyMode: 'fixed', fixedKey: 0, octaves: 1, degrees: [0, 2, 4, 5, 7, 9, 11], sequenceLength: 4, bpm: 105, maxLeapSemitones: 7, questions: 15 },
      { id: 'md-4-2', code: 'M4.2', title: 'Roving Major - 4 Notes', description: '4-note melodies using all 7 degrees in random roving Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 2, degrees: [0, 2, 4, 5, 7, 9, 11], sequenceLength: 4, bpm: 110, maxLeapSemitones: 8, questions: 20 },
      { id: 'md-4-3', code: 'M4.3', title: 'Roving Major - 5 Notes', description: '5-note melodic phrases in random roving Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 2, degrees: [0, 2, 4, 5, 7, 9, 11], sequenceLength: 5, bpm: 112, maxLeapSemitones: 8, questions: 20 },
      { id: 'md-4-4', code: 'M4.4', title: 'Roving Major - 6 Notes Master', description: '6-note extended melodic phrases in random Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 2, degrees: [0, 2, 4, 5, 7, 9, 11], sequenceLength: 6, bpm: 116, maxLeapSemitones: 9, questions: 20 },
    ],
  },
  {
    chapterId: 'md-ch5-minor-chromatic',
    chapterTitle: 'Stage 5: Minor & Chromatic Dictation',
    subtitle: 'Transcribe minor melodies and chromatic neighbor/passing tones',
    levels: [
      { id: 'md-5-1', code: 'M5.1', title: 'Minor Triad (1, ♭3, 5) - 4 Notes', description: '4-note minor triad melodies in roving Minor keys.', mode: 'minor', keyMode: 'roving', fixedKey: 0, octaves: 1, degrees: [0, 3, 7], sequenceLength: 4, bpm: 108, maxLeapSemitones: 12, questions: 15 },
      { id: 'md-5-2', code: 'M5.2', title: 'Minor Pentatonic (1, ♭3, 4, 5, ♭7) - 4 Notes', description: '4-note minor pentatonic phrases in roving Minor keys.', mode: 'minor', keyMode: 'roving', fixedKey: 0, octaves: 2, degrees: [0, 3, 5, 7, 10], sequenceLength: 4, bpm: 110, maxLeapSemitones: 9, questions: 15 },
      { id: 'md-5-3', code: 'M5.3', title: 'Full Minor Scale - 4 Notes', description: '4-note phrases using 1, 2, ♭3, 4, 5, ♭6, 7 in roving Minor keys.', mode: 'minor', keyMode: 'roving', fixedKey: 0, octaves: 2, degrees: [0, 2, 3, 5, 7, 8, 11], sequenceLength: 4, bpm: 108, maxLeapSemitones: 7, questions: 20 },
      { id: 'md-5-4', code: 'M5.4', title: 'Chromatic Melodic Dictation - 4 Notes', description: '4-note phrases including chromatic tones in roving Major keys.', mode: 'major', keyMode: 'roving', fixedKey: 0, octaves: 1, degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], sequenceLength: 4, bpm: 100, maxLeapSemitones: 5, questions: 20 },
    ],
  },
];

window.SCALE_DEGREES = SCALE_DEGREES;
window.KEY_NAMES = KEY_NAMES;
window.SINGLE_NOTE_CURRICULUM = SINGLE_NOTE_CURRICULUM;
window.MELODIC_DICTATION_CURRICULUM = MELODIC_DICTATION_CURRICULUM;

