import { useState, useEffect, useRef, useCallback } from 'react';
import * as Speech from 'expo-speech';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import { useAttendanceStore } from '../store/attendanceStore';
import { ACCEPTED_WORDS } from '../constants';
import { AttendanceStatus } from '../types';

const RESTART_DELAY_MS    = 400;
const POST_SPEAK_DELAY_MS = 1200;  // silence after TTS before mic opens
const ABSENT_TIMEOUT_MS   = 5000;  // auto-absent if no "present" in this window
const POST_MARK_COOLDOWN  = 1500;  // dedup window after marking

export function useVoiceAttendance(_sectionId: string) {
  const [isListening,  setIsListening]  = useState(false);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  const isRunningRef   = useRef(false);
  const isStartingRef  = useRef(false);
  const genRef         = useRef(0);         // incremented on start/pause/resume
  const isTTSRef       = useRef(false);     // true while TTS is speaking — suppresses mic restarts
  const canMarkRef     = useRef(false);     // true only inside the listening window
  const lastMarkedRef  = useRef<string | null>(null);
  const absentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { markStudent, setCurrentIndex, setRunning } = useAttendanceStore();

  // ── Low-level mic start (generation-aware) ────────────────────────────────
  const startMicForGen = useCallback((gen: number) => {
    if (!isRunningRef.current || isStartingRef.current || genRef.current !== gen) return;
    if (isTTSRef.current) return;   // never open mic while TTS is playing
    isStartingRef.current = true;
    Voice.destroy()
      .catch(() => {})
      .finally(() => {
        if (!isRunningRef.current || genRef.current !== gen || isTTSRef.current) {
          isStartingRef.current = false;
          return;
        }
        Voice.start('en-US').catch(() => {
          isStartingRef.current = false;
          setTimeout(() => {
            if (isRunningRef.current && genRef.current === gen && !isTTSRef.current) {
              startMicForGen(gen);
            }
          }, RESTART_DELAY_MS);
        });
      });
  }, []);

  const scheduleRestart = useCallback((gen: number) => {
    setTimeout(() => {
      if (!isRunningRef.current || genRef.current !== gen || isTTSRef.current) return;
      startMicForGen(gen);
    }, RESTART_DELAY_MS);
  }, [startMicForGen]);

  // ── Voice event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    Voice.onSpeechStart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      console.log('[Voice] mic OPEN ✅');
    };

    Voice.onSpeechEnd = () => {
      setIsListening(false);
      console.log('[Voice] mic closed');
      // Only restart if we're in the active listening window (not during TTS)
      if (!isTTSRef.current) scheduleRestart(genRef.current);
    };

    // Only final results trigger marking — partials caused double-marks
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const results = e.value ?? [];
      console.log('[Voice] results:', results);
      if (!canMarkRef.current) return;
      if (results.some((r) => ACCEPTED_WORDS.some((w) => r.toLowerCase().trim().includes(w)))) {
        onWordHeard();
      }
    };

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      console.log('[Voice] partial:', e.value);
      // No marking from partials — log only
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      const code = String(e.error?.code);
      console.log('[Voice] error:', code);
      isStartingRef.current = false;
      if (!isTTSRef.current) scheduleRestart(genRef.current);
    };

    return () => {
      Voice.onSpeechStart          = undefined;
      Voice.onSpeechEnd            = undefined;
      Voice.onSpeechResults        = undefined;
      Voice.onSpeechPartialResults = undefined;
      Voice.onSpeechError          = undefined;
    };
  }, [scheduleRestart]);

  // ── Clear absent timer helper ─────────────────────────────────────────────
  const clearAbsentTimer = useCallback(() => {
    if (absentTimerRef.current) {
      clearTimeout(absentTimerRef.current);
      absentTimerRef.current = null;
    }
  }, []);

  // ── Mark present ──────────────────────────────────────────────────────────
  const onWordHeard = useCallback(() => {
    const { students, currentIndex } = useAttendanceStore.getState();
    const student = students[currentIndex];
    if (!student || student.status !== null) return;
    if (lastMarkedRef.current === student.id) return;

    clearAbsentTimer();
    canMarkRef.current    = false;
    lastMarkedRef.current = student.id;
    markStudent(student.id, 'present', 'voice');
    setTimeout(() => { lastMarkedRef.current = null; }, POST_MARK_COOLDOWN);
    advanceToNext();
  }, [markStudent, clearAbsentTimer]);

  // ── Advance to next unmarked student ──────────────────────────────────────
  const advanceToNext = useCallback(() => {
    const state = useAttendanceStore.getState();
    let next = state.currentIndex + 1;
    while (next < state.students.length && state.students[next].status !== null) next++;
    if (next >= state.students.length) {
      isRunningRef.current = false;
      canMarkRef.current   = false;
      clearAbsentTimer();
      setRunning(false);
      setIsSpeaking(false);
      setListeningFor(null);
      Voice.stop().catch(() => {});
      return;
    }
    setCurrentIndex(next);
    speakStudent(state.students[next]);
  }, [setCurrentIndex, setRunning, clearAbsentTimer]);

  // ── Speak name → then open the 5s listening window ───────────────────────
  const speakStudent = useCallback((student: { roll_number: string; full_name: string }) => {
    const utterance = `Roll ${student.roll_number}. ${student.full_name}`;
    setListeningFor(student.full_name);
    setIsSpeaking(true);
    canMarkRef.current = false;
    isTTSRef.current   = true;   // block mic restarts while speaking

    // Stop any open mic so it doesn't record TTS audio
    Voice.stop().catch(() => {});
    setIsListening(false);

    const openListeningWindow = (gen: number) => {
      isTTSRef.current = false;
      setIsSpeaking(false);

      // Brief silence buffer, then open the window and start mic fresh
      setTimeout(() => {
        if (!isRunningRef.current || genRef.current !== gen) return;
        canMarkRef.current = true;
        startMicForGen(gen);   // one clean "tadan" right here

        // Auto-absent if student doesn't respond within ABSENT_TIMEOUT_MS
        clearAbsentTimer();
        absentTimerRef.current = setTimeout(() => {
          // Use gen check only — don't check canMarkRef (camera could have cleared it)
          if (!isRunningRef.current || genRef.current !== gen) return;
          const { students, currentIndex } = useAttendanceStore.getState();
          const s = students[currentIndex];
          if (!s || s.status !== null) return;  // already marked (by voice/camera) — skip
          canMarkRef.current    = false;
          lastMarkedRef.current = s.id;
          markStudent(s.id, 'absent', 'voice');
          setTimeout(() => { lastMarkedRef.current = null; }, POST_MARK_COOLDOWN);
          advanceToNext();
        }, ABSENT_TIMEOUT_MS);
      }, POST_SPEAK_DELAY_MS);
    };

    const gen = genRef.current;
    const fallback = setTimeout(() => openListeningWindow(gen), Math.max(3500, utterance.length * 80));
    const done = () => { clearTimeout(fallback); openListeningWindow(gen); };

    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        const lang = voices.some((v) => v.language?.startsWith('en-IN')) ? 'en-IN' : 'en-US';
        Speech.speak(utterance, { language: lang, rate: 0.82, onDone: done, onStopped: done, onError: done });
      })
      .catch(() => {
        Speech.speak(utterance, { language: 'en-US', rate: 0.82, onDone: done, onStopped: done, onError: done });
      });
  }, [startMicForGen, clearAbsentTimer, markStudent, advanceToNext]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      isTTSRef.current     = false;
      canMarkRef.current   = false;
      genRef.current++;
      clearAbsentTimer();
      Speech.stop();
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
  }, [clearAbsentTimer]);

  // ── Public API ────────────────────────────────────────────────────────────
  const startAttendance = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current  = true;
    isTTSRef.current      = false;
    canMarkRef.current    = false;
    lastMarkedRef.current = null;
    genRef.current++;
    clearAbsentTimer();
    setRunning(true);
    const { students, currentIndex } = useAttendanceStore.getState();
    let idx = currentIndex;
    while (idx < students.length && students[idx].status !== null) idx++;
    if (idx >= students.length) return;
    setCurrentIndex(idx);
    speakStudent(students[idx]);
    // Note: mic is started by speakStudent→openListeningWindow, NOT here
  }, [speakStudent, setCurrentIndex, setRunning, clearAbsentTimer]);

  const pauseAttendance = useCallback(() => {
    isRunningRef.current  = false;
    isStartingRef.current = false;
    isTTSRef.current      = false;
    canMarkRef.current    = false;
    genRef.current++;
    clearAbsentTimer();
    setRunning(false);
    setIsListening(false);
    setIsSpeaking(false);
    Speech.stop();
    Voice.stop().catch(() => {});
  }, [setRunning, clearAbsentTimer]);

  const resumeAttendance = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current  = true;
    isTTSRef.current      = false;
    canMarkRef.current    = false;
    lastMarkedRef.current = null;
    genRef.current++;
    clearAbsentTimer();
    setRunning(true);
    const { students, currentIndex } = useAttendanceStore.getState();
    let idx = currentIndex;
    while (idx < students.length && students[idx].status !== null) idx++;
    if (idx >= students.length) return;
    setCurrentIndex(idx);
    speakStudent(students[idx]);
  }, [speakStudent, setCurrentIndex, setRunning, clearAbsentTimer]);

  const manualOverride = useCallback((studentId: string, status: AttendanceStatus) => {
    clearAbsentTimer();
    canMarkRef.current = false;
    markStudent(studentId, status, 'manual');
    const state = useAttendanceStore.getState();
    if (state.students[state.currentIndex]?.id === studentId && isRunningRef.current) {
      advanceToNext();
    }
  }, [markStudent, advanceToNext, clearAbsentTimer]);

  const markPresentByCamera = useCallback(() => {
    // Only act inside the active listening window — same gate as voice
    if (!canMarkRef.current) return;
    const { students, currentIndex } = useAttendanceStore.getState();
    const student = students[currentIndex];
    if (!student || student.status !== null) return;
    if (lastMarkedRef.current === student.id) return;
    clearAbsentTimer();
    canMarkRef.current    = false;
    lastMarkedRef.current = student.id;
    markStudent(student.id, 'present', 'camera');
    setTimeout(() => { lastMarkedRef.current = null; }, POST_MARK_COOLDOWN);
    advanceToNext();
  }, [markStudent, advanceToNext, clearAbsentTimer]);

  return {
    isListening, isSpeaking, listeningFor, error,
    startAttendance, pauseAttendance, resumeAttendance, manualOverride, markPresentByCamera,
  };
}
