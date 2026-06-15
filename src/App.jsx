import { useState, useEffect, useRef } from 'react';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import AuthContainer from './components/AuthContainer';
import { auth, generateSessionToken, submitScore } from './firebase';
import { audioManager } from './audio/AudioManager';
import './App.css';

function App() {
  const [showMenu, setShowMenu] = useState(true);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [volumes, setVolumes] = useState({
    master: audioManager.masterVolume,
    music: audioManager.musicVolume,
    sfx: audioManager.sfxVolume,
  });
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000));
  const [gameInstance, setGameInstance] = useState(null);
  const canvasRef = useRef(null);
  const sessionTokenRef = useRef(null);

  useEffect(() => {
    // Nettoyer les ressources lors du démontage du composant
    return () => {
      if (gameInstance) {
        gameInstance.dispose();
      }
    };
  }, [gameInstance]);

  useEffect(() => {
    const initAudio = () => {
      audioManager.init();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio, { once: false });
    document.addEventListener('touchstart', initAudio, { once: false });

    const handleMouseOver = (e) => {
      const btn = e.target.closest('button');
      if (btn) audioManager.playHover();
    };
    const handleClick = (e) => {
      const btn = e.target.closest('button');
      if (btn) audioManager.playClick();
    };
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick);

    audioManager.onChange = () => {
      setVolumes({
        master: audioManager.masterVolume,
        music: audioManager.musicVolume,
        sfx: audioManager.sfxVolume,
      });
    };

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('click', handleClick);
      audioManager.onChange = null;
    };
  }, []);

  // Effet pour initialiser le jeu une fois que le canvas est dans le DOM
  useEffect(() => {
    if (!showMenu && canvasRef.current && !gameInstance) {
      // Petite temporisation pour s'assurer que le canvas est complètement rendu
      const timer = setTimeout(() => {
        try {
          // Passer la seed fournie par l'utilisateur
          const game = new Game({
            canvasId: 'myThreeJsCanvas',
            seed: seed, // Utiliser la seed spécifiée dans l'interface
          });

          // Générer un token de session signé côté serveur (si connecté)
          if (auth.currentUser) {
            generateSessionToken()
              .then((token) => {
                sessionTokenRef.current = token;
              })
              .catch((err) => {
                console.warn('Impossible de créer la session de jeu:', err);
                sessionTokenRef.current = null;
              });
          }

          // Soumettre le score via le token de session à la fin de partie
          game.onGameOver = async (finalScore, finalSeed) => {
            if (!auth.currentUser) return;
            const token = sessionTokenRef.current;
            if (!token) {
              console.warn('Token de session manquant, score non enregistré.');
              return;
            }
            sessionTokenRef.current = null; // consommer le token (one-shot)
            try {
              const updated = await submitScore(token, finalScore, finalSeed);
              if (updated) {
                console.log('Nouveau record personnel enregistré!');
              }
            } catch (error) {
              console.error("Erreur lors de l'enregistrement du score:", error);
            }
          };

          game.onPause = () => {
            const nowRunning = game.togglePause();
            setShowPauseMenu(!nowRunning);
          };
          game.onReturnToMenu = () => {
            window.gameInstance = null;
            setGameInstance(null);
            setShowMenu(true);
            setShowPauseMenu(false);
          };
          setGameInstance(game);
          window.gameInstance = game; // For access from other components
        } catch (error) {
          console.error("Erreur lors de l'initialisation du jeu:", error);
          // Retour au menu en cas d'erreur
          setShowMenu(true);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showMenu, seed, gameInstance]);

  const startGame = () => {
    setShowMenu(false);
    setShowPauseMenu(false);
    // L'initialisation du jeu se fait dans le useEffect ci-dessus
  };

  const returnToMenu = () => {
    if (gameInstance) {
      gameInstance.dispose();
      setGameInstance(null);
      window.gameInstance = null;
    }
    sessionTokenRef.current = null;
    setShowMenu(true);
    setShowPauseMenu(false);
  };

  const togglePauseMenu = () => {
    if (gameInstance) {
      const isPaused = gameInstance.togglePause();
      setShowPauseMenu(!isPaused); // Si le jeu est en pause, montrer le menu de pause
    }
  };

  const resumeGame = () => {
    if (gameInstance && gameInstance.isPaused()) {
      gameInstance.togglePause(); // Reprendre le jeu
    }
    setShowPauseMenu(false);
    setShowQuitConfirm(false);
  };

  const reloadPage = () => {
    window.location.reload();
  };

  return (
    <>
      {showMenu ? (
        <div className="main-layout">

          {/* ── Décors d'atelier ─────────────────────────────── */}

          {/* 1. Étagère en bois — haut gauche */}
          <svg aria-hidden="true" style={{position:'absolute',top:35,left:25,width:500,height:260,pointerEvents:'none',zIndex:5}} viewBox="0 0 220 115">
            {/* Brackets */}
            <polygon points="15,108 15,70 52,108" fill="#5C3A1E" stroke="#111" strokeWidth="2.5"/>
            <circle cx="15" cy="70" r="5" fill="#aaa" stroke="#111" strokeWidth="1.5"/>
            <line x1="12" y1="70" x2="18" y2="70" stroke="#555" strokeWidth="1.5"/>
            <line x1="15" y1="67" x2="15" y2="73" stroke="#555" strokeWidth="1.5"/>
            <polygon points="168,108 168,70 205,108" fill="#5C3A1E" stroke="#111" strokeWidth="2.5"/>
            <circle cx="168" cy="70" r="5" fill="#aaa" stroke="#111" strokeWidth="1.5"/>
            <line x1="165" y1="70" x2="171" y2="70" stroke="#555" strokeWidth="1.5"/>
            <line x1="168" y1="67" x2="168" y2="73" stroke="#555" strokeWidth="1.5"/>
            {/* Plank */}
            <rect x="0" y="66" width="220" height="16" rx="3" fill="#8B5E3C" stroke="#111" strokeWidth="2.5"/>
            <line x1="0" y1="73" x2="220" y2="73" stroke="#7a4f2e" strokeWidth="1.5"/>
            <line x1="0" y1="79" x2="220" y2="79" stroke="#6a3f1e" strokeWidth="1"/>
            {/* Red toolbox on shelf */}
            <rect x="14" y="28" width="50" height="38" rx="3" fill="#ff2d20" stroke="#111" strokeWidth="2.5"/>
            <rect x="14" y="28" width="50" height="13" rx="3" fill="#cc1a10" stroke="#111" strokeWidth="2.5"/>
            <rect x="30" y="24" width="18" height="8" rx="4" fill="#cc1a10" stroke="#111" strokeWidth="2"/>
            {/* Yellow box */}
            <rect x="74" y="36" width="44" height="30" rx="3" fill="#ffd600" stroke="#111" strokeWidth="2.5"/>
            <rect x="74" y="49" width="44" height="6" fill="#b89900"/>
            {/* Blue spray can */}
            <rect x="130" y="42" width="28" height="24" rx="5" fill="#3a7bd5" stroke="#111" strokeWidth="2.5"/>
            <ellipse cx="144" cy="42" rx="14" ry="5" fill="#4a8be5" stroke="#111" strokeWidth="2"/>
            <rect x="139" y="36" width="10" height="9" rx="2" fill="#3a7bd5" stroke="#111" strokeWidth="1.5"/>
          </svg>

          {/* 2. Roue RC accrochée — haut droite */}
          <svg aria-hidden="true" style={{position:'absolute',top:16,right:55,width:250,height:325,pointerEvents:'none',zIndex:5}} viewBox="0 0 100 130">
            {/* Hook plate on wall */}
            <rect x="43" y="0" width="14" height="20" rx="3" fill="#888" stroke="#111" strokeWidth="2"/>
            <line x1="46" y1="7" x2="54" y2="7" stroke="#555" strokeWidth="1.5"/>
            <line x1="50" y1="4" x2="50" y2="10" stroke="#555" strokeWidth="1.5"/>
            {/* Hook arm */}
            <path d="M 50 18 C 50 36 72 36 72 65" fill="none" stroke="#777" strokeWidth="9" strokeLinecap="round"/>
            <path d="M 50 18 C 50 36 72 36 72 65" fill="none" stroke="#555" strokeWidth="5" strokeLinecap="round"/>
            {/* Tire outer */}
            <circle cx="50" cy="93" r="35" fill="#1a1a1a" stroke="#111" strokeWidth="3"/>
            {/* Tread */}
            <circle cx="50" cy="93" r="31" fill="none" stroke="#2a2a2a" strokeWidth="6" strokeDasharray="8 5"/>
            {/* Rim */}
            <circle cx="50" cy="93" r="22" fill="#aaa" stroke="#111" strokeWidth="2.5"/>
            {/* Spokes */}
            <line x1="50" y1="71" x2="50" y2="115" stroke="#888" strokeWidth="5" strokeLinecap="round"/>
            <line x1="28" y1="93" x2="72" y2="93" stroke="#888" strokeWidth="5" strokeLinecap="round"/>
            <line x1="34" y1="77" x2="66" y2="109" stroke="#888" strokeWidth="4" strokeLinecap="round"/>
            <line x1="66" y1="77" x2="34" y2="109" stroke="#888" strokeWidth="4" strokeLinecap="round"/>
            {/* Hub */}
            <circle cx="50" cy="93" r="9" fill="#ff2d20" stroke="#111" strokeWidth="2.5"/>
            <circle cx="50" cy="93" r="3.5" fill="#111"/>
            {/* Lug nuts */}
            <circle cx="50" cy="80" r="2.5" fill="#ccc" stroke="#111" strokeWidth="1"/>
            <circle cx="63" cy="88" r="2.5" fill="#ccc" stroke="#111" strokeWidth="1"/>
            <circle cx="59" cy="104" r="2.5" fill="#ccc" stroke="#111" strokeWidth="1"/>
            <circle cx="41" cy="104" r="2.5" fill="#ccc" stroke="#111" strokeWidth="1"/>
            <circle cx="37" cy="88" r="2.5" fill="#ccc" stroke="#111" strokeWidth="1"/>
          </svg>

          {/* 3. Câble électrique — haut, pleine largeur */}
          <svg aria-hidden="true" style={{position:'absolute',top:16,left:0,width:'100%',height:40,pointerEvents:'none',zIndex:5}} viewBox="0 0 1400 40" preserveAspectRatio="none">
            {/* Cable shadow */}
            <path d="M 0 22 Q 140 10 280 22 Q 420 34 560 22 Q 700 10 840 22 Q 980 34 1120 22 Q 1260 10 1400 22"
              fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="10" strokeLinecap="round"/>
            {/* Cable */}
            <path d="M 0 22 Q 140 10 280 22 Q 420 34 560 22 Q 700 10 840 22 Q 980 34 1120 22 Q 1260 10 1400 22"
              fill="none" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round"/>
            {/* Wall fixings */}
            <rect x="272" y="14" width="18" height="16" rx="3" fill="#888" stroke="#333" strokeWidth="1.5"/>
            <circle cx="281" cy="22" r="3.5" fill="#555"/>
            <rect x="832" y="14" width="18" height="16" rx="3" fill="#888" stroke="#333" strokeWidth="1.5"/>
            <circle cx="841" cy="22" r="3.5" fill="#555"/>
            <rect x="1112" y="14" width="18" height="16" rx="3" fill="#888" stroke="#333" strokeWidth="1.5"/>
            <circle cx="1121" cy="22" r="3.5" fill="#555"/>
          </svg>

          {/* 4. Panneau GARAGE — centré en haut */}
          <svg aria-hidden="true" style={{position:'absolute',top:20,left:'50%',transform:'translateX(-50%) rotate(-1deg)',width:300,height:116,pointerEvents:'none',zIndex:5,opacity:1,filter:'drop-shadow(0 4px 16px rgba(0,0,0,0.9))'}} viewBox="0 0 162 62">
            {/* Drop shadow */}
            <rect x="6" y="6" width="156" height="55" rx="4" fill="rgba(0,0,0,0.45)"/>
            {/* Metal panel */}
            <rect x="2" y="2" width="156" height="55" rx="4" fill="#4a3826" stroke="#111" strokeWidth="3"/>
            {/* Rust patches */}
            <circle cx="38" cy="44" r="13" fill="#6b3a1a" opacity="0.4"/>
            <circle cx="132" cy="15" r="9" fill="#7a3d1a" opacity="0.35"/>
            <ellipse cx="80" cy="50" rx="18" ry="6" fill="#6b3a1a" opacity="0.25"/>
            {/* Inner border */}
            <rect x="9" y="9" width="144" height="41" rx="2" fill="none" stroke="#2a1f10" strokeWidth="1.5"/>
            {/* Text */}
            <text x="81" y="38" textAnchor="middle" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="22" fill="#fff8e7" letterSpacing="4">GARAGE</text>
            {/* Corner bolts */}
            <circle cx="15" cy="15" r="5.5" fill="#999" stroke="#111" strokeWidth="1.5"/>
            <line x1="12" y1="15" x2="18" y2="15" stroke="#555" strokeWidth="1.5"/>
            <line x1="15" y1="12" x2="15" y2="18" stroke="#555" strokeWidth="1.5"/>
            <circle cx="147" cy="15" r="5.5" fill="#999" stroke="#111" strokeWidth="1.5"/>
            <line x1="144" y1="15" x2="150" y2="15" stroke="#555" strokeWidth="1.5"/>
            <line x1="147" y1="12" x2="147" y2="18" stroke="#555" strokeWidth="1.5"/>
            <circle cx="15" cy="46" r="5.5" fill="#999" stroke="#111" strokeWidth="1.5"/>
            <line x1="12" y1="46" x2="18" y2="46" stroke="#555" strokeWidth="1.5"/>
            <line x1="15" y1="43" x2="15" y2="49" stroke="#555" strokeWidth="1.5"/>
            <circle cx="147" cy="46" r="5.5" fill="#999" stroke="#111" strokeWidth="1.5"/>
            <line x1="144" y1="46" x2="150" y2="46" stroke="#555" strokeWidth="1.5"/>
            <line x1="147" y1="43" x2="147" y2="49" stroke="#555" strokeWidth="1.5"/>
          </svg>

          {/* 5. Tache d'huile — sol bas centre-droit */}
          <svg aria-hidden="true" style={{position:'absolute',bottom:22,right:'4%',width:420,height:120,pointerEvents:'none',zIndex:5}} viewBox="0 0 180 55">
            <ellipse cx="88" cy="40" rx="80" ry="14" fill="#0a0a0a"/>
            <ellipse cx="120" cy="44" rx="44" ry="9" fill="#080808"/>
            <ellipse cx="48" cy="46" rx="30" ry="7" fill="#080808"/>
            <path d="M 18 38 Q 55 22 95 33 Q 135 18 163 36 Q 173 44 152 50 Q 115 56 74 53 Q 33 56 14 45 Z" fill="#060606"/>
            {/* Reflet iridescent */}
            <ellipse cx="82" cy="36" rx="28" ry="6" fill="rgba(60,100,180,0.28)"/>
            <ellipse cx="100" cy="34" rx="14" ry="3" fill="rgba(140,60,200,0.22)"/>
            <ellipse cx="68" cy="38" rx="10" ry="2.5" fill="rgba(60,180,120,0.18)"/>
          </svg>

          {/* 6. Boîte à outils ouverte — bas gauche */}
          <svg aria-hidden="true" style={{position:'fixed',bottom:18,left:22,width:290,height:250,pointerEvents:'none',zIndex:15}} viewBox="0 0 130 112">
            {/* Ground shadow */}
            <ellipse cx="65" cy="109" rx="55" ry="5" fill="rgba(0,0,0,0.6)"/>
            {/* Box body */}
            <rect x="5" y="58" width="120" height="48" rx="5" fill="#cc1a10" stroke="#111" strokeWidth="3"/>
            {/* Drawer strip */}
            <rect x="10" y="70" width="110" height="10" rx="2" fill="#aa1508" stroke="#111" strokeWidth="1.5"/>
            <rect x="52" y="72" width="26" height="6" rx="3" fill="#aaa" stroke="#111" strokeWidth="1.5"/>
            {/* Open lid */}
            <path d="M 5 58 L 5 22 Q 5 17 10 17 L 120 17 Q 125 17 125 22 L 125 58" fill="#ff2d20" stroke="#111" strokeWidth="3"/>
            <path d="M 12 25 L 12 55" stroke="#9a1008" strokeWidth="2"/>
            <path d="M 118 25 L 118 55" stroke="#cc1a10" strokeWidth="2"/>
            {/* Lid handle */}
            <rect x="45" y="11" width="40" height="10" rx="5" fill="#dd1a10" stroke="#111" strokeWidth="2.5"/>
            {/* Wrench sticking out */}
            <ellipse cx="25" cy="9" rx="12" ry="8" fill="#bbb" stroke="#111" strokeWidth="2"/>
            <circle cx="18" cy="7" r="4" fill="#999" stroke="#111" strokeWidth="1.5"/>
            <circle cx="32" cy="7" r="4" fill="#999" stroke="#111" strokeWidth="1.5"/>
            <rect x="21" y="8" width="8" height="28" rx="4" fill="#bbb" stroke="#111" strokeWidth="2"/>
            {/* Screwdriver */}
            <rect x="83" y="2" width="8" height="22" rx="2" fill="#ffd600" stroke="#111" strokeWidth="2"/>
            <rect x="84" y="22" width="6" height="16" rx="1" fill="#bbb" stroke="#111" strokeWidth="1.5"/>
            <polygon points="84,38 90,38 87,45" fill="#999" stroke="#111" strokeWidth="1"/>
            {/* Pliers */}
            <rect x="56" y="5" width="6" height="20" rx="3" fill="#999" stroke="#111" strokeWidth="1.5"/>
            <rect x="64" y="7" width="6" height="20" rx="3" fill="#999" stroke="#111" strokeWidth="1.5"/>
          </svg>

          {/* ── Fin décors ────────────────────────────────────── */}

          <div className="menu-section">
            <div className="card-frame">
            {/* Vis de bezel CRT aux 4 coins */}
            {[{top:-7,left:-7},{top:-7,right:-7},{bottom:-7,left:-7},{bottom:-7,right:-7}].map((pos,i) => (
              <svg key={i} aria-hidden="true" style={{position:'absolute',width:14,height:14,pointerEvents:'none',zIndex:12,...pos}} viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="6.5" fill="#181818" stroke="#080808" strokeWidth="1"/>
                <circle cx="7" cy="7" r="5" fill="#282828"/>
                <circle cx="7" cy="7" r="3.5" fill="#1e1e1e"/>
                <circle cx="5.5" cy="5.5" r="0.8" fill="rgba(255,255,255,0.18)"/>
                <line x1="4.2" y1="7" x2="9.8" y2="7" stroke="#111" strokeWidth="1.5"/>
                <line x1="7" y1="4.2" x2="7" y2="9.8" stroke="#111" strokeWidth="1.5"/>
              </svg>
            ))}
            <div className="menu-container">
              <div className="panel-top-bar" />
              <img src="/logo.png" alt="Vroom Vroom 2.5D" className="game-logo" />

              <button className="menu-button" onClick={startGame}>
                Nouvelle partie
              </button>

              <div className="seed-container">
                <label htmlFor="seed-input">SEED: </label>
                <input
                  id="seed-input"
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                />
                <button
                  className="random-seed-button"
                  title="Générer une SEED aléatoire"
                  onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                >
                  🎲
                </button>
              </div>

              <AuthContainer />

              <button
                className="menu-button menu-button--settings"
                onClick={() => setShowAudioSettings(true)}
              >
                Paramètres audio
              </button>
            </div>

            {/* Sticker contrôles collé sur le bezel bas-gauche */}
            <svg
              aria-hidden="true"
              style={{
                position:'absolute',
                bottom:-150,
                left:14,
                width:300,
                height:190,
                pointerEvents:'none',
                zIndex:13,
                transform:'rotate(-1deg)',
                filter:'drop-shadow(2px 4px 3px rgba(0,0,0,0.5)) drop-shadow(-1px 5px 2px rgba(0,0,0,0.2))',
              }}
              viewBox="0 0 148 102"
            >
              {/* Fond autocollant — bords légèrement irréguliers */}
              <path
                d="M4,3 Q6,1 12,2 L136,2 Q142,1 145,4 L146,6 Q148,10 147,18 L147,94 Q148,99 144,101 L140,102 Q134,101 12,102 Q6,102 3,100 L2,97 Q0,92 1,18 Q0,8 4,3 Z"
                fill="#fffde7"
                fillOpacity="0.95"
              />
              {/* Coin bas-droit légèrement décollé */}
              <path
                d="M130,96 Q138,95 144,101 Q138,99 130,100 Z"
                fill="#e8e0b0"
                fillOpacity="0.85"
              />
              {/* Texte — Police Permanent Marker simulée en SVG */}
              <text fontFamily="'Permanent Marker', cursive" fontSize="10" fill="#1a1a1a">
                <tspan x="10" dy="17">Z / ↑  — Avancer</tspan>
                <tspan x="10" dy="15">S / ↓  — Reculer</tspan>
                <tspan x="10" dy="15">Q,A / ← — Rot. gauche</tspan>
                <tspan x="10" dy="15">D / →   — Rot. droite</tspan>
              </text>
            </svg>

            </div>{/* /card-frame menu */}
          </div>

          <div className="leaderboard-section">
            <Leaderboard onSelectSeed={(s) => setSeed(s)} />
          </div>
        </div>
      ) : (
        <>
          <canvas id="myThreeJsCanvas" ref={canvasRef} />

          {!showPauseMenu && (
            <button
              className="pause-btn"
              onClick={() => gameInstance && gameInstance.onPause && gameInstance.onPause()}
              title="Pause (Échap)"
            >
              ⏸
            </button>
          )}

          {showPauseMenu && (
            <div className="pause-overlay">
              <div className="pause-card">
                <h2 className="pause-title">PAUSE</h2>

                <button className="pause-btn-primary" onClick={resumeGame}>
                  Reprendre
                </button>

                <button
                  className="pause-btn-secondary"
                  style={{ background: '#3a3a5c' }}
                  onClick={() => setShowAudioSettings(true)}
                >
                  Paramètres audio
                </button>

                {!showQuitConfirm ? (
                  <button
                    className="pause-btn-secondary"
                    onClick={() => setShowQuitConfirm(true)}
                  >
                    Menu principal
                  </button>
                ) : (
                  <div className="pause-warning">
                    <p>Attention : votre score ne sera pas sauvegardé.</p>
                    <button
                      className="pause-btn-danger"
                      onClick={() => window.location.reload()}
                    >
                      Quitter quand même
                    </button>
                    <button
                      className="pause-btn-cancel"
                      onClick={() => setShowQuitConfirm(false)}
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showAudioSettings && (
        <div
          className="settings-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAudioSettings(false); }}
        >
          <div className="settings-card audio-settings-card">
            <button
              className="auth-modal-close"
              onClick={() => setShowAudioSettings(false)}
              aria-label="Fermer"
            >
              ✕
            </button>

            <h3 className="settings-title">Audio</h3>

            <div className="audio-slider-group">
              <label className="audio-slider-label">
                <span>Général</span>
                <span className="audio-slider-value">{Math.round(volumes.master * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.master}
                onChange={(e) => audioManager.setMasterVolume(parseFloat(e.target.value))}
                className="audio-slider"
              />
            </div>

            <div className="audio-slider-group">
              <label className="audio-slider-label">
                <span>Musique</span>
                <span className="audio-slider-value">{Math.round(volumes.music * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.music}
                onChange={(e) => audioManager.setMusicVolume(parseFloat(e.target.value))}
                className="audio-slider"
              />
            </div>

            <div className="audio-slider-group">
              <label className="audio-slider-label">
                <span>Effets sonores</span>
                <span className="audio-slider-value">{Math.round(volumes.sfx * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.sfx}
                onChange={(e) => audioManager.setSfxVolume(parseFloat(e.target.value))}
                className="audio-slider"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
