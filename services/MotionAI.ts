// services/MotionAI.ts
import { Accelerometer } from "expo-sensors";

type MotionCallback = (result: {
  result: "NORMAL" | "DISTRESS";
  score: number;
}) => void;

let subscription: any = null;
let buffer: { x: number; y: number; z: number; t: number }[] = [];

let intervalRef: any = null;
let isRunning = false;

const API_URL = "http://192.168.10.8:8000/predict-motion"; // change to your backend

const SAMPLE_INTERVAL = 100; // ms
const SEND_INTERVAL = 3000; // send every 3 sec
const MIN_SAMPLES = 20;

export const startMotionAI = (callback: MotionCallback) => {
  if (isRunning) return;
  isRunning = true;

  buffer = [];

  Accelerometer.setUpdateInterval(SAMPLE_INTERVAL);

  subscription = Accelerometer.addListener((data) => {
    buffer.push({
      x: data.x,
      y: data.y,
      z: data.z,
      t: Date.now(),
    });

    // prevent memory overflow
    if (buffer.length > 100) {
      buffer.shift();
    }
  });

  intervalRef = setInterval(async () => {
    if (buffer.length < MIN_SAMPLES) return;

    const payload = {
      readings: [...buffer],
    };

    buffer = []; // clear after snapshot

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.log("❌ Motion API Error:", res.status);
        return;
      }

      const data = await res.json();

      if (!data?.result) return;

      callback({
        result: data.result,
        score: data.score ?? 0,
      });
    } catch (err) {
      console.log("❌ Motion AI error:", err);
    }
  }, SEND_INTERVAL);
};

export const stopMotionAI = () => {
  isRunning = false;

  if (subscription) {
    subscription.remove();
    subscription = null;
  }

  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }

  buffer = [];
};