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

  return (
    <div className={`leaderboard-container ${fadeIn ? 'fade-in' : ''}`}>
      <h2 className="leaderboard-title">Classement</h2>

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
                {copiedSeed === userScore.seed ? '✅ Copié !' : '📋 Jouer cette seed'}
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
                    {copiedSeed === score.seed ? '✅ Copié !' : '📋 Jouer cette seed'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
