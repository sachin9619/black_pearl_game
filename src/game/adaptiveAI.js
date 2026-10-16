// ============================================================
// ADAPTIVE AI — Performance Tracker & Difficulty Scaler
// Silently watches player performance and adjusts enemy stats
// ============================================================

let shotsFired = 0;
let shotsHit = 0;
let damageTaken = 0;
let killsThisWave = 0;
let waveStartTime = 0;
let adaptiveMultiplier = 1.0; // 0.7 – 1.3
let lastAdaptTime = 0;
let adapted = false; // flag: was an adaptation made this wave?

const MIN_MULT = 0.70;
const MAX_MULT = 1.30;
const SAMPLE_INTERVAL = 5000; // 5 seconds

export function resetAdaptive() {
  shotsFired = 0;
  shotsHit = 0;
  damageTaken = 0;
  killsThisWave = 0;
  waveStartTime = performance.now();
  lastAdaptTime = performance.now();
  adapted = false;
}

export function trackShot() {
  shotsFired++;
}

export function trackHit() {
  shotsHit++;
}

export function trackKill() {
  killsThisWave++;
}

export function trackDamageTaken(amount) {
  damageTaken += amount;
}

// Called every frame from the game loop
// Returns true if multiplier changed (so HUD can flash indicator)
export function updateAdaptive(now) {
  if (now - lastAdaptTime < SAMPLE_INTERVAL) return false;
  lastAdaptTime = now;

  const accuracy = shotsFired > 0 ? shotsHit / shotsFired : 0.5;
  const elapsed = (now - waveStartTime) / 60000; // minutes
  const killRate = elapsed > 0 ? killsThisWave / elapsed : 0;

  let adjustment = 0;

  // High accuracy + fast kills = player dominating → harder
  if (accuracy > 0.6 && killRate > 8) adjustment += 0.06;
  else if (accuracy > 0.5 && killRate > 5) adjustment += 0.04;

  // Heavy damage taken = player struggling → easier
  if (damageTaken > 60) adjustment -= 0.07;
  else if (damageTaken > 35) adjustment -= 0.04;

  // Very low accuracy = struggling → easier
  if (accuracy < 0.15 && shotsFired > 10) adjustment -= 0.05;

  if (adjustment === 0) return false;

  const prev = adaptiveMultiplier;
  adaptiveMultiplier = Math.max(MIN_MULT, Math.min(MAX_MULT, adaptiveMultiplier + adjustment));

  // Reset damage counter each interval so it doesn't accumulate forever
  damageTaken = 0;

  adapted = adaptiveMultiplier !== prev;
  return adapted;
}

export function getAdaptiveMultipliers() {
  return {
    speedMult:  adaptiveMultiplier,
    hpMult:     adaptiveMultiplier,
    damageMult: adaptiveMultiplier * 0.8, // slightly softer damage scaling
    adapted,
    level: adaptiveMultiplier > 1.15 ? 'hard' : adaptiveMultiplier < 0.85 ? 'easy' : 'normal',
  };
}

export function getAdaptivePercent() {
  return Math.round((adaptiveMultiplier - 1) * 100);
}
