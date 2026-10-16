// ============================================================
// FIRST MATE AI — Gemini-powered Pirate Companion
// Uses Google Gemini API for dynamic commentary.
// Falls back to built-in quotes when no API key is set.
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

// Pre-written fallback quotes (used when no API key)
const FALLBACKS = {
  waveStart: [
    "Steady on, Captain! Enemy sails on the horizon!",
    "To arms! The King's fleet approaches — show 'em no mercy!",
    "Here they come! Man the cannons and hold the Pearl!",
    "Enemies spotted, Captain! Load the grapeshot — it's gonna get messy!",
    "The armada approaches! Let no ship pass — fire at will!",
  ],
  waveCleared: [
    "Well done, Captain! The sea runs red with their colours!",
    "Haha! That'll teach the Crown to mess with the Black Pearl!",
    "Another wave repelled! The crew cheers your name, Captain!",
    "Brilliant maneuvers! Head to port — you've earned an upgrade!",
    "They flee like rats! Resupply and prepare — more are coming!",
  ],
  lowHealth: [
    "She's takin' on water, Captain! Hit R to repair NOW!",
    "The hull is cracking! Repair kit — quick, before she goes under!",
    "Captain, we're losing her! Repair or we're all drowned men!",
    "Structural damage critical! Use the repair — don't be proud!",
  ],
  bossAppears: [
    "By Davy Jones! That be the Admiral's Flagship! Circle wide and hit her cannons!",
    "The Admiral himself! A thousand guns, Captain — but only one weak point: keep moving!",
    "Hell's bells, it's the Flagship! Stay out of cannon range and use chain shot to slow her!",
    "The Admiral brings his best ship! Grapeshot at close range — it's our only hope!",
  ],
  comboStreak: [
    "FIVE IN A ROW! The crew is going absolutely wild!",
    "Incredible shooting, Captain! They can't touch you!",
    "Look at that aim! Not even the devil could match you today!",
    "Combo after combo! The Pearl's cannons sing your glory!",
  ],
  victory: [
    "VICTORY! The Admiral retreats! The Black Pearl reigns supreme on these seas!",
    "We did it, Captain! The Crown's armada is broken! The seas are OURS!",
    "Hahaha! Tell the King himself — he'll never take the Black Pearl!",
  ],
  gameOver: [
    "She's gone down, Captain... but the legend of the Black Pearl lives forever.",
    "The sea claims her... but not your spirit. Sail again, Captain.",
    "Every great captain loses a ship. What matters is whether you get back up.",
    "Davy Jones has her now... but you? You'll sail again. I know it.",
  ],
  repairUsed: [
    "Smart move! She's patched up for now — keep fighting!",
    "Good thinking, Captain! Now get back in the fight!",
  ],
  powerup: [
    "Grab it! That crate could turn the tide!",
    "Supplies from the fallen! Never waste a crate, Captain!",
  ],
};

// Get a random fallback for an event
function getFallback(event) {
  const arr = FALLBACKS[event] || FALLBACKS.waveStart;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Gemini client (lazily initialized)
let genAI = null;
let model = null;
let lastCallTime = 0;
const MIN_CALL_INTERVAL = 8000; // Don't spam the API

function initGemini() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return false;
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    return true;
  } catch {
    return false;
  }
}

const geminiReady = initGemini();

// Callback registered by the game engine
let onMessage = null;

export function setFirstMateCallback(cb) {
  onMessage = cb;
}

/**
 * Get a First Mate comment for the given game event.
 * event: 'waveStart' | 'waveCleared' | 'lowHealth' | 'bossAppears' |
 *        'comboStreak' | 'victory' | 'gameOver' | 'repairUsed' | 'powerup'
 * context: { wave, score, hp, maxHp, combo, enemyCount }
 */
export async function getFirstMateComment(event, context = {}) {
  // Always deliver via callback
  const deliver = (msg) => {
    if (onMessage) onMessage(msg);
  };

  const now = performance.now();
  if (!geminiReady || now - lastCallTime < MIN_CALL_INTERVAL) {
    deliver(getFallback(event));
    return;
  }

  lastCallTime = now;

  const { wave = 1, score = 0, hp = 100, maxHp = 100, combo = 0, enemyCount = 0 } = context;
  const hpPct = Math.round((hp / maxHp) * 100);

  const prompt = `You are the First Mate of the pirate ship Black Pearl in a naval battle game. 
Speak in a dramatic pirate voice — short (1-2 sentences max), exciting, and in-character.
Game event: "${event}"
Context: Wave ${wave}, Score ${score.toLocaleString()}, Hull integrity ${hpPct}%, Combo ${combo}x, ${enemyCount} enemies remaining.
Give a ${event === 'gameOver' ? 'somber but encouraging' : 'energetic'} pirate reaction to this event. Keep it under 20 words.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    deliver(text || getFallback(event));
  } catch {
    deliver(getFallback(event));
  }
}
