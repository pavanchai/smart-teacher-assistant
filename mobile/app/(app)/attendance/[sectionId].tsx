import {
  useEffect, useRef, useCallback, useState, useMemo,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Animated, Modal, ActivityIndicator, Alert,
  PermissionsAndroid, Platform, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Camera, useCameraPermission, useCameraDevice } from 'react-native-vision-camera';
import { getStudentsForSection } from '../../../src/api/students';
import { getSection } from '../../../src/api/classes';
import { startSession, submitSession } from '../../../src/api/attendance';
import { useAttendanceStore } from '../../../src/store/attendanceStore';
import { useVoiceAttendance } from '../../../src/hooks/useVoiceAttendance';
import { useCameraAttendance } from '../../../src/hooks/useCameraAttendance';
import { useOfflineSync } from '../../../src/hooks/useOfflineSync';
import { COLORS } from '../../../src/constants';
import { StudentAttendanceState, AttendanceStatus } from '../../../src/types';
import { FaceBox } from '../../../src/api/pose';

const SCREEN_W = Dimensions.get('window').width;
const CAMERA_H = 220;

function formatDate(date: Date) {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Face bounding box overlay ────────────────────────────────────────────────
function FaceOverlay({ faces, handRaised }: { faces: FaceBox[]; handRaised: boolean }) {
  // Initialize with known values so boxes render immediately without waiting for onLayout
  const [size, setSize] = useState({ w: SCREEN_W - 32, h: CAMERA_H });
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {faces.map((f, i) => (
        <View
          key={i}
          style={[
            styles.faceBox,
            {
              left:        f.x * size.w,
              top:         f.y * size.h,
              width:       f.w * size.w,
              height:      f.h * size.h,
              borderColor: handRaised ? COLORS.success : '#00FF88',
            },
          ]}
        />
      ))}
      {faces.length > 0 && (
        <View style={styles.faceCountBadge}>
          <Ionicons name="people" size={12} color="#fff" />
          <Text style={styles.faceCountText}>{faces.length} detected</Text>
        </View>
      )}
      {handRaised && (
        <View style={styles.handRaisedBadge}>
          <Text style={styles.handRaisedText}>✋ Hand raised!</Text>
        </View>
      )}
    </View>
  );
}

// ── Student list item ────────────────────────────────────────────────────────
function StudentListItem({ item, isCurrent, overrideMode, onMarkPresent, onMarkAbsent }: {
  item: StudentAttendanceState;
  isCurrent: boolean;
  overrideMode: boolean;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
}) {
  const cfg = useMemo(() => {
    if (!item.status) return {
      bg: isCurrent ? COLORS.primary + '12' : 'transparent',
      border: isCurrent ? COLORS.primary : 'transparent',
      icon: isCurrent ? 'time-outline' : undefined,
      color: COLORS.primary,
    };
    if (item.status === 'present') return {
      bg: COLORS.success + '12', border: COLORS.success + '40',
      icon: ({ voice: 'mic', camera: 'camera', manual: 'finger-print' } as any)[item.marked_by ?? 'manual'],
      color: COLORS.success,
    };
    return { bg: COLORS.danger + '10', border: COLORS.danger + '30', icon: 'close-circle', color: COLORS.danger };
  }, [item.status, item.marked_by, isCurrent]);

  const handleOverrideTap = useCallback(() => {
    Alert.alert(
      `${item.roll_number} · ${item.full_name}`,
      `Currently marked: ${item.status?.toUpperCase()}`,
      [
        { text: 'Mark Present', onPress: onMarkPresent, style: 'default' },
        { text: 'Mark Absent',  onPress: onMarkAbsent,  style: 'destructive' },
        { text: 'Cancel',       style: 'cancel' },
      ],
    );
  }, [item, onMarkPresent, onMarkAbsent]);

  // ── Override mode row (full-row tap → Alert) ─────────────────────────────
  if (overrideMode) {
    return (
      <TouchableOpacity
        activeOpacity={0.65}
        onPress={handleOverrideTap}
        style={[styles.studentItem, { backgroundColor: cfg.bg, borderColor: cfg.border, borderWidth: 1 }]}
      >
        <View style={styles.rollBadge}>
          <Text style={styles.rollText}>{item.roll_number}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.studentName, item.status === 'absent' && styles.strikethrough]} numberOfLines={1}>
            {item.full_name}
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={(cfg.icon ?? (item.status === 'present' ? 'checkmark-circle' : 'close-circle')) as any}
              size={11} color={cfg.color}
            />
            <Text style={[styles.statusLabel, { color: cfg.color }]}>
              {item.status} · tap to change
            </Text>
          </View>
        </View>
        <Ionicons name="create-outline" size={18} color={COLORS.textSecondary} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  }

  // ── Live attendance row ───────────────────────────────────────────────────
  return (
    <View style={[styles.studentItem, { backgroundColor: cfg.bg, borderColor: cfg.border, borderWidth: isCurrent ? 2 : 1 }]}>
      {isCurrent && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.pulsingBorder]} pointerEvents="none" />
      )}
      <View style={styles.rollBadge}>
        <Text style={styles.rollText}>{item.roll_number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.studentName, item.status === 'absent' && styles.strikethrough]} numberOfLines={1}>
          {item.full_name}
        </Text>
        {cfg.icon && (
          <View style={styles.statusRow}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.statusLabel, { color: cfg.color }]}>
              {item.status ? `${item.status} · ${item.marked_by}` : isCurrent ? 'Calling...' : '–'}
            </Text>
          </View>
        )}
      </View>
      {(isCurrent || item.status === null) && (
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: COLORS.success }]} onPress={onMarkPresent}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: COLORS.danger }]} onPress={onMarkAbsent}>
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      {item.status !== null && !isCurrent && (
        <Ionicons
          name={item.status === 'present' ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={item.status === 'present' ? COLORS.success : COLORS.danger}
          style={{ marginLeft: 8 }}
        />
      )}
    </View>
  );
}

// ── Summary modal ────────────────────────────────────────────────────────────
function SummaryModal({ visible, presentCount, absentCount, totalCount, onConfirm, onCancel, isSubmitting }: {
  visible: boolean; presentCount: number; absentCount: number; totalCount: number;
  onConfirm: () => void; onCancel: () => void; isSubmitting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={styles.modalIconBg}>
              <Ionicons name="checkmark-done-circle" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Submit Attendance</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Review before submitting</Text>
          </View>
          <View style={styles.summaryRow}>
            {[
              { label: 'Present', count: presentCount, color: COLORS.success, icon: 'checkmark-circle' },
              { label: 'Absent',  count: absentCount,  color: COLORS.danger,  icon: 'close-circle' },
              { label: 'Total',   count: totalCount,   color: COLORS.textPrimary, icon: 'people' },
            ].map((s) => (
              <View key={s.label} style={[styles.summaryItem, { backgroundColor: s.color + '15' }]}>
                <Ionicons name={s.icon as any} size={22} color={s.color} />
                <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
          {totalCount - presentCount - absentCount > 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={15} color={COLORS.warning} />
              <Text style={{ flex: 1, fontSize: 12, color: COLORS.textPrimary }}>
                {totalCount - presentCount - absentCount} student(s) not marked — will be marked absent.
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={isSubmitting}>
              <Text style={{ fontWeight: '600', color: COLORS.textSecondary }}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} onPress={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="cloud-upload-outline" size={17} color="#fff" />
                  <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Submit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AttendanceScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();

  const flatListRef = useRef<FlatList<StudentAttendanceState>>(null);
  const [showSummary, setShowSummary]               = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [cameraEnabled, setCameraEnabled]           = useState(false);

  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');

  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const backCamera  = useCameraDevice('back');
  const frontCamera = useCameraDevice('front');
  const activeCamera = cameraFacing === 'front' ? frontCamera : backCamera;

  const {
    sessionId, students, currentIndex, isRunning,
    initSession, markStudent, getPresentCount, getAbsentCount, getUnmarkedCount,
  } = useAttendanceStore();

  const { syncRecords } = useOfflineSync();

  const {
    isListening, isSpeaking, listeningFor, error: voiceError,
    startAttendance, pauseAttendance, resumeAttendance, manualOverride, markPresentByCamera,
  } = useVoiceAttendance(sectionId);

  const { cameraRef, faceBoxes, handRaised, startCamera, startAnalysis, stopAnalysis, stopCamera } = useCameraAttendance(markPresentByCamera);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: sectionData } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => getSection(sectionId),
    enabled: !!sectionId,
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', sectionId],
    queryFn: () => getStudentsForSection(sectionId),
    enabled: !!sectionId,
  });

  const startSessionMutation = useMutation({
    mutationFn: () => startSession(sectionId, {
      date: new Date().toISOString().split('T')[0],
      mode: cameraEnabled ? 'camera' : 'voice',
    }),
    onSuccess: (session) => {
      if (studentsData) { initSession(session.id, sectionId, studentsData); setSessionInitialized(true); }
    },
    onError: () => {
      if (studentsData) { initSession('local-' + Date.now(), sectionId, studentsData); setSessionInitialized(true); }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const state = useAttendanceStore.getState();
      const toMarkedBy = (mb: string | null) => (mb === 'camera' ? 'manual' : mb ?? 'voice') as 'voice' | 'manual';
      const records = [
        ...state.students.filter((s) => s.status !== null).map((s) => ({
          student_id: s.id, status: s.status!, marked_by: toMarkedBy(s.marked_by),
        })),
        ...state.students.filter((s) => s.status === null).map((s) => ({
          student_id: s.id, status: 'absent' as AttendanceStatus, marked_by: 'voice' as const,
        })),
      ];
      if (state.sessionId && !state.sessionId.startsWith('local-')) {
        await syncRecords(state.sessionId, records);
        await submitSession(state.sessionId);
      } else if (state.sessionId) {
        await syncRecords(state.sessionId, records);
      }
    },
    onSuccess: () => { setShowSummary(false); useAttendanceStore.getState().reset(); router.back(); },
    onError:   () => { Alert.alert('Submit Failed', 'Saved locally. Will sync on reconnect.', [{ text: 'OK', onPress: () => router.back() }]); },
  });

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (studentsData && !sessionInitialized) startSessionMutation.mutate();
  }, [studentsData, sessionInitialized]);

  useEffect(() => {
    if (sectionData?.name) navigation.setOptions({ title: `${sectionData.name} — Attendance` });
  }, [sectionData, navigation]);

  useEffect(() => {
    if (students.length > 0 && currentIndex < students.length) {
      flatListRef.current?.scrollToIndex({ index: currentIndex, animated: true, viewPosition: 0.4 });
    }
  }, [currentIndex, students.length]);

  useEffect(() => {
    if (!sessionId || students.length === 0) return;
    const marked = students.filter((s) => s.status !== null);
    if (!marked.length) return;
    syncRecords(sessionId, marked.map((s) => ({
      student_id: s.id, status: s.status!,
      marked_by: (s.marked_by === 'camera' ? 'manual' : s.marked_by ?? 'voice') as 'voice' | 'manual',
    }))).catch(() => {});
  }, [students, sessionId]);


  // When all students done — stop analysis and close camera so override list is fully visible
  useEffect(() => {
    if (!isRunning && totalCount > 0 && markedCount === totalCount) {
      stopAnalysis();
      setCameraEnabled(false);
    }
  }, [isRunning, markedCount, totalCount, stopAnalysis]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        { title: 'Microphone Permission', message: 'Required for voice attendance.', buttonPositive: 'Allow' }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Microphone access is required.'); return;
      }
    }
    const marked = students.filter((s) => s.status !== null).length;
    marked > 0 ? resumeAttendance() : startAttendance();
    if (cameraEnabled) startAnalysis();
  }, [students, resumeAttendance, startAttendance, cameraEnabled, startAnalysis]);

  const handleCameraToggle = useCallback(async () => {
    if (cameraEnabled) {
      stopCamera();
      setCameraEnabled(false);
    } else {
      if (!hasCameraPermission) {
        const granted = await requestCameraPermission();
        if (!granted) {
          Alert.alert('Camera Permission Denied', 'Camera access is required.'); return;
        }
      }
      setCameraEnabled(true);
    }
  }, [cameraEnabled, hasCameraPermission, requestCameraPermission, stopCamera]);

  const handlePause = useCallback(() => {
    pauseAttendance();
    stopAnalysis();
  }, [pauseAttendance, stopAnalysis]);

  const handleSubmit = useCallback(() => {
    if (isRunning) pauseAttendance();
    stopAnalysis();
    setShowSummary(true);
  }, [isRunning, pauseAttendance, stopAnalysis]);

  const markedCount    = students.filter((s) => s.status !== null).length;
  const totalCount     = students.length;
  const progressPct    = totalCount > 0 ? markedCount / totalCount : 0;
  const currentStudent = students[currentIndex];
  // Override mode: all students marked AND session not actively running
  const overrideMode   = totalCount > 0 && markedCount === totalCount && !isRunning;

  const handleManual = useCallback((id: string, status: AttendanceStatus) => {
    manualOverride(id, status);
  }, [manualOverride]);

  const renderItem = useCallback(({ item, index }: { item: StudentAttendanceState; index: number }) => (
    <StudentListItem
      item={item}
      isCurrent={index === currentIndex}
      overrideMode={overrideMode}
      onMarkPresent={() => handleManual(item.id, 'present')}
      onMarkAbsent={() => handleManual(item.id, 'absent')}
    />
  ), [currentIndex, overrideMode, handleManual]);

  if (studentsLoading || startSessionMutation.isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 10 }}>Preparing session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, isRunning && styles.liveDotActive]} />
          <Text style={[styles.liveText, isRunning && { color: COLORS.danger }]}>
            {isRunning ? 'LIVE' : 'READY'}
          </Text>
        </View>
        <Text style={styles.headerDate}>{formatDate(new Date())}</Text>
        <Text style={styles.headerCount}>{markedCount}/{totalCount}</Text>
      </View>

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
      </View>

      {/* ── Camera view (always-on when enabled) ───────────────────────── */}
      {cameraEnabled && activeCamera && (
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            device={activeCamera}
            isActive={cameraEnabled}
            onInitialized={startCamera}
            photo={true}
          />
          <FaceOverlay faces={faceBoxes} handRaised={handRaised} />
          <View style={styles.cameraLabel}>
            <Ionicons name="scan" size={12} color="#fff" />
            <Text style={styles.cameraLabelText}>
              {faceBoxes.length > 0 ? `${faceBoxes.length} student(s) detected` : 'Point camera at students'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
          >
            <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Current student card (hidden in override mode) ────────────── */}
      {currentStudent && !overrideMode && (
        <View style={styles.currentCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={[styles.currentIcon, { backgroundColor: COLORS.primary + '15' }]}>
              {isSpeaking
                ? <Ionicons name="volume-high" size={20} color={COLORS.primary} />
                : isListening
                  ? <Ionicons name="mic" size={20} color={COLORS.danger} />
                  : <Ionicons name="person" size={20} color={COLORS.textSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              {isSpeaking  && <Text style={[styles.statusChip, { color: COLORS.primary }]}>CALLING...</Text>}
              {isListening && <Text style={[styles.statusChip, { color: COLORS.danger }]}>LISTENING...</Text>}
              {!isSpeaking && !isListening && isRunning && (
                <Text style={[styles.statusChip, { color: COLORS.textSecondary }]}>PROCESSING</Text>
              )}
            </View>
            <View style={styles.progressStats}>
              <Text style={[styles.statItem, { color: COLORS.success }]}>✓ {getPresentCount()}</Text>
              <Text style={[styles.statItem, { color: COLORS.danger }]}>✗ {getAbsentCount()}</Text>
              <Text style={[styles.statItem, { color: COLORS.gray400 }]}>– {getUnmarkedCount()}</Text>
            </View>
          </View>

          <Text style={styles.currentRoll}>Roll {currentStudent.roll_number}</Text>
          <Text style={styles.currentName}>{currentStudent.full_name}</Text>

          {isListening && (
            <View style={styles.listeningHint}>
              <Ionicons name="mic" size={13} color={COLORS.danger} />
              <Text style={styles.listeningHintText}>Say "present", "yes", or "here"</Text>
              {cameraEnabled && (
                <>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}> · </Text>
                  <Ionicons name="hand-left" size={13} color={COLORS.success} />
                  <Text style={[styles.listeningHintText, { color: COLORS.success }]}>or raise hand</Text>
                </>
              )}
            </View>
          )}

          <View style={styles.overrideRow}>
            <TouchableOpacity style={[styles.overrideBtn, { backgroundColor: COLORS.success }]}
              onPress={() => handleManual(currentStudent.id, 'present')}>
              <Ionicons name="checkmark-circle" size={17} color="#fff" />
              <Text style={styles.overrideBtnText}>Present</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.overrideBtn, { backgroundColor: COLORS.danger }]}
              onPress={() => handleManual(currentStudent.id, 'absent')}>
              <Ionicons name="close-circle" size={17} color="#fff" />
              <Text style={styles.overrideBtnText}>Absent</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Student list ───────────────────────────────────────────────── */}
      <View style={{ flex: 1, paddingTop: 6 }}>
        {overrideMode ? (
          <View style={styles.cautionBanner}>
            <Ionicons name="warning" size={15} color="#92400E" />
            <Text style={styles.cautionText}>
              Override mode — tap any student to flip their status. Submit when done.
            </Text>
          </View>
        ) : (
          <Text style={styles.listTitle}>STUDENTS</Text>
        )}
        <FlatList
          ref={flatListRef}
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={overrideMode}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
          onScrollToIndexFailed={() => {}}
        />
      </View>

      {/* ── Bottom controls ────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        {/* Start / Pause */}
        {!isRunning ? (
          <TouchableOpacity
            style={[styles.ctrlBtn, { backgroundColor: COLORS.success, flex: 1.2 }]}
            onPress={handleStart} disabled={!sessionInitialized}>
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.ctrlBtnText}>{markedCount > 0 ? 'Resume' : 'Start'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctrlBtn, { backgroundColor: COLORS.warning, flex: 1.2 }]}
            onPress={handlePause}>
            <Ionicons name="pause" size={18} color="#fff" />
            <Text style={styles.ctrlBtnText}>Pause</Text>
          </TouchableOpacity>
        )}

        {/* Camera toggle */}
        <TouchableOpacity
          style={[styles.ctrlBtn, { backgroundColor: cameraEnabled ? '#7C3AED' : COLORS.gray400 }]}
          onPress={handleCameraToggle}>
          <Ionicons name={cameraEnabled ? 'camera' : 'camera-outline'} size={18} color="#fff" />
          <Text style={styles.ctrlBtnText}>{cameraEnabled ? 'Off Camera' : 'On Camera'}</Text>
        </TouchableOpacity>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.ctrlBtn, { backgroundColor: COLORS.primary }]}
          onPress={handleSubmit} disabled={!sessionInitialized}>
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={styles.ctrlBtnText}>Submit</Text>
        </TouchableOpacity>
      </View>

      <SummaryModal
        visible={showSummary}
        presentCount={getPresentCount()}
        absentCount={getAbsentCount()}
        totalCount={totalCount}
        onConfirm={() => submitMutation.mutate()}
        onCancel={() => setShowSummary(false)}
        isSubmitting={submitMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  loading:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Header
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  liveBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.gray100, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  liveDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gray400 },
  liveDotActive:   { backgroundColor: COLORS.danger },
  liveText:        { fontSize: 11, fontWeight: '700', color: COLORS.gray400, letterSpacing: 0.5 },
  headerDate:      { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  headerCount:     { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  // Progress
  progressBar:     { height: 4, backgroundColor: COLORS.gray200 },
  progressFill:    { height: 4, backgroundColor: COLORS.primary },
  // Camera
  cameraContainer: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, overflow: 'hidden', height: CAMERA_H },
  camera:          { flex: 1 },
  faceBox:         { position: 'absolute', borderWidth: 3, borderRadius: 6 },
  faceCountBadge:  { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  faceCountText:   { color: '#fff', fontSize: 11, fontWeight: '600' },
  handRaisedBadge: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
  handRaisedText:  { backgroundColor: COLORS.success, color: '#fff', fontWeight: '700', fontSize: 13, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  cameraLabel:     { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 5 },
  cameraLabelText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  flipBtn:         { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, padding: 7 },
  // Current student card
  currentCard:     { backgroundColor: COLORS.card, marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.primary + '30', elevation: 3 },
  currentIcon:     { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  statusChip:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  progressStats:   { flexDirection: 'row', gap: 8 },
  statItem:        { fontSize: 12, fontWeight: '700' },
  currentRoll:     { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 1 },
  currentName:     { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  listeningHint:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.danger + '10', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  listeningHintText: { fontSize: 11, color: COLORS.danger, fontWeight: '500' },
  overrideRow:     { flexDirection: 'row', gap: 10 },
  overrideBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 9 },
  overrideBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // List
  listTitle:       { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, paddingHorizontal: 16, marginBottom: 3, letterSpacing: 0.5 },
  studentItem:     { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 3, height: 64, overflow: 'hidden' },
  rollBadge:       { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.gray100, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  rollText:        { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  studentName:     { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 1 },
  strikethrough:   { textDecorationLine: 'line-through', color: COLORS.textSecondary },
  statusRow:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusLabel:     { fontSize: 10, fontWeight: '500' },
  quickActions:    { flexDirection: 'row', gap: 5, marginLeft: 8 },
  quickBtn:        { width: 27, height: 27, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  pulsingBorder:   { borderRadius: 10, borderWidth: 2, borderColor: COLORS.primary + '80' },
  // Bottom bar
  bottomBar:       { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctrlBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 13 },
  ctrlBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:       { backgroundColor: COLORS.card, borderRadius: 20, padding: 22, width: '100%', maxWidth: 380 },
  modalIconBg:     { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  summaryRow:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryItem:     { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  summaryCount:    { fontSize: 22, fontWeight: '800' },
  summaryLabel:    { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  warningBox:      { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: COLORS.warning + '15', borderRadius: 9, padding: 10, marginBottom: 14 },
  cancelBtn:          { flex: 1, borderRadius: 11, paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.gray100 },
  submitBtn:          { flex: 1.5, flexDirection: 'row', borderRadius: 11, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.primary },
  // Override mode
  cautionBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 6, backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  cautionText:   { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '500', lineHeight: 17 },
});
