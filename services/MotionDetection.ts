import { Accelerometer, Gyroscope } from "expo-sensors";
import type { AccelerometerSubscription } from "expo-sensors";

export type MotionSensitivity = "LOW" | "MEDIUM" | "HIGH";

// ── Config ────────────────────────────────────────────────────────────────────
// const API_URL = "http://192.168.10.8:8001/predict-motion";
const API_URL = "https://fiza-tariq-shield-motion-detection.hf.space/predict-motion";

const SAMPLE_INTERVAL_MS = 20;
const WINDOW_SIZE = 128;
const FEATURE_COUNT = 36;

// Shake thresholds
const SHAKE_THRESHOLD: Record<MotionSensitivity, number> = {
  LOW:    1.0,   // strong shake
  MEDIUM: 0.7,   // moderate shake
  HIGH:   0.4,   // light shake
};

// CNN confidence thresholds
const CONFIDENCE_THRESHOLDS: Record<MotionSensitivity, number> = {
  LOW:    0.90,
  MEDIUM: 0.75,
  HIGH:   0.60,
};

const REQUIRED_PEAKS = 3;
const SHAKE_WINDOW_MS = 1500;
const COOLDOWN_MS      = 5000;

// ── State ─────────────────────────────────────────────────────────────────────
let accelSub: AccelerometerSubscription | null = null;
let gyroSub:  AccelerometerSubscription | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

const accelBuffer: number[][] = [];
const gyroBuffer:  number[][] = [];

let lastX = 0, lastY = 0, lastZ = 0;
let peakTimes: number[] = [];

let isCooldown       = false;
let isRunning        = false;
let shakeDetected    = false; // shake gate — CNN only runs after shake
let currentShakeThreshold      = SHAKE_THRESHOLD.MEDIUM;
let currentConfidenceThreshold = CONFIDENCE_THRESHOLDS.MEDIUM;

// ── Statistical helpers ───────────────────────────────────────────────────────
const mean = (arr: number[]): number =>
  arr.reduce((a, b) => a + b, 0) / arr.length;

const std = (arr: number[]): number => {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
};

const energy = (arr: number[]): number =>
  arr.reduce((a, b) => a + b * b, 0) / arr.length;

const correlation = (a: number[], b: number[]): number => {
  const ma = mean(a), mb = mean(b);
  const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
  const den = Math.sqrt(
    a.reduce((s, v) => s + (v - ma) ** 2, 0) *
    b.reduce((s, v) => s + (v - mb) ** 2, 0)
  );
  return den === 0 ? 0 : num / den;
};

// ── Feature builder — exact 36 UCI columns ───────────────────────────────────
const buildFeatureVector = (
  accel: number[][],
  gyro:  number[][]
): number[] => {
  const ax = accel.map(s => s[0]), ay = accel.map(s => s[1]), az = accel.map(s => s[2]);
  const gx = gyro.map(s => s[0]),  gy = gyro.map(s => s[1]),  gz = gyro.map(s => s[2]);

  return [
    // tBodyAcc: mean, std, max, min, energy (×3 axes = 15)
    mean(ax), mean(ay), mean(az),
    std(ax),  std(ay),  std(az),
    Math.max(...ax), Math.max(...ay), Math.max(...az),
    Math.min(...ax), Math.min(...ay), Math.min(...az),
    energy(ax), energy(ay), energy(az),

    // tBodyGyro: mean, std, max, min, energy (×3 axes = 15)
    mean(gx), mean(gy), mean(gz),
    std(gx),  std(gy),  std(gz),
    Math.max(...gx), Math.max(...gy), Math.max(...gz),
    Math.min(...gx), Math.min(...gy), Math.min(...gz),
    energy(gx), energy(gy), energy(gz),

    // correlations (6)
    correlation(ax, ay), correlation(ax, az), correlation(ay, az),
    correlation(gx, gy), correlation(gx, gz), correlation(gy, gz),
  ]; // exactly 36
};

// ── Step 2: CNN confirmation ──────────────────────────────────────────────────
const runCNNConfirmation = async (onTrigger: () => void): Promise<void> => {
  // ── REMOVE this check ──
  // if (accelBuffer.length < WINDOW_SIZE || gyroBuffer.length < WINDOW_SIZE) {
  //   console.log("⏳ Not enough samples for CNN yet");
  //   return;
  // }

  // Use whatever samples we have, pad with last value if short
  const accelSamples = [...accelBuffer];
  const gyroSamples  = [...gyroBuffer];

  // Pad to WINDOW_SIZE if needed
  while (accelSamples.length < WINDOW_SIZE) {
    accelSamples.push(accelSamples[accelSamples.length - 1] ?? [0, 0, 0]);
  }
  while (gyroSamples.length < WINDOW_SIZE) {
    gyroSamples.push(gyroSamples[gyroSamples.length - 1] ?? [0, 0, 0]);
  }

  accelBuffer.length = 0;
  gyroBuffer.length  = 0;

  const features = buildFeatureVector(
    accelSamples.slice(0, WINDOW_SIZE),
    gyroSamples.slice(0, WINDOW_SIZE)
  );

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readings: features }),
    });

    const data: {
      activity: "ACTIVE" | "NORMAL";
      confidence: number;
      active_probability: number;
    } = await res.json();

    console.log(`🤖 CNN → ${data.activity} (${(data.confidence * 100).toFixed(1)}%)`);

    if (
      data.activity === "ACTIVE" &&
      data.active_probability >= currentConfidenceThreshold
    ) {
      isCooldown    = true;
      shakeDetected = false;
      console.log("🚨 SHAKE + CNN CONFIRMED → SOS TRIGGERED");
      onTrigger();
      setTimeout(() => {
        isCooldown = false;
        console.log("✅ Cooldown reset");
      }, COOLDOWN_MS);
    } else {
      shakeDetected = false;
      console.log("🟡 Shake detected but CNN says NORMAL — ignored");
    }
  } catch (err) {
    console.warn("⚠️ CNN unavailable, falling back to shake-only trigger");
    shakeDetected = false;
    isCooldown    = true;
    onTrigger();
    setTimeout(() => { isCooldown = false; }, COOLDOWN_MS);
  }
};

// ── Step 1: Shake gate ────────────────────────────────────────────────────────
const processSample = (
  x: number, y: number, z: number,
  onTrigger: () => void
): void => {
  if (isCooldown || shakeDetected) return;

  const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
  lastX = x; lastY = y; lastZ = z;


  const now = Date.now();

  if (delta > currentShakeThreshold) {
    peakTimes = peakTimes.filter(t => now - t < SHAKE_WINDOW_MS);
    peakTimes.push(now);
    console.log(`📳 Peak | delta: ${delta.toFixed(2)} | peaks: ${peakTimes.length}/${REQUIRED_PEAKS}`);

    if (peakTimes.length >= REQUIRED_PEAKS) {
      peakTimes     = [];
      shakeDetected = true;
      console.log("📳 Shake confirmed → sending to CNN for verification...");
      runCNNConfirmation(onTrigger);
    }
  }
};

// ── Public API ────────────────────────────────────────────────────────────────
export const startShakeDetection = (
  onTrigger: () => void,
  sensitivity: MotionSensitivity = "MEDIUM"
): void => {
  stopShakeDetection();

  currentShakeThreshold      = SHAKE_THRESHOLD[sensitivity];
  currentConfidenceThreshold = CONFIDENCE_THRESHOLDS[sensitivity];
  isCooldown    = false;
  isRunning     = true;
  shakeDetected = false;
  peakTimes     = [];
  lastX = 0; lastY = 0; lastZ = 0;

  Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
  Gyroscope.setUpdateInterval(SAMPLE_INTERVAL_MS);

  accelSub = Accelerometer.addListener(({ x, y, z }) => {
    accelBuffer.push([x, y, z]);
    processSample(x, y, z, onTrigger);
  });

  gyroSub = Gyroscope.addListener(({ x, y, z }) => {
    gyroBuffer.push([x, y, z]);
  });

  console.log(`✅ Motion detection started | Shake: ${currentShakeThreshold} | CNN: ${currentConfidenceThreshold}`);
};

export const stopShakeDetection = (): void => {
  accelSub?.remove();
  gyroSub?.remove();
  if (intervalId) clearInterval(intervalId);

  accelSub      = null;
  gyroSub       = null;
  intervalId    = null;
  isRunning     = false;
  isCooldown    = false;
  shakeDetected = false;
  peakTimes     = [];
  lastX = 0; lastY = 0; lastZ = 0;

  accelBuffer.length = 0;
  gyroBuffer.length  = 0;

  console.log("🛑 Motion detection stopped");
};

export const isMotionDetectionRunning = (): boolean => isRunning;

export const updateSensitivity = (sensitivity: MotionSensitivity): void => {
  currentShakeThreshold      = SHAKE_THRESHOLD[sensitivity];
  currentConfidenceThreshold = CONFIDENCE_THRESHOLDS[sensitivity];
  console.log(`⚙️ Sensitivity updated: ${sensitivity}`);
};