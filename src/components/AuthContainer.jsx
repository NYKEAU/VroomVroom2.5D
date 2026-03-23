import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  auth,
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  logOut,
  updateUsername,
} from '../firebase';
import '../App.css';

// Logo Google intégré en Base64 au lieu d'utiliser une URL externe
// Cela évite les problèmes de chargement d'image
const GOOGLE_ICON = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDggNDgiPjxkZWZzPjxwYXRoIGlkPSJhIiBkPSJNNDQuNSAyMEgyNHY4LjVoMTEuOEMzNC43IDMzLjkgMzAuMSAzNyAyNCAzN2MtNy4yIDAtMTMtNS44LTEzLTEzczUuOC0xMyAxMy0xM2MzLjEgMCA1LjkgMS4xIDguMSAyLjlsNi40LTYuNEMzNC42IDQuMSAyOS42IDIgMjQgMiAxMS44IDIgMiAxMS44IDIgMjRzOS44IDIyIDIyIDIyYzExIDAgMjEtOCAyMS0yMiAwLTEuMy0uMi0yLjctLjUtNHoiLz48L2RlZnM+PGNsaXBQYXRoIGlkPSJiIj48dXNlIHhsaW5rOmhyZWY9IiNhIiBvdmVyZmxvdz0idmlzaWJsZSIvPjwvY2xpcFBhdGg+PHBhdGggY2xpcC1wYXRoPSJ1cmwoI2IpIiBmaWxsPSIjRkJCQzA1IiBkPSJNMCAzN1YxMWwxNyAxM3oiLz48cGF0aCBjbGlwLXBhdGg9InVybCgjYikiIGZpbGw9IiNFQTQzMzUiIGQ9Ik0wIDExbDE3IDEzIDctNi4xTDQ4IDE0VjBIMHoiLz48cGF0aCBjbGlwLXBhdGg9InVybCgjYikiIGZpbGw9IiMzNEE4NTMiIGQ9Ik0wIDM3bDMwLTIzIDcuOSAxTDQ4IDB2NDhIMHoiLz48cGF0aCBjbGlwLXBhdGg9InVybCgjYikiIGZpbGw9IiM0Mjg1RjQiIGQ9Ik00OCA0OEwxNyAyNGwtNC0zIDM1LTEweiIvPjwvc3ZnPg==`;

// Suppression de l'icône de réglage en base64 qui pose problème

const AuthContainer = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const popupRef = useRef(null);

  // États pour la modale auth + formulaire email/mot de passe
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const authModalRef = useRef(null);
  const formContainerRef = useRef(null);
  const prevHeightRef = useRef(null);

  // Surveiller les changements d'état d'authentification
  useEffect(() => {
    // Vérifier que auth.onAuthStateChanged existe avant de l'appeler
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      const unsubscribe = auth.onAuthStateChanged((authUser) => {
        if (authUser) {
          setUser(authUser);
          setNewUsername(authUser.displayName || '');
        } else {
          setUser(null);
          setNewUsername('');
        }
      });

      return () => unsubscribe(); // Nettoyage lors du démontage
    }
  }, []);

  // Gestionnaire de clic en dehors du popup pour le fermer
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Traduction des erreurs Firebase
  const translateFirebaseError = (code) => {
    const errors = {
      'auth/email-already-in-use': 'Cet email est déjà utilisé',
      'auth/wrong-password': 'Mot de passe incorrect',
      'auth/user-not-found': 'Aucun compte avec cet email',
      'auth/weak-password': 'Mot de passe trop court (6 caractères min)',
      'auth/invalid-email': 'Email invalide',
      'auth/invalid-credential': 'Email ou mot de passe incorrect',
    };
    return errors[code] || 'Une erreur est survenue. Veuillez réessayer.';
  };

  // Connexion avec email
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      setLoading(true);
      await signInWithEmail(email, password);
    } catch (error) {
      setAuthError(translateFirebaseError(error.code));
    } finally {
      setLoading(false);
    }
  };

  // Inscription avec email
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (password !== confirmPassword) {
      setAuthError('Les mots de passe ne correspondent pas');
      return;
    }
    if (!registerUsername.trim() || registerUsername.trim().length < 3) {
      setAuthError('Le pseudo doit contenir au moins 3 caractères');
      return;
    }
    try {
      setLoading(true);
      await signUpWithEmail(email, password, registerUsername.trim());
    } catch (error) {
      setAuthError(translateFirebaseError(error.code));
    } finally {
      setLoading(false);
    }
  };

  // Méthode pour se connecter avec Google
  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('Erreur de connexion:', error);
      setAuthError('Erreur lors de la connexion Google. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  // Méthode pour se déconnecter
  const handleSignOut = async () => {
    try {
      setLoading(true);
      await logOut();
      setShowSettings(false);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    } finally {
      setLoading(false);
    }
  };

  // Méthode pour mettre à jour le nom d'utilisateur
  const handleUpdateUsername = async () => {
    // Réinitialiser les états
    setUsernameError('');
    setUpdateSuccess(false);

    // Validation
    if (!newUsername || newUsername.trim().length < 3) {
      setUsernameError('Le nom doit contenir au moins 3 caractères');
      return;
    }

    if (newUsername.trim().length > 20) {
      setUsernameError('Le nom doit contenir moins de 20 caractères');
      return;
    }

    try {
      setUpdateLoading(true);
      const result = await updateUsername(newUsername.trim());

      if (result.success) {
        setUpdateSuccess(true);
        // Fermer le popup après 1.5 secondes
        setTimeout(() => {
          setShowSettings(false);
          setUpdateSuccess(false);
        }, 1500);
      } else {
        setUsernameError(
          result.error || 'Erreur lors de la mise à jour du nom'
        );
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du nom:', error);
      setUsernameError('Erreur lors de la mise à jour du nom');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Initialise la hauteur explicite du conteneur de formulaire (nécessaire pour la transition CSS)
  useLayoutEffect(() => {
    if (formContainerRef.current) {
      formContainerRef.current.style.height = formContainerRef.current.scrollHeight + 'px';
    }
  }, [showAuthModal]);

  // Anime la hauteur après le changement d'onglet
  useEffect(() => {
    if (!formContainerRef.current || prevHeightRef.current === null) return;
    const el = formContainerRef.current;

    // Mesure la hauteur naturelle du nouveau contenu
    el.style.height = 'auto';
    const newHeight = el.scrollHeight;

    // Revient à l'ancienne hauteur sans transition (snap instantané)
    el.style.transition = 'none';
    el.style.height = prevHeightRef.current + 'px';

    // Force le reflow pour que le navigateur enregistre le snap
    el.offsetHeight;

    // Réactive la transition et anime vers la nouvelle hauteur
    el.style.transition = '';
    el.style.height = newHeight + 'px';

    prevHeightRef.current = null;
  }, [activeTab]);

  const switchTab = (tab) => {
    if (formContainerRef.current) {
      prevHeightRef.current = formContainerRef.current.scrollHeight;
      formContainerRef.current.style.height = prevHeightRef.current + 'px';
    }
    setActiveTab(tab);
    setAuthError('');
  };

  return (
    <div className="auth-container">
      {user ? (
        <>
          <div className="user-info-display">
            <img
              src={
                user.photoURL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=6c63ff&color=fff`
              }
              alt={user.displayName}
              referrerPolicy="no-referrer"
            />
            <span>{user.displayName}</span>
            <button
              className="settings-button"
              onClick={() => setShowSettings(!showSettings)}
              title="Paramètres"
            >
              {/* Icône SVG directement intégrée */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>

          {showSettings && (
            <div className="settings-overlay">
              <div className="settings-card" ref={popupRef}>
                <h3 className="settings-title">Paramètres</h3>

                <div className="settings-user-header">
                  <img
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=6c63ff&color=fff`}
                    alt={user.displayName}
                    className="settings-user-avatar"
                    referrerPolicy="no-referrer"
                  />
                  <span className="settings-user-name">{user.displayName}</span>
                </div>

                <label className="settings-label" htmlFor="username">
                  Nom d'utilisateur :
                </label>
                <input
                  className="settings-input"
                  type="text"
                  id="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Votre nom d'utilisateur"
                />

                <div className="settings-restriction-note">
                  Note : Vous ne pouvez modifier votre nom d'utilisateur qu'une
                  fois tous les 30 jours.
                </div>

                {usernameError && (
                  <p className="error-message">{usernameError}</p>
                )}

                {updateSuccess && (
                  <p className="success-message">
                    Nom d'utilisateur mis à jour avec succès !
                  </p>
                )}

                <button
                  className="pause-btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleUpdateUsername}
                  disabled={updateLoading}
                >
                  {updateLoading ? 'Sauvegarde...' : 'Enregistrer'}
                </button>

                <button
                  className="settings-logout-btn"
                  onClick={handleSignOut}
                  disabled={loading}
                >
                  {loading ? '...' : 'Déconnexion'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button className="auth-button" onClick={() => setShowAuthModal(true)}>
            Connexion / Inscription
          </button>

          {showAuthModal && (
            <div
              className="settings-overlay"
              onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}
            >
              <div className="settings-card auth-modal-card" ref={authModalRef}>
                <button
                  className="auth-modal-close"
                  onClick={() => setShowAuthModal(false)}
                  aria-label="Fermer"
                >
                  ✕
                </button>

                <h3 className="settings-title">Mon compte</h3>

                <div className="auth-tabs">
                  <button
                    className={`auth-tab${activeTab === 'login' ? ' active' : ''}`}
                    onClick={() => switchTab('login')}
                  >
                    Connexion
                  </button>
                  <button
                    className={`auth-tab${activeTab === 'register' ? ' active' : ''}`}
                    onClick={() => switchTab('register')}
                  >
                    Inscription
                  </button>
                </div>

                <div className="auth-form-container" ref={formContainerRef}>
                {activeTab === 'login' ? (
                  <form onSubmit={handleEmailLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="auth-form-group">
                      <label className="auth-form-label">Email</label>
                      <input
                        className="auth-form-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                        required
                      />
                    </div>
                    <div className="auth-form-group">
                      <label className="auth-form-label">Mot de passe</label>
                      <input
                        className="auth-form-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    {authError && <div className="auth-error">{authError}</div>}
                    <button className="auth-submit-btn" type="submit" disabled={loading}>
                      {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleEmailRegister} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="auth-form-group">
                      <label className="auth-form-label">Email</label>
                      <input
                        className="auth-form-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                        required
                      />
                    </div>
                    <div className="auth-form-group">
                      <label className="auth-form-label">Pseudo</label>
                      <input
                        className="auth-form-input"
                        type="text"
                        value={registerUsername}
                        onChange={(e) => setRegisterUsername(e.target.value)}
                        placeholder="MonPseudo"
                        required
                      />
                    </div>
                    <div className="auth-form-group">
                      <label className="auth-form-label">Mot de passe</label>
                      <input
                        className="auth-form-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="auth-form-group">
                      <label className="auth-form-label">Confirmer le mot de passe</label>
                      <input
                        className="auth-form-input"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    {authError && <div className="auth-error">{authError}</div>}
                    <button className="auth-submit-btn" type="submit" disabled={loading}>
                      {loading ? 'Création...' : 'Créer un compte'}
                    </button>
                  </form>
                )}
                </div>

                <div className="auth-separator">
                  <span className="auth-separator-line"></span>
                  <span className="auth-separator-text">— ou —</span>
                  <span className="auth-separator-line"></span>
                </div>

                <button className="auth-button" onClick={handleSignIn} disabled={loading} style={{ width: '100%' }}>
                  {loading ? (
                    'Connexion...'
                  ) : (
                    <>
                      <img src={GOOGLE_ICON} alt="Google" width="18" height="18" />
                      Se connecter avec Google
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuthContainer;
