// ============================================================
// BLACK PEARL: LAST STAND — Complete Game Engine v2.0
// NEW: Enemy cannons, power-ups, mini-map, combo, sinking anim,
//      enemy arrows, pause, upgrade shop
// ============================================================

import { playCannonFire, playHit, playExplosion, playWaveCleared, playBossWarning, playVictory, resumeAudio } from './audio.js';

// ============================================================
// CONSTANTS
// ============================================================
const ARENA_W = 3000;
const ARENA_H = 3000;
const PLAYER_RADIUS = 22;
const FIRE_COOLDOWN = 350; // ms between shots

const WEAPONS = {
  round: { name: 'ROUND SHOT', emoji: '💥', desc: 'Heavy hull damage', damage: 30, speed: 10, range: 500, spread: 0, count: 1, color: '#444' },
  chain: { name: 'CHAIN SHOT', emoji: '⛓', desc: 'Cripple sails',     damage: 10, speed: 8,  range: 400, spread: 0, count: 1, color: '#888', slow: true },
  grape: { name: 'GRAPESHOT',  emoji: '🍇', desc: 'Area damage',       damage: 15, speed: 9,  range: 250, spread: 0.35, count: 7, color: '#555' },
};

const ENEMY_DEFS = {
  sloop:  { name: 'Royal Sloop',  hp: 50,   speed: 2.2, damage: 5,  score: 100,  radius: 14, color: '#3a7bd5', attackRange: 60,  attackCooldown: 1500, cannonRange: 0   },
  manwar: { name: 'Man-of-War',   hp: 150,  speed: 1.0, damage: 15, score: 300,  radius: 24, color: '#c0392b', attackRange: 80,  attackCooldown: 2000, cannonRange: 320, cannonCooldown: 2500, cannonDamage: 12 },
  ketch:  { name: 'Bomb Ketch',   hp: 80,   speed: 1.6, damage: 25, score: 250,  radius: 18, color: '#e67e22', attackRange: 50,  attackCooldown: 0,    cannonRange: 0,   explodes: true },
  boss:   { name: "Admiral's Flagship", hp: 1000, speed: 0.6, damage: 20, score: 2000, radius: 40, color: '#8e44ad', attackRange: 100, attackCooldown: 1200, cannonRange: 420, cannonCooldown: 1800, cannonDamage: 20, isBoss: true },
};

const WAVES = [
  { enemies: [{ type: 'sloop', count: 3 }] },
  { enemies: [{ type: 'sloop', count: 3 }, { type: 'manwar', count: 2 }] },
  { enemies: [{ type: 'sloop', count: 3 }, { type: 'manwar', count: 2 }, { type: 'ketch', count: 2 }] },
  { enemies: [{ type: 'sloop', count: 3 }, { type: 'manwar', count: 3 }, { type: 'ketch', count: 3 }] },
  { enemies: [{ type: 'boss', count: 1 }], isBossWave: true },
];

// Upgrade definitions
const UPGRADES = [
  { id: 'damage',  name: '💥 Cannon Power',   desc: '+25% damage',       baseCost: 400,  maxLevel: 4 },
  { id: 'speed',   name: '💨 Hull Speed',      desc: '+20% move speed',   baseCost: 300,  maxLevel: 4 },
  { id: 'hp',      name: '🛡 Hull Armor',      desc: '+25 max HP',        baseCost: 350,  maxLevel: 4 },
  { id: 'reload',  name: '⚡ Reload Speed',    desc: '-15% fire cooldown', baseCost: 450,  maxLevel: 4 },
  { id: 'repair',  name: '🔧 Repair Kit',      desc: '+15 HP per repair', baseCost: 500,  maxLevel: 3 },
];

// ============================================================
// GAME STATE
// ============================================================
let canvas, ctx;
let gameState = 'menu'; // menu, playing, waveClear, bossWarning, gameOver, victory, paused, shop
let prevGameState = 'playing';
let screenShake = 0;
let screenShakeDecay = 0.88;

let camera = { x: 0, y: 0 };
let mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
let keys = {};
let lastFireTime = 0;

let player = null;
let enemies = [];
let projectiles = [];       // player projectiles
let enemyProjectiles = [];  // enemy projectiles
let particles = [];
let floatingTexts = [];
let powerups = [];

let currentWave = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('blackPearlHighScore') || '0');
let selectedWeapon = 'round';
let repairCooldown = 0;
const REPAIR_BASE_COOLDOWN = 10000;
const REPAIR_BASE_AMOUNT = 25;

// Upgrades state
let upgradeLevels = { damage: 0, speed: 0, hp: 0, reload: 0, repair: 0 };

// Combo system
let comboCount = 0;
let comboTimer = 0;
const COMBO_WINDOW = 3000; // ms to chain kills

let waveTransitionTimer = 0;
let bossWarningTimer = 0;
let lastTime = 0;

let pendingSpawns = 0;
let oceanOffset = 0;
let onStateChange = null;

// ============================================================
// UPGRADE HELPERS
// ============================================================
function getDamageMultiplier()  { return 1 + upgradeLevels.damage * 0.25; }
function getSpeedMultiplier()   { return 1 + upgradeLevels.speed  * 0.20; }
function getFireCooldown()      { return FIRE_COOLDOWN * (1 - upgradeLevels.reload * 0.15); }
function getRepairCooldown()    { return REPAIR_BASE_COOLDOWN; }
function getRepairAmount()      { return REPAIR_BASE_AMOUNT + upgradeLevels.repair * 15; }
function getMaxHp()             { return 100 + upgradeLevels.hp * 25; }
function getUpgradeCost(upg)    {
  const def = UPGRADES.find(u => u.id === upg);
  return def ? Math.floor(def.baseCost * Math.pow(1.6, upgradeLevels[upg])) : 9999;
}

// ============================================================
// HELPERS
// ============================================================
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleBetween(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function shakeScreen(amount) { screenShake = Math.max(screenShake, amount); }

// ============================================================
// PARTICLE SYSTEM
// ============================================================
function spawnParticle(x, y, vx, vy, life, size, color, type = 'circle') {
  if (particles.length > 600) return; // cap for performance
  particles.push({ x, y, vx, vy, life, maxLife: life, size, color, type });
}

function spawnExplosion(x, y, count = 15) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1, 5);
    const colors = ['#ff6600', '#ff3300', '#ffaa00', '#ff0000', '#ffcc00'];
    spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
      rand(20, 55), rand(2, 6), colors[Math.floor(Math.random() * colors.length)]);
  }
}

function spawnSplinters(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1, 4);
    spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
      rand(15, 35), rand(1, 3), '#8B4513', 'rect');
  }
}

function spawnMuzzleFlash(x, y, angle) {
  for (let i = 0; i < 8; i++) {
    const a = angle + rand(-0.4, 0.4);
    const speed = rand(2, 6);
    spawnParticle(x, y, Math.cos(a) * speed, Math.sin(a) * speed, rand(5, 12), rand(2, 5), '#ffdd44');
  }
  for (let i = 0; i < 5; i++) {
    const a = angle + rand(-0.6, 0.6);
    const speed = rand(0.5, 2);
    spawnParticle(x, y, Math.cos(a) * speed, Math.sin(a) * speed, rand(20, 40), rand(4, 10), 'rgba(150,150,150,0.5)');
  }
}

function spawnFloatingText(x, y, text, color = '#ffcc00') {
  floatingTexts.push({ x, y, text, color, life: 70, maxLife: 70 });
}

// ============================================================
// POWERUPS
// ============================================================
const POWERUP_TYPES = {
  health:   { emoji: '❤️',  color: '#ff4466', effect: () => { if (player) { player.hp = Math.min(getMaxHp(), player.hp + 30); spawnFloatingText(player.x, player.y - 40, '+30 HP', '#ff88aa'); } } },
  ammo:     { emoji: '💣',  color: '#ffaa00', effect: () => { score += 200; spawnFloatingText(player?.x || 0, (player?.y || 0) - 40, '+200 GOLD', '#ffaa00'); } },
  speed:    { emoji: '⚡',  color: '#44ddff', effect: () => { if (player) { player.speedBoost = 5000; spawnFloatingText(player.x, player.y - 40, 'SPEED BOOST!', '#44ddff'); } } },
};

function spawnPowerup(x, y) {
  const types = Object.keys(POWERUP_TYPES);
  // Health more likely if player is hurt
  let type;
  if (player && player.hp < 40 && Math.random() < 0.5) {
    type = 'health';
  } else {
    type = types[Math.floor(Math.random() * types.length)];
  }
  powerups.push({ x, y, type, life: 600, maxLife: 600, bob: rand(0, Math.PI * 2) });
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.life--;
    p.bob += 0.05;
    if (p.life <= 0) { powerups.splice(i, 1); continue; }

    // Check player pickup
    if (player && dist(p, player) < 28) {
      POWERUP_TYPES[p.type].effect();
      spawnExplosion(p.x, p.y, 8);
      powerups.splice(i, 1);
    }
  }
}

// ============================================================
// PLAYER
// ============================================================
function createPlayer() {
  const maxHp = getMaxHp();
  return {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    angle: -Math.PI / 2,
    speed: 0,
    hp: maxHp,
    maxHp,
    radius: PLAYER_RADIUS,
    cannonAngle: 0,
    speedBoost: 0,
  };
}

function updatePlayer(dt) {
  if (!player) return;

  const accel = 0.15;
  const baseMaxSpeed = 3.5;
  const maxSpeed = baseMaxSpeed * getSpeedMultiplier() * (player.speedBoost > 0 ? 1.6 : 1);
  const turnSpeed = 0.04;
  const friction = 0.96;

  if (keys['a'] || keys['arrowleft'])  player.angle -= turnSpeed;
  if (keys['d'] || keys['arrowright']) player.angle += turnSpeed;

  if (keys['w'] || keys['arrowup']) {
    player.speed = Math.min(player.speed + accel, maxSpeed);
  } else if (keys['s'] || keys['arrowdown']) {
    player.speed = Math.max(player.speed - accel, -maxSpeed * 0.5);
  } else {
    player.speed *= friction;
  }

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;
  player.x = clamp(player.x, 50, ARENA_W - 50);
  player.y = clamp(player.y, 50, ARENA_H - 50);

  player.cannonAngle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);

  // Speed boost decay
  if (player.speedBoost > 0) {
    player.speedBoost -= dt;
    if (Math.random() < 0.3) {
      spawnParticle(player.x + rand(-15, 15), player.y + rand(-15, 15), rand(-0.5, 0.5), rand(-0.5, 0.5), rand(10, 20), rand(2, 5), '#44ddff');
    }
  }

  // Wake
  if (Math.abs(player.speed) > 0.5) {
    const bx = player.x - Math.cos(player.angle) * 20;
    const by = player.y - Math.sin(player.angle) * 20;
    spawnParticle(bx + rand(-3, 3), by + rand(-3, 3), -Math.cos(player.angle) * 0.3, -Math.sin(player.angle) * 0.3, rand(20, 40), rand(2, 4), 'rgba(255,255,255,0.3)');
  }

  // Damage FX
  if (player.hp <= 60 && player.hp > 30) {
    if (Math.random() < 0.1)
      spawnParticle(player.x + rand(-10, 10), player.y + rand(-10, 10), rand(-0.3, 0.3), rand(-1, -0.3), rand(20, 40), rand(3, 7), 'rgba(100,100,100,0.6)');
  } else if (player.hp <= 30 && player.hp > 15) {
    if (Math.random() < 0.2)
      spawnParticle(player.x + rand(-10, 10), player.y + rand(-10, 10), rand(-0.3, 0.3), rand(-1, -0.3), rand(20, 40), rand(3, 7), 'rgba(80,80,80,0.7)');
    if (Math.random() < 0.12)
      spawnParticle(player.x + rand(-8, 8), player.y + rand(-8, 8), rand(-0.2, 0.2), rand(-0.8, -0.2), rand(15, 25), rand(2, 5), '#ff4400');
  } else if (player.hp <= 15 && player.hp > 0) {
    if (Math.random() < 0.35)
      spawnParticle(player.x + rand(-12, 12), player.y + rand(-12, 12), rand(-0.5, 0.5), rand(-1.2, -0.3), rand(15, 35), rand(4, 9), 'rgba(60,60,60,0.8)');
    if (Math.random() < 0.28)
      spawnParticle(player.x + rand(-10, 10), player.y + rand(-10, 10), rand(-0.3, 0.3), rand(-1, -0.2), rand(10, 20), rand(3, 6), '#ff2200');
  }

  if (repairCooldown > 0) repairCooldown = Math.max(0, repairCooldown - dt);
}

function damagePlayer(amount) {
  if (!player) return;
  player.hp = Math.max(0, player.hp - amount);
  shakeScreen(6);
  if (player.hp <= 0) {
    spawnExplosion(player.x, player.y, 50);
    playExplosion();
    gameState = 'gameOver';
    saveHighScore();
    if (onStateChange) onStateChange();
  }
}

function repairPlayer() {
  if (!player || repairCooldown > 0 || player.hp >= getMaxHp()) return;
  const amount = getRepairAmount();
  player.hp = Math.min(getMaxHp(), player.hp + amount);
  repairCooldown = getRepairCooldown();
  spawnFloatingText(player.x, player.y - 30, `+${amount} HP`, '#44ff44');
  for (let i = 0; i < 12; i++)
    spawnParticle(player.x + rand(-15, 15), player.y + rand(-15, 15), rand(-0.5, 0.5), rand(-1, 0), rand(20, 35), rand(2, 4), '#44ff44');
}

// ============================================================
// PLAYER PROJECTILES
// ============================================================
function fireWeapon() {
  if (!player || gameState !== 'playing') return;
  const now = performance.now();
  if (now - lastFireTime < getFireCooldown()) return;
  lastFireTime = now;

  const weapon = WEAPONS[selectedWeapon];
  const tip = {
    x: player.x + Math.cos(player.cannonAngle) * 28,
    y: player.y + Math.sin(player.cannonAngle) * 28,
  };

  resumeAudio();
  playCannonFire();
  spawnMuzzleFlash(tip.x, tip.y, player.cannonAngle);
  shakeScreen(3);

  for (let i = 0; i < weapon.count; i++) {
    const a = weapon.spread > 0 ? player.cannonAngle + rand(-weapon.spread, weapon.spread) : player.cannonAngle;
    projectiles.push({
      x: tip.x, y: tip.y,
      vx: Math.cos(a) * weapon.speed,
      vy: Math.sin(a) * weapon.speed,
      damage: Math.floor(weapon.damage * getDamageMultiplier()),
      range: weapon.range,
      traveled: 0,
      type: selectedWeapon,
      slow: weapon.slow || false,
    });
  }
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx; p.y += p.vy;
    p.traveled += Math.hypot(p.vx, p.vy);

    if (Math.random() < 0.4)
      spawnParticle(p.x, p.y, 0, 0, rand(5, 10), rand(1, 2), 'rgba(200,200,200,0.3)');

    if (p.traveled > p.range || p.x < 0 || p.x > ARENA_W || p.y < 0 || p.y > ARENA_H) {
      projectiles.splice(i, 1); continue;
    }

    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.sinking) continue;
      if (dist(p, e) < e.radius + 5) {
        e.hp -= p.damage;
        if (p.slow) e.slowed = 4000;
        spawnSplinters(p.x, p.y);
        playHit();
        spawnFloatingText(e.x, e.y - e.radius - 10, `-${p.damage}`, '#ff4444');
        projectiles.splice(i, 1);
        if (e.hp <= 0) destroyEnemy(j);
        break;
      }
    }
  }
}

// ============================================================
// ENEMY PROJECTILES
// ============================================================
function fireEnemyCannon(enemy) {
  if (!player) return;
  const angle = angleBetween(enemy, player);
  const spread = rand(-0.15, 0.15);
  const def = ENEMY_DEFS[enemy.type];
  enemyProjectiles.push({
    x: enemy.x + Math.cos(angle) * enemy.radius,
    y: enemy.y + Math.sin(angle) * enemy.radius,
    vx: Math.cos(angle + spread) * 6,
    vy: Math.sin(angle + spread) * 6,
    damage: def.cannonDamage || 10,
    range: def.cannonRange || 300,
    traveled: 0,
  });
  spawnMuzzleFlash(
    enemy.x + Math.cos(angle) * enemy.radius,
    enemy.y + Math.sin(angle) * enemy.radius,
    angle
  );
}

function updateEnemyProjectiles() {
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    p.x += p.vx; p.y += p.vy;
    p.traveled += Math.hypot(p.vx, p.vy);

    // Red trail
    if (Math.random() < 0.4)
      spawnParticle(p.x, p.y, 0, 0, rand(4, 8), rand(1, 2), 'rgba(255,100,100,0.4)');

    if (p.traveled > p.range || p.x < 0 || p.x > ARENA_W || p.y < 0 || p.y > ARENA_H) {
      enemyProjectiles.splice(i, 1); continue;
    }

    // Hit player
    if (player && dist(p, player) < player.radius + 4) {
      damagePlayer(p.damage);
      spawnSplinters(p.x, p.y, 5);
      playHit();
      enemyProjectiles.splice(i, 1);
    }
  }
}

// ============================================================
// ENEMIES
// ============================================================
function spawnEnemy(type) {
  const def = ENEMY_DEFS[type];
  let x, y;
  const side = Math.floor(Math.random() * 4);
  switch (side) {
    case 0: x = rand(100, ARENA_W - 100); y = -60; break;
    case 1: x = ARENA_W + 60; y = rand(100, ARENA_H - 100); break;
    case 2: x = rand(100, ARENA_W - 100); y = ARENA_H + 60; break;
    default: x = -60; y = rand(100, ARENA_H - 100); break;
  }

  const hpMult  = 1 + currentWave * 0.1;
  const spdMult = 1 + currentWave * 0.05;

  enemies.push({
    x, y,
    angle: 0,
    hp: Math.floor(def.hp * hpMult),
    maxHp: Math.floor(def.hp * hpMult),
    speed: def.speed * spdMult,
    damage: def.damage,
    score: def.score,
    radius: def.radius,
    color: def.color,
    type,
    name: def.name,
    attackRange: def.attackRange,
    attackCooldown: def.attackCooldown,
    lastAttack: 0,
    cannonRange: def.cannonRange || 0,
    cannonCooldown: def.cannonCooldown || 0,
    cannonDamage: def.cannonDamage || 0,
    lastCannon: 0,
    explodes: def.explodes || false,
    isBoss: def.isBoss || false,
    slowed: 0,
    wobble: rand(0, Math.PI * 2),
    sinking: false,
    sinkTimer: 0,
    sinkAngle: rand(-1, 1) * 0.5,
    alpha: 1,
  });
}

function destroyEnemy(index) {
  const e = enemies[index];

  // Combo system
  comboCount++;
  comboTimer = COMBO_WINDOW;
  const comboBonus = Math.min(comboCount, 10);
  const pts = e.score * comboBonus;
  score += pts;

  const label = comboCount >= 3 ? `${comboCount}x COMBO! +${pts}` : `+${pts}`;
  const color = comboCount >= 5 ? '#ff44ff' : comboCount >= 3 ? '#ff8800' : '#ffcc00';
  spawnFloatingText(e.x, e.y - 30, label, color);

  if (comboCount >= 3) shakeScreen(4);

  // Sinking animation instead of instant removal
  e.sinking = true;
  e.sinkTimer = 90; // frames
  e.hp = 0;

  spawnExplosion(e.x, e.y, e.isBoss ? 50 : 18);
  playExplosion();

  if (e.explodes) {
    shakeScreen(12);
    if (player && dist(e, player) < 130) damagePlayer(e.damage);
    spawnExplosion(e.x, e.y, 30);
  }
  if (e.isBoss) shakeScreen(22);

  // Random powerup drop
  if (!e.isBoss && Math.random() < 0.35) {
    spawnPowerup(e.x + rand(-20, 20), e.y + rand(-20, 20));
  }
  if (e.isBoss) {
    // Boss always drops health + ammo
    spawnPowerup(e.x - 30, e.y);
    spawnPowerup(e.x + 30, e.y);
  }

  if (onStateChange) onStateChange();
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // Sinking animation
    if (e.sinking) {
      e.sinkTimer--;
      e.alpha = e.sinkTimer / 90;
      e.radius *= 0.998;
      if (e.sinkTimer <= 0) {
        enemies.splice(i, 1);
        if (onStateChange) onStateChange();
      }
      continue;
    }

    if (!player) continue;

    const angle = angleBetween(e, player);
    e.angle = angle;
    let speed = e.speed * (e.slowed > 0 ? 0.5 : 1);
    if (e.slowed > 0) {
      e.slowed -= dt;
      if (Math.random() < 0.1)
        spawnParticle(e.x + rand(-10, 10), e.y + rand(-10, 10), 0, -0.5, 15, 3, '#4488ff');
    }

    e.wobble += 0.02;
    const wa = angle + Math.sin(e.wobble) * 0.3;
    e.x += Math.cos(wa) * speed;
    e.y += Math.sin(wa) * speed;

    const d = dist(e, player);

    // Bomb ketch explosion trigger
    if (e.explodes && d < e.attackRange) {
      destroyEnemy(i); continue;
    }

    // Melee attack
    if (!e.explodes && d < e.attackRange && e.attackCooldown > 0) {
      const now = performance.now();
      if (now - e.lastAttack > e.attackCooldown) {
        e.lastAttack = now;
        damagePlayer(e.damage);
        spawnSplinters(player.x + rand(-10, 10), player.y + rand(-10, 10), 5);
      }
    }

    // Cannon attack
    if (e.cannonRange > 0 && d < e.cannonRange) {
      const now = performance.now();
      if (now - e.lastCannon > e.cannonCooldown) {
        e.lastCannon = now;
        fireEnemyCannon(e);
        playCannonFire();
      }
    }

    // Contact push
    if (d < e.radius + player.radius) {
      const pa = angleBetween(e, player);
      player.x += Math.cos(pa) * 2;
      player.y += Math.sin(pa) * 2;
      e.x -= Math.cos(pa) * 1;
      e.y -= Math.sin(pa) * 1;
    }
  }
}

// ============================================================
// WAVE SYSTEM
// ============================================================
function startWave(waveIndex) {
  currentWave = waveIndex;
  enemyProjectiles = [];

  if (waveIndex >= WAVES.length) {
    gameState = 'victory';
    saveHighScore();
    playVictory();
    if (onStateChange) onStateChange();
    return;
  }

  const wave = WAVES[waveIndex];
  if (wave.isBossWave) {
    gameState = 'bossWarning';
    bossWarningTimer = 3200;
    playBossWarning();
    shakeScreen(8);
    if (onStateChange) onStateChange();
    return;
  }

  gameState = 'playing';
  const waveDef = wave.enemies;
  let idx = 0;
  waveDef.forEach(({ type, count }) => {
    for (let i = 0; i < count; i++) {
      pendingSpawns++;
      setTimeout(() => { spawnEnemy(type); pendingSpawns--; }, idx * 550);
      idx++;
    }
  });
  if (onStateChange) onStateChange();
}

function spawnBossWave() {
  gameState = 'playing';
  enemyProjectiles = [];
  WAVES[currentWave].enemies.forEach(({ type, count }) => {
    for (let i = 0; i < count; i++) spawnEnemy(type);
  });
  if (onStateChange) onStateChange();
}

function checkWaveComplete() {
  if (gameState !== 'playing') return;
  const aliveNonSinking = enemies.filter(e => !e.sinking).length;
  if (aliveNonSinking === 0 && pendingSpawns <= 0) {
    score += 500;
    spawnFloatingText(player?.x || ARENA_W/2, (player?.y || ARENA_H/2) - 50, 'WAVE CLEARED! +500', '#ffdd00');
    playWaveCleared();

    // Show shop between waves (not after boss wave)
    if (currentWave < WAVES.length - 1) {
      gameState = 'shop';
    } else {
      gameState = 'waveClear';
      waveTransitionTimer = 2500;
    }
    if (onStateChange) onStateChange();
  }
}

// ============================================================
// COMBO SYSTEM
// ============================================================
function updateCombo(dt) {
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboCount = 0;
    }
  }
}

// ============================================================
// DRAWING — OCEAN
// ============================================================
function drawOcean() {
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  oceanOffset += 0.004;
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  const sx = Math.floor(camera.x / 80) * 80;
  const sy = Math.floor(camera.y / 80) * 80;
  for (let x = sx - 80; x < camera.x + canvas.width + 80; x += 80) {
    for (let y = sy - 80; y < camera.y + canvas.height + 80; y += 80) {
      const wave = Math.sin(x * 0.01 + oceanOffset * 20) * Math.cos(y * 0.012 + oceanOffset * 15);
      ctx.fillStyle = `rgba(50,100,180,${(wave + 1) * 0.025})`;
      ctx.fillRect(x, y, 80, 80);
    }
  }

  // Arena boundary
  ctx.strokeStyle = 'rgba(255,200,100,0.15)';
  ctx.lineWidth = 3;
  ctx.setLineDash([15, 15]);
  ctx.strokeRect(0, 0, ARENA_W, ARENA_H);
  ctx.setLineDash([]);

  ctx.restore();
}

// ============================================================
// DRAWING — ENEMY SHIP
// ============================================================
function drawEnemyShip(e) {
  const { x, y, angle, radius, color, hp, maxHp, isBoss, slowed, sinking, alpha, sinkAngle, sinkTimer } = e;
  ctx.save();
  ctx.globalAlpha = alpha ?? 1;

  if (sinking) {
    ctx.translate(x, y);
    ctx.rotate(angle + sinkAngle * (1 - sinkTimer / 90));
    ctx.scale(1, 0.3 + (sinkTimer / 90) * 0.7);
  } else {
    ctx.translate(x, y);
    ctx.rotate(angle);
  }

  const len = radius * 2.2;
  const w   = radius * 1.2;

  ctx.beginPath();
  ctx.moveTo(len * 0.6, 0);
  ctx.lineTo(len * 0.1, -w * 0.5);
  ctx.lineTo(-len * 0.4, -w * 0.45);
  ctx.lineTo(-len * 0.5, 0);
  ctx.lineTo(-len * 0.4, w * 0.45);
  ctx.lineTo(len * 0.1, w * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(len * 0.4, 0);
  ctx.lineTo(-len * 0.3, 0);
  ctx.stroke();

  ctx.fillStyle = 'rgba(180,140,80,0.8)';
  ctx.fillRect(-2, -w * 0.3, 4, w * 0.6);

  if (!isBoss) {
    ctx.beginPath();
    ctx.moveTo(-2, -w * 0.3);
    ctx.lineTo(len * 0.15, 0);
    ctx.lineTo(-2, w * 0.3);
    ctx.closePath();
    ctx.fillStyle = slowed ? 'rgba(100,100,220,0.4)' : 'rgba(220,210,190,0.3)';
    ctx.fill();
  } else {
    // Boss flag + extra detail
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(-5, -w * 0.55);
    ctx.lineTo(-3, -w * 0.75);
    ctx.lineTo(0, -w * 0.55);
    ctx.lineTo(3, -w * 0.75);
    ctx.lineTo(5, -w * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(100,0,100,0.35)';
    ctx.fillRect(-len * 0.2, -w * 0.4, len * 0.3, w * 0.8);
  }

  ctx.restore();

  // HP bar (not while sinking)
  if (!sinking && !isBoss) {
    const barW = radius * 2;
    const pct = hp / maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - barW / 2, y - radius - 14, barW, 5);
    ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff3333';
    ctx.fillRect(x - barW / 2, y - radius - 14, barW * pct, 5);
  }

  // Name label
  if (!sinking && !isBoss) {
    ctx.fillStyle = 'rgba(200,200,200,0.6)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(e.name, x, y - radius - 18);
  }

  // Slowed ring
  if (slowed > 0 && !sinking) {
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ============================================================
// DRAWING — PLAYER SHIP
// ============================================================
function drawPlayer() {
  if (!player) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  const len = player.radius * 2.5;
  const w   = player.radius * 1.4;

  // Hull
  ctx.beginPath();
  ctx.moveTo(len * 0.6, 0);
  ctx.lineTo(len * 0.15, -w * 0.55);
  ctx.lineTo(-len * 0.35, -w * 0.5);
  ctx.lineTo(-len * 0.45, -w * 0.2);
  ctx.lineTo(-len * 0.45, w * 0.2);
  ctx.lineTo(-len * 0.35, w * 0.5);
  ctx.lineTo(len * 0.15, w * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#3a2518';
  ctx.fill();
  ctx.strokeStyle = '#1a0a04';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Deck
  ctx.beginPath();
  ctx.moveTo(len * 0.4, 0);
  ctx.lineTo(len * 0.1, -w * 0.35);
  ctx.lineTo(-len * 0.25, -w * 0.3);
  ctx.lineTo(-len * 0.3, 0);
  ctx.lineTo(-len * 0.25, w * 0.3);
  ctx.lineTo(len * 0.1, w * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#5a3a1a';
  ctx.fill();

  // Mast
  ctx.fillStyle = '#8a6530';
  ctx.fillRect(-3, -w * 0.4, 6, w * 0.8);

  // Black sails
  ctx.fillStyle = 'rgba(20,20,20,0.7)';
  ctx.beginPath();
  ctx.moveTo(-3, -w * 0.4);
  ctx.quadraticCurveTo(len * 0.2, -w * 0.2, -3, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.quadraticCurveTo(len * 0.2, w * 0.2, -3, w * 0.4);
  ctx.fill();

  // Skull on flag
  ctx.fillStyle = '#111';
  ctx.fillRect(-5, -w * 0.48, 10, 9);
  ctx.fillStyle = '#ddd';
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('☠', 0, -w * 0.41);

  ctx.restore();

  // Cannon barrel
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.cannonAngle);
  ctx.fillStyle = '#222';
  ctx.fillRect(0, -3, 30, 6);
  ctx.fillStyle = '#444';
  ctx.fillRect(26, -4, 6, 8);
  ctx.restore();

  // Speed boost glow
  if (player.speedBoost > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#44ddff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// DRAWING — PROJECTILES
// ============================================================
function drawProjectile(p, isEnemy = false) {
  ctx.save();
  if (isEnemy) {
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (p.type === 'chain') {
    const a = Math.atan2(p.vy, p.vx);
    const px = Math.cos(a + Math.PI / 2) * 4;
    const py = Math.sin(a + Math.PI / 2) * 4;
    ctx.fillStyle = '#666';
    ctx.beginPath(); ctx.arc(p.x + px, p.y + py, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x - px, p.y - py, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x + px, p.y + py); ctx.lineTo(p.x - px, p.y - py); ctx.stroke();
  } else if (p.type === 'grape') {
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ============================================================
// DRAWING — POWER-UPS
// ============================================================
function drawPowerups() {
  for (const p of powerups) {
    const def = POWERUP_TYPES[p.type];
    const bobY = Math.sin(p.bob) * 4;
    const alpha = p.life < 120 ? p.life / 120 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y + bobY);

    // Glow
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, 0, 0);

    ctx.restore();
  }
}

// ============================================================
// DRAWING — PARTICLES & FLOATING TEXT
// ============================================================
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    if (p.type === 'rect') {
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 0.3);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    const alpha = ft.life / ft.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y - (ft.maxLife - ft.life) * 0.5);
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// DRAWING — MINI-MAP
// ============================================================
function drawMinimap() {
  if (!player) return;

  const mx = canvas.width - 170;
  const my = canvas.height - 170;
  const mw = 150;
  const mh = 150;
  const scaleX = mw / ARENA_W;
  const scaleY = mh / ARENA_H;

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(5, 15, 30, 0.82)';
  ctx.strokeStyle = 'rgba(212,160,23,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 6);
  ctx.fill();
  ctx.stroke();

  // Arena boundary on minimap
  ctx.strokeStyle = 'rgba(255,200,100,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);

  // Enemies
  for (const e of enemies) {
    if (e.sinking) continue;
    const ex = mx + e.x * scaleX;
    const ey = my + e.y * scaleY;
    ctx.fillStyle = e.isBoss ? '#ff00ff' : e.color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(ex, ey, e.isBoss ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Powerups
  for (const p of powerups) {
    const px = mx + p.x * scaleX;
    const py = my + p.y * scaleY;
    ctx.fillStyle = '#44ff44';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Player dot (bright gold, pulsing)
  const px = mx + player.x * scaleX;
  const py = my + player.y * scaleY;
  const pulse = (Math.sin(performance.now() * 0.006) + 1) * 1.5 + 2;
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(px, py, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Label
  ctx.fillStyle = 'rgba(212,160,23,0.6)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('RADAR', mx + 4, my + 10);

  ctx.restore();
}

// ============================================================
// DRAWING — OFF-SCREEN ENEMY ARROWS
// ============================================================
function drawEnemyArrows() {
  if (!player) return;

  const margin = 50;
  const arrowSize = 10;

  for (const e of enemies) {
    if (e.sinking) continue;
    const ex = e.x - camera.x;
    const ey = e.y - camera.y;

    if (ex >= margin && ex <= canvas.width - margin && ey >= margin && ey <= canvas.height - margin) continue;

    // Clamp to screen edge
    let ax = clamp(ex, margin, canvas.width - margin);
    let ay = clamp(ey, margin, canvas.height - margin);

    const angle = Math.atan2(ey - canvas.height / 2, ex - canvas.width / 2);
    const pulse = (Math.sin(performance.now() * 0.005) + 1) * 0.3 + 0.5;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = e.isBoss ? '#ff00ff' : e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.6);
    ctx.lineTo(-arrowSize * 0.3, 0);
    ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// DRAWING — COMBO METER
// ============================================================
function drawCombo() {
  if (comboCount < 2) return;
  const cx = canvas.width / 2;
  const cy = 95;

  ctx.save();
  const scale = 1 + Math.sin(performance.now() * 0.015) * 0.05;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  ctx.fillStyle = comboCount >= 5 ? '#ff44ff' : comboCount >= 3 ? '#ff8800' : '#ffcc00';
  ctx.font = `bold ${20 + Math.min(comboCount, 8)}px monospace`;
  ctx.textAlign = 'center';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 10;
  ctx.fillText(`${comboCount}x COMBO`, cx, cy);

  // Timer bar
  const barW = 120;
  const pct = comboTimer / COMBO_WINDOW;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(cx - barW / 2, cy + 6, barW, 4);
  ctx.fillStyle = comboCount >= 5 ? '#ff44ff' : '#ffaa00';
  ctx.fillRect(cx - barW / 2, cy + 6, barW * pct, 4);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ============================================================
// DRAWING — BOSS BAR
// ============================================================
function drawBossBar() {
  const boss = enemies.find(e => e.isBoss && !e.sinking);
  if (!boss) return;

  const barW = canvas.width * 0.5;
  const barH = 20;
  const bx = (canvas.width - barW) / 2;
  const by = 58;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(bx - 10, by - 28, barW + 20, barH + 40);

  ctx.fillStyle = '#ff3333';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText("⚔ ADMIRAL'S FLAGSHIP ⚔", canvas.width / 2, by - 8);

  ctx.fillStyle = '#333';
  ctx.fillRect(bx, by, barW, barH);
  const pct = boss.hp / boss.maxHp;
  const barColor = pct > 0.5 ? '#cc3333' : pct > 0.25 ? '#ff6600' : '#ff0000';
  ctx.fillStyle = barColor;
  ctx.fillRect(bx, by, barW * pct, barH);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, barW, barH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${boss.hp} / ${boss.maxHp}`, canvas.width / 2, by + 14);
}

// ============================================================
// MAIN LOOP
// ============================================================
function update(dt) {
  if (gameState === 'playing') {
    updatePlayer(dt);
    updateProjectiles();
    updateEnemyProjectiles();
    updateEnemies(dt);
    updatePowerups(dt);
    updateCombo(dt);
    checkWaveComplete();
  } else if (gameState === 'waveClear') {
    updatePlayer(dt);
    waveTransitionTimer -= dt;
    if (waveTransitionTimer <= 0) startWave(currentWave + 1);
  } else if (gameState === 'bossWarning') {
    updatePlayer(dt);
    bossWarningTimer -= dt;
    if (bossWarningTimer <= 0) spawnBossWave();
  }

  // Particles always update
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.97; p.vy *= 0.97;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].life--;
    if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
  }

  screenShake *= screenShakeDecay;
  if (screenShake < 0.4) screenShake = 0;

  if (player) {
    camera.x = lerp(camera.x, player.x - canvas.width / 2, 0.08);
    camera.y = lerp(camera.y, player.y - canvas.height / 2, 0.08);
  }
}

function draw() {
  if (!ctx) return;
  ctx.save();
  if (screenShake > 0) ctx.translate(rand(-screenShake, screenShake), rand(-screenShake, screenShake));

  drawOcean();

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Enemies (sinking ones behind live ones)
  for (const e of enemies) if (e.sinking) drawEnemyShip(e);
  for (const e of enemies) if (!e.sinking) drawEnemyShip(e);

  drawPlayer();

  for (const p of enemyProjectiles) drawProjectile(p, true);
  for (const p of projectiles) drawProjectile(p, false);
  drawPowerups();
  drawParticles();
  drawFloatingTexts();

  ctx.restore();

  // --- Screen-space overlays ---
  drawBossBar();
  drawEnemyArrows();
  drawCombo();
  drawMinimap();

  if (gameState === 'bossWarning') {
    const flash = Math.sin(performance.now() * 0.01) * 0.12 + 0.12;
    ctx.fillStyle = `rgba(255,0,0,${flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ WARNING ⚠️', canvas.width / 2, canvas.height / 2 - 22);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 30px monospace';
    ctx.fillText("ADMIRAL'S FLAGSHIP APPROACHING", canvas.width / 2, canvas.height / 2 + 18);
  }

  if (gameState === 'waveClear') {
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE CLEARED!', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = 'bold 24px monospace';
    ctx.fillText('+500', canvas.width / 2, canvas.height / 2 + 30);
  }

  // Pause overlay is handled by React — no canvas drawing needed here

  ctx.restore();
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min(timestamp - lastTime, 50);
  lastTime = timestamp;

  mouse.worldX = mouse.x + camera.x;
  mouse.worldY = mouse.y + camera.y;

  if (gameState !== 'paused' && gameState !== 'shop' && gameState !== 'menu' &&
      gameState !== 'gameOver' && gameState !== 'victory') {
    update(dt);
  }
  draw();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// INPUT
// ============================================================
function setupInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === 'Escape') {
      if (gameState === 'playing') { prevGameState = gameState; gameState = 'paused'; }
      else if (gameState === 'paused') { gameState = prevGameState; }
      if (onStateChange) onStateChange();
      return;
    }

    if (gameState === 'playing') {
      if (e.key === '1') selectedWeapon = 'round';
      if (e.key === '2') selectedWeapon = 'chain';
      if (e.key === '3') selectedWeapon = 'grape';
      if (e.key.toLowerCase() === 'r') repairPlayer();
    }

    if (onStateChange) onStateChange();
  });

  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { resumeAudio(); fireWeapon(); }
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ============================================================
// PUBLIC API
// ============================================================
export function initGame(canvasEl, stateCallback) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  onStateChange = stateCallback;

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  setupInput();
  requestAnimationFrame(gameLoop);
}

export function startNewGame() {
  resumeAudio();
  player = createPlayer();
  enemies = []; projectiles = []; enemyProjectiles = [];
  particles = []; floatingTexts = []; powerups = [];
  score = 0; currentWave = 0; selectedWeapon = 'round';
  repairCooldown = 0; pendingSpawns = 0; screenShake = 0;
  comboCount = 0; comboTimer = 0;
  lastTime = 0;
  gameState = 'playing';
  camera = { x: player.x - (canvas?.width || 800) / 2, y: player.y - (canvas?.height || 600) / 2 };
  startWave(0);
  if (onStateChange) onStateChange();
}

export function setWeapon(type) {
  if ((gameState === 'playing' || gameState === 'paused') && WEAPONS[type]) {
    selectedWeapon = type;
    if (onStateChange) onStateChange();
  }
}

export function triggerRepair() {
  repairPlayer();
  if (onStateChange) onStateChange();
}

export function togglePause() {
  if (gameState === 'playing') { prevGameState = gameState; gameState = 'paused'; }
  else if (gameState === 'paused') { gameState = prevGameState; }
  if (onStateChange) onStateChange();
}

export function goHome() {
  // Clear game state and return to main menu
  gameState = 'menu';
  player = null;
  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  particles = [];
  floatingTexts = [];
  powerups = [];
  pendingSpawns = 0;
  screenShake = 0;
  comboCount = 0;
  comboTimer = 0;
  upgradeLevels = { damage: 0, speed: 0, hp: 0, reload: 0, repair: 0 };
  if (onStateChange) onStateChange();
}

export function buyUpgrade(id) {
  const def = UPGRADES.find(u => u.id === id);
  if (!def) return false;
  if (upgradeLevels[id] >= def.maxLevel) return false;
  const cost = getUpgradeCost(id);
  if (score < cost) return false;

  score -= cost;
  upgradeLevels[id]++;

  // Apply HP upgrade immediately
  if (id === 'hp' && player) {
    const extra = 25;
    player.maxHp += extra;
    player.hp = Math.min(player.maxHp, player.hp + extra);
  }

  spawnFloatingText(player?.x || ARENA_W / 2, (player?.y || ARENA_H / 2) - 40, `UPGRADED!`, '#44ffaa');
  if (onStateChange) onStateChange();
  return true;
}

export function continueFromShop() {
  gameState = 'playing';
  startWave(currentWave + 1);
  if (onStateChange) onStateChange();
}

export function getUpgradeInfo() {
  return UPGRADES.map(u => ({
    ...u,
    level: upgradeLevels[u.id],
    cost: getUpgradeCost(u.id),
    maxed: upgradeLevels[u.id] >= u.maxLevel,
  }));
}

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('blackPearlHighScore', highScore.toString());
  }
}

export function getGameState() {
  return {
    state: gameState,
    score,
    highScore,
    wave: currentWave + 1,
    playerHp: player ? player.hp : 0,
    playerMaxHp: player ? player.maxHp : 100,
    selectedWeapon,
    repairCooldown,
    repairMaxCooldown: getRepairCooldown(),
    enemies: enemies.filter(e => !e.sinking).length,
    comboCount,
    upgradeLevels: { ...upgradeLevels },
  };
}
