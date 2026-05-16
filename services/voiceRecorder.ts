import { Audio } from 'expo-av';

let recording: Audio.Recording | null = null;

export const startRecording = async (): Promise<void> => {
  await Audio.requestPermissionsAsync();

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  await recording.startAsync();
};

export const stopRecording = async (): Promise<string> => {
  if (!recording) throw new Error('No recording in progress');

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();

  if (!uri) throw new Error('Recording failed');

  return uri;
};
