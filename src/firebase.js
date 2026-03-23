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
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

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
let app, auth, db, provider;

// Essayer d'initialiser Firebase avec la configuration fournie
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
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

// Fonction pour enregistrer un score
export const saveScore = async (userId, score, seed) => {
  if (!isFirebaseInitialized) {
    console.warn(
      "Firebase n'est pas initialisé, impossible d'enregistrer le score"
    );
    return false;
  }

  try {
    // Vérifier si l'utilisateur a déjà un score
    const userScoreRef = doc(db, 'scores', userId);
    const userScoreDoc = await getDoc(userScoreRef);

    // Mise à jour uniquement si le nouveau score est meilleur
    if (!userScoreDoc.exists() || userScoreDoc.data().score < score) {
      await setDoc(userScoreRef, {
        userId,
        username: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
        score,
        seed,
        timestamp: new Date(),
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du score:", error);
    throw error;
  }
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

// Fonction pour mettre à jour le nom d'utilisateur
export const updateUsername = async (newUsername) => {
  if (!isFirebaseInitialized || !auth.currentUser) {
    console.warn("Firebase n'est pas initialisé ou utilisateur non connecté");
    return { success: false, error: 'Utilisateur non connecté' };
  }

  try {
    const userId = auth.currentUser.uid;
    // Vérifier si l'utilisateur a déjà un document de score
    const userScoreRef = doc(db, 'scores', userId);
    const userScoreDoc = await getDoc(userScoreRef);

    // Vérifier la date du dernier changement de nom d'utilisateur
    if (userScoreDoc.exists() && userScoreDoc.data().lastUsernameChange) {
      const lastChange = userScoreDoc.data().lastUsernameChange.toDate();
      const now = new Date();
      const diffTime = Math.abs(now - lastChange);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 30) {
        return {
          success: false,
          error: `Vous ne pouvez modifier votre nom qu'une fois tous les 30 jours. Prochain changement possible dans ${
            30 - diffDays
          } jour(s).`,
        };
      }
    }

    // Mettre à jour le profil de l'utilisateur
    await updateProfile(auth.currentUser, {
      displayName: newUsername,
    });

    // Mettre à jour le document de score si l'utilisateur en a un
    const updateData = {
      username: newUsername,
      lastUsernameChange: new Date(),
    };

    if (userScoreDoc.exists()) {
      // Mise à jour d'un document existant
      await setDoc(
        userScoreRef,
        {
          ...userScoreDoc.data(),
          ...updateData,
        },
        { merge: true }
      );
    } else {
      // Création d'un nouveau document si aucun score n'existe encore
      await setDoc(userScoreRef, {
        userId,
        photoURL: auth.currentUser.photoURL,
        score: 0,
        seed: 0,
        timestamp: new Date(),
        ...updateData,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du nom d'utilisateur:", error);
    return {
      success: false,
      error: "Erreur lors de la mise à jour du nom d'utilisateur",
    };
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
