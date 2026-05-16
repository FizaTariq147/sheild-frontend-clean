import axios from 'axios';

const BASE_URL = 'https://fiza-tariq-shield-voice-detection.hf.space';

export interface VoiceResponse {
  final_decision: 'DISTRESS' | 'NORMAL';
  voice_distress: boolean;
  keyword_detected: boolean;
  transcript: string;
}

export const analyzeAudio = async (uri: string): Promise<VoiceResponse> => {
  const formData = new FormData();

formData.append('file', {
  uri,
  name: 'voice.wav',
  type: 'audio/wav',
} as any);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.post<VoiceResponse>(
        `${BASE_URL}/analyze-audio`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        }
      );
      return response.data;
    } catch (err) {
      if (attempt === 3) throw err;
      console.log(`Attempt ${attempt} failed, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  throw new Error('All attempts failed');
};