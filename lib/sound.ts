"use client";

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export async function unlockAudio() {
  if (unlocked) return;
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") await ctx.resume();
    unlocked = true;
  } catch {}
}

function playTone(freq: number, start: number, duration: number, gain: number) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(gain, ctx.currentTime + start);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

export function playDoorbell() {
  if (!unlocked) return;
  try {
    // Doorbell: two-tone "ding-dong" pattern
    playTone(880, 0, 0.15, 0.4);    // Ding (A5)
    playTone(660, 0.12, 0.3, 0.4);  // Dong (E5)
  } catch {}
}

export function playNewOrder() {
  if (!unlocked) return;
  try {
    // Three ascending tones for new order
    playTone(523, 0, 0.1, 0.35);     // C5
    playTone(659, 0.1, 0.1, 0.35);   // E5
    playTone(784, 0.2, 0.15, 0.35);  // G5
  } catch {}
}
