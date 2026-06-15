import { useState, useEffect } from 'react';
import { auth, getTopScores, getUserScore } from '../firebase';
import '../App.css';

// Avatar par défaut au cas où l'image du joueur ne charge pas
const DEFAULT_AVATAR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij48Y2lyY2xlIGN4PSIxMjgiIGN5PSIxMjgiIHI9IjEyMCIgZmlsbD0iIzg4OCIvPjxjaXJjbGUgY3g9IjEyOCIgY3k9IjExMCIgcj0iMzAiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMTI4LDE5MCw4MCwxNzBjMC00MCw0MC00MCw0OC00MCw4LDAsMTYsNSw0OCw0MEwxMjgsMTkwWiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==';

const RANK_AVATAR_CLASS = ['avatar-gold', 'avatar-silver', 'avatar-bronze'];
const RANK_SCORE_CLASS  = ['score-gold',  'score-silver',  'score-bronze'];

const Leaderboard = ({ onSelectSeed }) => {
  const [scores, setScores] = useState([]);
  const [userScore, setUserScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedSeed, setCopiedSeed] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const loadScores = async () => {
      try {
        setLoading(true);
        const topScores = await getTopScores();
        setScores(topScores || []);

        // Si l'utilisateur est connecté, on récupère son score
        if (auth && auth.currentUser) {
          try {
            const score = await getUserScore(auth.currentUser.uid);
            setUserScore(score);
          } catch (err) {
            console.warn(
              "Impossible de récupérer le score de l'utilisateur:",
              err
            );
          }
        }

        // Animation de fade-in après chargement
        setTimeout(() => setFadeIn(true), 100);
      } catch (err) {
        console.error('Erreur lors du chargement des scores:', err);
        setError('Impossible de charger les scores. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };

    loadScores();

    return () => {
      setFadeIn(false);
    };
  }, []);

  // Fonction pour copier une seed et la placer dans le champ seed
  const copySeed = (seed) => {
    if (!seed) return;

    if (onSelectSeed) onSelectSeed(seed);

    try {
      navigator.clipboard.writeText(seed.toString());
      setCopiedSeed(seed);
      setTimeout(() => setCopiedSeed(null), 1500);
    } catch (err) {
      console.error('Erreur lors de la copie de la seed:', err);
      // Fallback pour les navigateurs qui ne supportent pas clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = seed.toString();
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedSeed(seed);
        setTimeout(() => setCopiedSeed(null), 1500);
      } catch (e) {
        console.error(
          'Erreur lors de la copie de la seed (méthode alternative):',
          e
        );
        alert(`Impossible de copier. Seed: ${seed}`);
      }
      document.body.removeChild(textArea);
    }
  };

  // Formater le score avec des séparateurs de milliers
  const formatScore = (score) => {
    return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  if (loading) {
    return (
      <div className="leaderboard-loading">
        <div className="loading-spinner"></div>
        <span>Chargement du classement...</span>
      </div>
    );
  }

  if (error) {
    return <div className="leaderboard-error">{error}</div>;
  }

  const bolts = [{top:-7,left:-7},{top:-7,right:-7},{bottom:-7,left:-7},{bottom:-7,right:-7}];

  return (
    <div className="card-frame">
    {bolts.map((pos, i) => (
      <svg key={i} aria-hidden="true" style={{position:'absolute',width:14,height:14,pointerEvents:'none',zIndex:12,...pos}} viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" fill="#5a5a5a" stroke="#222" strokeWidth="1.5"/>
        <circle cx="7" cy="7" r="4" fill="url(#boltGrad)"/>
        <defs>
          <radialGradient id="boltGrad" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#888"/>
            <stop offset="100%" stopColor="#444"/>
          </radialGradient>
        </defs>
        <line x1="4" y1="7" x2="10" y2="7" stroke="#222" strokeWidth="1.5"/>
        <line x1="7" y1="4" x2="7" y2="10" stroke="#222" strokeWidth="1.5"/>
      </svg>
    ))}
    <div className={`leaderboard-container ${fadeIn ? 'fade-in' : ''}`}>
      <div className="leaderboard-rail" />
      <div className="leaderboard-body">
      <h2 className="leaderboard-title">Classement</h2>
      <div className="leaderboard-scroll">

      {userScore && (
        <div className="user-score">
          <h3>Votre meilleur score</h3>
          <div className="score-card your-score">
            <div className="user-info">
              <img
                src={userScore.photoURL || DEFAULT_AVATAR}
                alt={userScore.username || 'Utilisateur'}
                className="user-avatar"
                referrerPolicy="no-referrer"
                onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
              />
              <span className="username">
                {userScore.username || 'Utilisateur'}
              </span>
            </div>
            <div className="score-value">
              <span className="score-number">
                {formatScore(userScore.score)}
              </span>
              <span className="score-text">pts</span>
            </div>
            <button
              className="seed-btn"
              onClick={() => copySeed(userScore.seed)}
            >
              <span className="seed-label">SEED {userScore.seed}</span>
              <span className="seed-copy-indicator">
                {copiedSeed === userScore.seed ? '✅ Copié !' : '🏁 Lancer'}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="top-scores">
        <h3>Top 10</h3>
        {scores.length === 0 ? (
          <p className="no-scores">Aucun score enregistré pour le moment.</p>
        ) : (
          <div className="scores-list">
            {scores.map((score, index) => (
              <div
                key={score.userId || index}
                className={`score-card ${
                  auth &&
                  auth.currentUser &&
                  score.userId === auth.currentUser.uid
                    ? 'your-score'
                    : ''
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="user-info">
                  <img
                    src={score.photoURL || DEFAULT_AVATAR}
                    alt={score.username || 'Utilisateur'}
                    className={`user-avatar ${RANK_AVATAR_CLASS[index] ?? ''}`}
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                  />
                  <span className="username">
                    {score.username || 'Utilisateur'}
                  </span>
                </div>
                <div className="score-value">
                  <span className={`score-number ${RANK_SCORE_CLASS[index] ?? ''}`}>
                    {formatScore(score.score)}
                  </span>
                  <span className="score-text">pts</span>
                </div>
                <button
                  className="seed-btn"
                  onClick={() => copySeed(score.seed)}
                >
                  <span className="seed-label">SEED {score.seed}</span>
                  <span className="seed-copy-indicator">
                    {copiedSeed === score.seed ? '✅ Copié !' : '🏁 Lancer'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>{/* /leaderboard-scroll */}
      </div>{/* /leaderboard-body */}

      {/* Gouttière à marqueurs */}
      <svg aria-hidden="true" className="whiteboard-tray" viewBox="0 0 450 34" preserveAspectRatio="none">
        {/* Fond de gouttière — métal sombre */}
        <rect x="0" y="7" width="450" height="27" fill="#252525"/>
        {/* Bord supérieur en relief */}
        <rect x="0" y="5" width="450" height="6" fill="#3c3c3c"/>
        <rect x="0" y="5" width="450" height="1.5" fill="rgba(255,255,255,0.18)"/>
        {/* Marqueur noir */}
        <rect x="28" y="11" width="64" height="11" rx="2" fill="#1e1e1e"/>
        <rect x="28" y="11" width="9" height="11" rx="1" fill="#404040"/>
        <rect x="88" y="12" width="6" height="9" rx="2" fill="#141414"/>
        {/* Marqueur rouge */}
        <rect x="118" y="11" width="60" height="11" rx="2" fill="#c01818"/>
        <rect x="118" y="11" width="9" height="11" rx="1" fill="#e02020"/>
        <rect x="174" y="12" width="6" height="9" rx="2" fill="#9a1010"/>
        {/* Marqueur bleu */}
        <rect x="200" y="11" width="56" height="11" rx="2" fill="#1840b8"/>
        <rect x="200" y="11" width="9" height="11" rx="1" fill="#2050cc"/>
        <rect x="252" y="12" width="6" height="9" rx="2" fill="#102ea0"/>
        {/* Effaceur */}
        <rect x="338" y="9" width="76" height="15" rx="2" fill="#dedad2"/>
        <rect x="338" y="9" width="76" height="3" rx="1" fill="#c8c4bc"/>
        <rect x="338" y="9" width="6" height="15" rx="1" fill="#b0ada8"/>
        {/* Ombre portée sous le bord */}
        <rect x="0" y="7" width="450" height="2" fill="rgba(0,0,0,0.35)"/>
      </svg>
    </div>
    </div>
  );
};

export default Leaderboard;
