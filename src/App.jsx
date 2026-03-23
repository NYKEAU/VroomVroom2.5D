import { useState, useEffect, useRef } from 'react';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import AuthContainer from './components/AuthContainer';
import { auth, saveScore } from './firebase';
import './App.css';

function App() {
  const [showMenu, setShowMenu] = useState(true);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000));
  const [gameInstance, setGameInstance] = useState(null);
  const canvasRef = useRef(null);
  // Référence pour limiter la fréquence des mises à jour de score
  const lastScoreUpdateRef = useRef(0);
  const scoreDebounceTimeRef = useRef(5000); // 5 secondes entre les mises à jour

  useEffect(() => {
    // Nettoyer les ressources lors du démontage du composant
    return () => {
      if (gameInstance) {
        gameInstance.dispose();
      }
    };
  }, [gameInstance]);

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

          // Définir la fonction de callback pour enregistrer le score
          game.onScoreUpdated = async (newScore) => {
            // Vérification si l'utilisateur est connecté
            if (!auth.currentUser) return;

            // Calculer le temps écoulé depuis la dernière mise à jour
            const now = Date.now();
            const timeElapsed = now - lastScoreUpdateRef.current;

            // Ne mettre à jour que si suffisamment de temps s'est écoulé ou si c'est la première fois
            if (
              timeElapsed < scoreDebounceTimeRef.current &&
              lastScoreUpdateRef.current !== 0
            ) {
              return;
            }

            // Mettre à jour le timestamp de la dernière mise à jour
            lastScoreUpdateRef.current = now;

            try {
              const updated = await saveScore(
                auth.currentUser.uid,
                newScore,
                seed
              );
              if (updated) {
                console.log('Nouveau record personnel enregistré!');
              }
            } catch (error) {
              // Enregistrer l'erreur mais ne pas la répéter en console
              if (!window.scoreErrorLogged) {
                console.error(
                  "Erreur lors de l'enregistrement du score:",
                  error
                );
                window.scoreErrorLogged = true;
              }
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
    // Réinitialiser les refs de score
    lastScoreUpdateRef.current = 0;
    window.scoreErrorLogged = false;
  };

  const returnToMenu = () => {
    if (gameInstance) {
      gameInstance.dispose();
      setGameInstance(null);
      window.gameInstance = null;
    }
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
          <div className="menu-section">
            <div className="menu-container">
              <h1 className="game-title">Vroom Vroom 2.5D</h1>

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

              <div className="instructions">
                <div className="instructions-block">
                  <p><span className="key">Z</span> ou <span className="key">↑</span> pour avancer</p>
                  <p><span className="key">S</span> ou <span className="key">↓</span> pour reculer</p>
                  <p><span className="key">Q</span> / <span className="key">A</span> ou <span className="key">←</span> pour tourner à gauche</p>
                  <p><span className="key">D</span> ou <span className="key">→</span> pour tourner à droite</p>
                  <p>Contrôlez votre véhicule en l'air avec <span className="key">↑</span> et <span className="key">↓</span></p>
                </div>
              </div>

              <AuthContainer />
            </div>
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
    </>
  );
}

export default App;
