// Firebase configuration - À remplacer par votre propre configuration
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Configuration Firebase - Remplacez ces valeurs par celles de votre projet
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY || 'DEMO_KEY',
  authDomain: import.meta.env.VITE_AUTH_DOMAIN || 'demo-app.firebaseapp.com',
  projectId: import.meta.env.VITE_PROJECT_ID || 'demo-project-id',
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET || 'demo-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_APP_ID || '1:123456789012:web:abcdef1234567890',
};

// Variable pour suivre si Firebase est correctement initialisé
let isFirebaseInitialized = false;
let app, auth, db, functions, provider;

// Essayer d'initialiser Firebase avec la configuration fournie
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app, 'europe-west1');
  provider = new GoogleAuthProvider();
  isFirebaseInitialized = true;
  console.log('Firebase initialisé avec succès');
} catch (error) {
  console.error("Erreur lors de l'initialisation de Firebase:", error);
  console.warn(
    'Mode de secours activé - les fonctionnalités en ligne sont désactivées'
  );

  // Créer des objets fictifs pour éviter les erreurs
  auth = {
    currentUser: null,
    onAuthStateChanged: (callback) => {
      callback(null);
      return () => {}; // fonction de nettoyage
    },
  };
}

// Données de scores en mode hors ligne (pour développement/test)
const offlineScores = [
  {
    userId: 'user1',
    username: 'JoueurDemo1',
    photoURL: 'https://ui-avatars.com/api/?name=J&background=random',
    score: 12500,
    seed: 123456,
    timestamp: new Date(),
  },
  {
    userId: 'user2',
    username: 'JoueurDemo2',
    photoURL: 'https://ui-avatars.com/api/?name=P&background=random',
    score: 8750,
    seed: 654321,
    timestamp: new Date(),
  },
  {
    userId: 'user3',
    username: 'JoueurDemo3',
    photoURL: 'https://ui-avatars.com/api/?name=C&background=random',
    score: 6100,
    seed: 987654,
    timestamp: new Date(),
  },
];

// Fonction pour se connecter avec Google
export const signInWithGoogle = async () => {
  if (!isFirebaseInitialized) {
    console.warn("Firebase n'est pas initialisé, impossible de se connecter");
    throw new Error("Firebase n'est pas correctement configuré");
  }

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    throw error;
  }
};

// Fonction pour se déconnecter
export const logOut = async () => {
  if (!isFirebaseInitialized) {
    console.warn("Firebase n'est pas initialisé, impossible de se déconnecter");
    return;
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    throw error;
  }
};

// Génère un token de session côté serveur au démarrage d'une partie.
// Retourne le token (string) à stocker côté client.
export const generateSessionToken = async () => {
  if (!isFirebaseInitialized) {
    console.warn("Firebase n'est pas initialisé, session non créée.");
    return null;
  }
  const fn = httpsCallable(functions, 'generateSessionToken');
  const result = await fn();
  return result.data.token;
};

// Soumet le score à la fin de partie via le token de session signé.
// Le serveur valide le token, le ratio score/temps, et enregistre si meilleur.
export const submitScore = async (token, score, seed) => {
  if (!isFirebaseInitialized) {
    console.warn("Firebase n'est pas initialisé, score non enregistré.");
    return false;
  }
  const fn = httpsCallable(functions, 'submitScore');
  const result = await fn({ token, score, seed });
  return result.data.updated;
};

// Fonction pour obtenir le top 10 des scores
export const getTopScores = async () => {
  if (!isFirebaseInitialized) {
    console.warn(
      "Firebase n'est pas initialisé, retour des scores de démonstration"
    );
    return offlineScores;
  }

  try {
    const scoresRef = collection(db, 'scores');
    const q = query(scoresRef, orderBy('score', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);

    const scores = [];
    querySnapshot.forEach((doc) => {
      scores.push(doc.data());
    });

    return scores;
  } catch (error) {
    console.error('Erreur lors de la récupération des scores:', error);
    console.warn('Retour des scores de démonstration suite à une erreur');
    return offlineScores;
  }
};

// Fonction pour obtenir le score d'un utilisateur spécifique
export const getUserScore = async (userId) => {
  if (!isFirebaseInitialized) {
    console.warn(
      "Firebase n'est pas initialisé, impossible de récupérer le score utilisateur"
    );
    return null;
  }

  try {
    const userScoreRef = doc(db, 'scores', userId);
    const userScoreDoc = await getDoc(userScoreRef);

    if (userScoreDoc.exists()) {
      return userScoreDoc.data();
    }

    return null;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du score de l'utilisateur:",
      error
    );
    throw error;
  }
};

// Fonction pour mettre à jour le nom d'utilisateur (via Cloud Function)
export const updateUsername = async (newUsername) => {
  if (!isFirebaseInitialized || !auth.currentUser) {
    console.warn("Firebase n'est pas initialisé ou utilisateur non connecté");
    return { success: false, error: 'Utilisateur non connecté' };
  }

  try {
    const fn = httpsCallable(functions, 'updateUsername');
    await fn({ newUsername });

    // Rafraîchir le profil local (le displayName vient d'être mis à jour côté serveur)
    await auth.currentUser.reload();

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du nom d'utilisateur:", error);
    const message =
      error.code === 'functions/resource-exhausted'
        ? error.message
        : "Erreur lors de la mise à jour du nom d'utilisateur";
    return { success: false, error: message };
  }
};

// Fonction pour créer un compte avec email + mot de passe
export const signUpWithEmail = async (email, password, username) => {
  if (!isFirebaseInitialized) {
    throw new Error("Firebase n'est pas correctement configuré");
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: username });
    return result.user;
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error);
    throw error;
  }
};

// Fonction pour se connecter avec email + mot de passe
export const signInWithEmail = async (email, password) => {
  if (!isFirebaseInitialized) {
    throw new Error("Firebase n'est pas correctement configuré");
  }

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Erreur lors de la connexion email:', error);
    throw error;
  }
};

// Exporter les objets Firebase pour les utiliser ailleurs
export { auth, db };
