import base64
import numpy as np
import cv2
import mediapipe as mp

_face_detection = mp.solutions.face_detection.FaceDetection(
    model_selection=1,
    min_detection_confidence=0.4,
)

_pose = mp.solutions.pose.Pose(
    static_image_mode=True,
    model_complexity=1,
    min_detection_confidence=0.4,
)

_LEFT_WRIST     = 15
_RIGHT_WRIST    = 16
_LEFT_SHOULDER  = 11
_RIGHT_SHOULDER = 12


def _decode_and_orient(b64_jpeg: str) -> np.ndarray:
    """Decode base64 JPEG and correct orientation using EXIF data."""
    data = base64.b64decode(b64_jpeg)
    arr  = np.frombuffer(data, dtype=np.uint8)
    # IMREAD_COLOR ignores EXIF — we handle rotation manually
    img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    # Read EXIF orientation tag to rotate correctly
    try:
        img_exif = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
        exif_data = None
        # Check for EXIF in JPEG
        raw = bytes(data)
        # Look for EXIF orientation: 0x0112 big-endian
        exif_offset = raw.find(b'\x01\x12\x00\x03')
        if exif_offset == -1:
            exif_offset = raw.find(b'\x12\x01\x03\x00')
        if exif_offset != -1:
            # Read orientation value (varies by byte order)
            try:
                orient = raw[exif_offset + 8]
                if orient == 6:    # 90 CW (most common on Android back camera)
                    img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
                elif orient == 8:  # 90 CCW
                    img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
                elif orient == 3:  # 180
                    img = cv2.rotate(img, cv2.ROTATE_180)
            except Exception:
                pass
    except Exception:
        pass

    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def detect_faces_and_gesture(b64_jpeg: str) -> dict:
    """
    Returns:
    {
      "faces": [{"x": 0.1, "y": 0.05, "w": 0.2, "h": 0.3}, ...],
      "hand_raised": bool
    }
    All values are fractions of image width/height (0.0-1.0).
    """
    try:
        img = _decode_and_orient(b64_jpeg)

        # ── Face detection ───────────────────────────────────────────────────
        face_results = _face_detection.process(img)
        faces = []
        if face_results.detections:
            for det in face_results.detections:
                bb = det.location_data.relative_bounding_box
                # Clamp to [0, 1]
                x = max(0.0, float(bb.xmin))
                y = max(0.0, float(bb.ymin))
                w = min(float(bb.width),  1.0 - x)
                h = min(float(bb.height), 1.0 - y)
                if w > 0.01 and h > 0.01:
                    faces.append({"x": x, "y": y, "w": w, "h": h})

        # ── Hand raised detection ────────────────────────────────────────────
        hand_raised = False
        pose_results = _pose.process(img)
        if pose_results.pose_landmarks:
            lm = pose_results.pose_landmarks.landmark

            lw  = lm[_LEFT_WRIST]
            rw  = lm[_RIGHT_WRIST]
            ls  = lm[_LEFT_SHOULDER]
            rs  = lm[_RIGHT_SHOULDER]

            # y decreases upward in normalized coords (0=top, 1=bottom)
            # wrist.y < shoulder.y means wrist is ABOVE shoulder
            left_raised  = lw.visibility > 0.4 and lw.y < (ls.y - 0.05)
            right_raised = rw.visibility > 0.4 and rw.y < (rs.y - 0.05)
            hand_raised  = left_raised or right_raised

        return {"faces": faces, "hand_raised": hand_raised}

    except Exception as e:
        print(f"[pose_service] error: {e}")
        return {"faces": [], "hand_raised": False}
