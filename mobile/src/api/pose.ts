import apiClient from './client';

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PoseResult {
  faces: FaceBox[];
  hand_raised: boolean;
}

export async function detectPose(base64Jpeg: string): Promise<PoseResult> {
  try {
    console.log('[Pose API] sending frame, size:', base64Jpeg.length);
    const response = await apiClient.post<PoseResult>('/pose/detect', {
      frame: base64Jpeg,
    });
    console.log('[Pose API] response:', JSON.stringify(response.data));
    return response.data;
  } catch (err: any) {
    console.error('[Pose API] error:', err?.message, err?.response?.status, JSON.stringify(err?.response?.data));
    return { faces: [], hand_raised: false };
  }
}
