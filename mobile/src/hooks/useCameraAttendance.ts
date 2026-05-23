import { useRef, useCallback, useState } from 'react';
import { Camera } from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system';
import { detectPose, FaceBox } from '../api/pose';

const CAPTURE_INTERVAL_MS = 1000;

export function useCameraAttendance(onHandRaised?: () => void) {
  const cameraRef       = useRef<Camera>(null);
  const activeRef       = useRef(false);
  const capturingRef    = useRef(false);
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always hold the latest callback — no stale closure issues
  const onHandRaisedRef = useRef(onHandRaised);
  onHandRaisedRef.current = onHandRaised;

  const [faceBoxes,  setFaceBoxes]  = useState<FaceBox[]>([]);
  const [handRaised, setHandRaised] = useState(false);

  const loopRef = useRef<() => Promise<void>>();
  loopRef.current = async () => {
    if (!activeRef.current) return;

    if (cameraRef.current && !capturingRef.current) {
      capturingRef.current = true;
      try {
        const snapshot = await cameraRef.current.takeSnapshot({
          quality: 30,
          skipMetadata: true,
        });
        const uri = snapshot.path.startsWith('file://') ? snapshot.path : `file://${snapshot.path}`;
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

        if (base64 && activeRef.current) {
          const result = await detectPose(base64);
          console.log('[Camera] faces:', result.faces.length, 'handRaised:', result.hand_raised);
          if (activeRef.current) {
            setFaceBoxes(result.faces);
            setHandRaised(result.hand_raised);
            // Call directly — bypasses React state/effect timing so canMarkRef is always current
            if (result.hand_raised) {
              onHandRaisedRef.current?.();
            }
          }
        }
      } catch (err) {
        console.error('[Camera] error:', err);
      } finally {
        capturingRef.current = false;
      }
    }

    if (activeRef.current) {
      timerRef.current = setTimeout(() => loopRef.current?.(), CAPTURE_INTERVAL_MS);
    }
  };

  // Called by onInitialized — just marks camera as ready, no API calls yet
  const startCamera = useCallback(() => {
    capturingRef.current = false;
  }, []);

  // Called when Start is clicked — begins sending frames to backend
  const startAnalysis = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    capturingRef.current = false;
    timerRef.current = setTimeout(() => loopRef.current?.(), 800);
  }, []);

  // Called when Pause, Submit, or attendance ends — stops API calls but keeps preview
  const stopAnalysis = useCallback(() => {
    activeRef.current = false;
    capturingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFaceBoxes([]);
    setHandRaised(false);
  }, []);

  // Called when camera toggle is turned OFF
  const stopCamera = useCallback(() => {
    stopAnalysis();
  }, [stopAnalysis]);

  return { cameraRef, faceBoxes, handRaised, startCamera, startAnalysis, stopAnalysis, stopCamera };
}
