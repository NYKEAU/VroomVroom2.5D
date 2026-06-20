const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();

// ─── Constantes ─────────────────────────────────────────────────────────────
// Vitesse max physics: ~33 m/s (120 km/h) + bonus saut max ~10 pts/s ≈ 43 pts/s
// La limite de 150 est généreuse pour éviter les faux positifs.
const MAX_SCORE_PER_SECOND = 150;

// Durée de vie d'une session : 2 heures
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// Durée minimale de jeu avant de vérifier le ratio (évite division par ~0)
const MIN_ELAPSED_SECONDS = 10;

// ─── generateSessionToken ────────────────────────────────────────────────────
// Appelée au démarrage d'une partie. Crée un document /sessions/{token}.
exports.generateSessionToken = onCall({ region: 'europe-west1', cors: 'https://vv25d.nykeau.fr', invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }

  const uid = request.auth.uid;
  const token = crypto.randomUUID();

  await db.collection('sessions').doc(token).set({
    uid,
    startTime: Date.now(),
    used: false,
  });

  return { token };
});

// ─── submitScore ─────────────────────────────────────────────────────────────
// Appelée à la fin de partie. Valide le token et enregistre le score si meilleur.
exports.submitScore = onCall({ region: 'europe-west1', cors: 'https://vv25d.nykeau.fr', invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }

  const { token, score, seed } = request.data;
  const uid = request.auth.uid;

  // Validation basique des paramètres
  if (typeof token !== 'string' || !token) {
    throw new HttpsError('invalid-argument', 'Token manquant.');
  }
  if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
    throw new HttpsError('invalid-argument', 'Score invalide.');
  }

  const sessionRef = db.collection('sessions').doc(token);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new HttpsError('not-found', 'Session introuvable ou déjà consommée.');
  }

  const session = sessionDoc.data();

  // Vérification one-shot
  if (session.used) {
    throw new HttpsError('already-exists', 'Ce token a déjà été utilisé.');
  }

  // Vérification propriétaire
  if (session.uid !== uid) {
    await sessionRef.delete();
    throw new HttpsError('permission-denied', 'Ce token ne vous appartient pas.');
  }

  const elapsed = Date.now() - session.startTime;

  // Vérification expiration (TTL 2h)
  if (elapsed > SESSION_TTL_MS) {
    await sessionRef.delete();
    throw new HttpsError('deadline-exceeded', 'Session expirée (> 2 heures).');
  }

  // Vérification du ratio score/seconde (seulement après un minimum de jeu)
  const elapsedSeconds = elapsed / 1000;
  if (elapsedSeconds >= MIN_ELAPSED_SECONDS) {
    const scorePerSecond = score / elapsedSeconds;
    if (scorePerSecond > MAX_SCORE_PER_SECOND) {
      await sessionRef.delete();
      throw new HttpsError(
        'invalid-argument',
        `Score suspect : ${scorePerSecond.toFixed(1)} pts/s (max autorisé: ${MAX_SCORE_PER_SECOND}).`
      );
    }
  }

  // Marquer le token comme utilisé (atomique, évite les doubles soumissions)
  await sessionRef.update({ used: true });

  let updated = false;

  try {
    const scoreRef = db.collection('scores').doc(uid);
    const scoreDoc = await scoreRef.get();

    if (!scoreDoc.exists || scoreDoc.data().score < score) {
      // Récupérer les infos du profil Firebase Auth
      const userRecord = await getAuth().getUser(uid);
      const existingData = scoreDoc.exists ? scoreDoc.data() : {};

      await scoreRef.set({
        userId: uid,
        // Conserver le pseudo personnalisé s'il existe, sinon utiliser le displayName Auth
        username: existingData.username || userRecord.displayName || 'Joueur',
        photoURL: userRecord.photoURL || existingData.photoURL || null,
        score,
        seed,
        timestamp: FieldValue.serverTimestamp(),
        // Conserver la date du dernier changement de pseudo
        ...(existingData.lastUsernameChange
          ? { lastUsernameChange: existingData.lastUsernameChange }
          : {}),
      });

      updated = true;
    }
  } finally {
    // Supprimer la session dans tous les cas (succès ou score non amélioré)
    await sessionRef.delete();
  }

  return { updated };
});

// ─── updateUsername ───────────────────────────────────────────────────────────
// Remplace l'écriture directe client→Firestore pour les changements de pseudo.
// Respecte la limite de 30 jours côté serveur.
exports.updateUsername = onCall({ region: 'europe-west1', cors: 'https://vv25d.nykeau.fr', invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }

  const { newUsername } = request.data;
  const uid = request.auth.uid;

  if (typeof newUsername !== 'string' || newUsername.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Pseudo invalide.');
  }
  if (newUsername.trim().length > 20) {
    throw new HttpsError('invalid-argument', 'Pseudo trop long (20 caractères max).');
  }

  const trimmed = newUsername.trim();
  const scoreRef = db.collection('scores').doc(uid);
  const scoreDoc = await scoreRef.get();

  // Vérification de la limite de 30 jours
  if (scoreDoc.exists && scoreDoc.data().lastUsernameChange) {
    const lastChange = scoreDoc.data().lastUsernameChange.toDate();
    const diffMs = Date.now() - lastChange.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      const remaining = 30 - diffDays;
      throw new HttpsError(
        'resource-exhausted',
        `Prochain changement possible dans ${remaining} jour(s).`
      );
    }
  }

  // Mettre à jour le profil Firebase Auth
  await getAuth().updateUser(uid, { displayName: trimmed });

  // Mettre à jour (ou créer) le document Firestore
  const updateData = {
    userId: uid,
    username: trimmed,
    lastUsernameChange: FieldValue.serverTimestamp(),
  };

  if (scoreDoc.exists) {
    await scoreRef.update(updateData);
  } else {
    await scoreRef.set({
      photoURL: null,
      score: 0,
      seed: 0,
      timestamp: FieldValue.serverTimestamp(),
      ...updateData,
    });
  }

  return { success: true };
});
