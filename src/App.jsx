import { useState, useEffect, useRef, useCallback } from 'react';
import {
  initGame, startNewGame, getGameState, setWeapon, triggerRepair,
  togglePause, buyUpgrade, continueFromShop, getUpgradeInfo, goHome
} from './game/engine.js';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const [uiState, setUiState] = useState(null);
  const [shopInfo, setShopInfo] = useState([]);
  const initialized = useRef(false);

  const refreshUI = useCallback(() => {
    const gs = getGameState();
    setUiState({ ...gs });
    if (gs.state === 'shop') setShopInfo(getUpgradeInfo());
  }, []);

  useEffect(() => {
    if (canvasRef.current && !initialized.current) {
      initialized.current = true;
      initGame(canvasRef.current, refreshUI);
      const interval = setInterval(refreshUI, 80);
      return () => clearInterval(interval);
    }
  }, [refreshUI]);

  const state = uiState?.state || 'menu';
  const gs    = uiState || {};

  const handlePlay  = () => { startNewGame();  refreshUI(); };
  const handlePause = () => { togglePause();   refreshUI(); };
  const handleHome  = () => { goHome();        refreshUI(); };
  const handleContinue = () => { continueFromShop(); refreshUI(); };
  const handleBuyUpgrade = (id) => { buyUpgrade(id); setShopInfo(getUpgradeInfo()); refreshUI(); };

  const hullPct   = gs.playerMaxHp ? Math.round((gs.playerHp / gs.playerMaxHp) * 100) : 100;
  const hullColor = hullPct > 60 ? '#3aaa3a' : hullPct > 30 ? '#cc9900' : '#cc2222';
  const repairReady = (gs.repairCooldown || 0) <= 0;
  const repairSecs  = repairReady ? null : (gs.repairCooldown / 1000).toFixed(1);
  const isPlaying   = ['playing', 'waveClear', 'bossWarning'].includes(state);

  return (
    <div id="game-container">
      <canvas ref={canvasRef} />

      {/* ===================== MAIN MENU ===================== */}
      {state === 'menu' && (
        <div className="menu-screen">
          {/* Corner anchors */}
          <div className="menu-corner tl">⚓</div>
          <div className="menu-corner tr">⚓</div>
          <div className="menu-corner bl">⚓</div>
          <div className="menu-corner br">⚓</div>

          {/* Top rope */}
          <div className="menu-rope-top" />

          {/* Title block */}
          <div className="menu-title-wrap">
            <div className="menu-skull">☠</div>
            <div className="menu-title">BLACK PEARL</div>
            <div className="menu-subtitle">LAST STAND</div>
            <div className="menu-tagline">"The King's Armada is at your door. Hold the line."</div>
          </div>

          {/* Bottom rope */}
          <div className="menu-rope-bottom" />

          {/* Buttons */}
          <button className="menu-btn" onClick={handlePlay}>⚔ PLAY</button>

          {gs.highScore > 0 && (
            <div className="menu-highscore">
              ✦ Best Score: {gs.highScore.toLocaleString()} ✦
            </div>
          )}

          {/* Controls */}
          <div className="controls-panel">
            <div className="controls-grid">
              <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Sail the Pearl</div>
              <div><kbd>Mouse</kbd> Aim cannon</div>
              <div><kbd>Click</kbd> Fire!</div>
              <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Weapons</div>
              <div><kbd>R</kbd> Repair hull</div>
              <div><kbd>ESC</kbd> Pause</div>
              <div>Collect ❤️ 💣 ⚡ crates</div>
              <div>5 Waves to Victory!</div>
            </div>
          </div>

          <div className="skull-deco">☠</div>
        </div>
      )}

      {/* ===================== HUD (in-game) ===================== */}
      {isPlaying && (
        <div className="hud">
          {/* Top panels */}
          <div className="hud-top">
            <div className="hud-panel">
              <div className="ship-name">🏴‍☠️ BLACK PEARL</div>
            </div>
            <div className="hud-panel">
              <div className="wave-number">
                {gs.wave === 5 ? '⚔ BOSS WAVE ⚔' : `WAVE ${String(gs.wave || 1).padStart(2, '0')}`}
              </div>
            </div>
            <div className="hud-panel">
              <div className="score-display">⚓ {(gs.score || 0).toLocaleString()}</div>
              <div className="high-score">Best: {(gs.highScore || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Hull bar */}
          <div className="hull-bar-container">
            <div className="hull-label">HULL INTEGRITY</div>
            <div className="hull-bar">
              <div className="hull-bar-fill" style={{ width: `${hullPct}%`, backgroundColor: hullColor }} />
              <div className="hull-bar-text">{hullPct}%</div>
            </div>
            {hullPct <= 15 && <div className="critical-warning">⚠ ABANDON SHIP ⚠</div>}
          </div>

          {/* Pause button */}
          <button className="pause-btn" onClick={handlePause} title="ESC">⏸</button>

          {/* Weapons bar */}
          <div className="hud-bottom">
            <div className="weapons-bar">
              {[
                { key: 'round', label: '💥 ROUND', desc: 'Hull damage',  num: '[1]' },
                { key: 'chain', label: '⛓ CHAIN',  desc: 'Cripple sails', num: '[2]' },
                { key: 'grape', label: '🍇 GRAPE',  desc: 'Area damage',  num: '[3]' },
              ].map((w, i) => (
                <>
                  {i > 0 && <div key={`sep-${i}`} className="weapon-sep" />}
                  <div
                    key={w.key}
                    className={`weapon-slot ${gs.selectedWeapon === w.key ? 'active' : ''}`}
                    onClick={() => setWeapon(w.key)}
                  >
                    <div className="weapon-key">{w.num}</div>
                    <div className="weapon-name">{w.label}</div>
                    <div className="weapon-desc">{w.desc}</div>
                  </div>
                </>
              ))}
              <div className="weapon-sep" />
              <div className={`repair-btn ${repairReady ? 'ready' : 'cooldown'}`} onClick={triggerRepair}>
                <div className="repair-key">[R]</div>
                <div className="repair-label">🔧 REPAIR</div>
                <div className="repair-status">{repairReady ? 'READY' : `${repairSecs}s`}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAUSE ===================== */}
      {state === 'paused' && (
        <div className="overlay-screen">
          <div className="overlay-card">
            <div className="overlay-icon">⏸</div>
            <div className="overlay-title">PAUSED</div>
            <div className="overlay-divider" />
            <div className="overlay-stats" style={{ marginBottom: '20px' }}>
              Wave {gs.wave} &nbsp;•&nbsp; Score {(gs.score || 0).toLocaleString()}
            </div>
            <button className="menu-btn" onClick={handlePause}>▶ RESUME</button>
            <button className="menu-btn" style={{ fontSize: '17px', padding: '10px 28px' }} onClick={handlePlay}>
              ↩ RESTART
            </button>
            <button className="menu-btn" style={{ fontSize: '17px', padding: '10px 28px' }} onClick={handleHome}>
              🏠 HOME
            </button>
          </div>
        </div>
      )}

      {/* ===================== UPGRADE SHOP ===================== */}
      {state === 'shop' && (
        <div className="overlay-screen shop-screen">
          <div className="shop-header">
            <div className="shop-title">⚓ PORT OF UPGRADES ⚓</div>
            <div className="shop-subtitle">Wave {gs.wave - 1} cleared! Refit your ship before the next assault.</div>
            <div className="shop-gold">💰 Gold in Chest: {(gs.score || 0).toLocaleString()}</div>
          </div>

          <div className="shop-grid">
            {shopInfo.map(upg => (
              <div key={upg.id} className={`shop-item ${upg.maxed ? 'maxed' : ''}`}>
                <div className="shop-item-name">{upg.name}</div>
                <div className="shop-item-desc">{upg.desc}</div>
                <div className="shop-item-levels">
                  {Array.from({ length: upg.maxLevel }).map((_, i) => (
                    <div key={i} className={`level-pip ${i < upg.level ? 'filled' : ''}`} />
                  ))}
                </div>
                {upg.maxed ? (
                  <div className="shop-item-maxed">✦ MASTERED ✦</div>
                ) : (
                  <button
                    className={`shop-btn ${(gs.score || 0) >= upg.cost ? 'affordable' : 'expensive'}`}
                    onClick={() => handleBuyUpgrade(upg.id)}
                    disabled={(gs.score || 0) < upg.cost}
                  >
                    {upg.cost.toLocaleString()} gold
                  </button>
                )}
              </div>
            ))}
          </div>

          <button className="menu-btn" style={{ marginTop: '20px' }} onClick={handleContinue}>
            ⚔ SET SAIL — NEXT WAVE
          </button>
        </div>
      )}

      {/* ===================== GAME OVER ===================== */}
      {state === 'gameOver' && (
        <div className="overlay-screen">
          <div className="overlay-card">
            <div className="overlay-icon">☠️</div>
            <div className="overlay-title defeat">SHIP SUNK</div>
            <div className="overlay-divider" />
            <div className="overlay-stats">Wave: <span>{gs.wave || 1}</span></div>
            <div className="overlay-stats">Score: <span>{(gs.score || 0).toLocaleString()}</span></div>
            <div className="overlay-best">Best Score: <span>{(gs.highScore || 0).toLocaleString()}</span></div>
            <button className="menu-btn" onClick={handlePlay}>⚔ SAIL AGAIN</button>
            <button className="menu-btn" style={{ fontSize: '17px', padding: '10px 28px' }} onClick={handleHome}>
              🏠 HOME
            </button>
          </div>
        </div>
      )}

      {/* ===================== VICTORY ===================== */}
      {state === 'victory' && (
        <div className="overlay-screen">
          <div className="overlay-card">
            <div className="overlay-icon">🏆</div>
            <div className="overlay-title">VICTORY!</div>
            <div className="overlay-divider" />
            <div className="overlay-stats" style={{ fontSize: '14px', color: '#8899bb', marginBottom: '8px' }}>
              The Black Pearl has prevailed. The seas are yours.
            </div>
            <div className="overlay-stats">Waves Cleared: <span>5</span></div>
            <div className="overlay-stats">Final Score: <span>{(gs.score || 0).toLocaleString()}</span></div>
            <div className="overlay-best">Best Score: <span>{(gs.highScore || 0).toLocaleString()}</span></div>
            <button className="menu-btn" onClick={handlePlay}>⚔ SAIL AGAIN</button>
            <button className="menu-btn" style={{ fontSize: '17px', padding: '10px 28px' }} onClick={handleHome}>
              🏠 HOME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
