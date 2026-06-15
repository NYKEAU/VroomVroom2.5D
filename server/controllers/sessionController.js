const admin = require('../config/firebase-admin');
const db = admin.firestore();

// ─── Constantes ──────────────────────────────────────────────────────────────
// Vitesse max physics : ~33 m/s (120 km/h) + jump bonus max ~10 pts/s → ~43 pts/s
// Limite généreuse pour éviter les faux positifs.
const MAX_SCORE_PER_SECOND = 150;

// TTL session : 2 heures
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// Seuil minimum avant de vérifier le ratio (évite division par ~0)
const MIN_ELAPSED_SECONDS = 10;

// ─── generateSessionToken ─────────────────────────────────────────────────────
// POST /api/session/generate
// Headers : Authorization: Bearer <Firebase ID token>
// Crée /sessions/{uuid} dans Firestore et retourne le token au client.
const generateSessionToken = async (req, res) => {
  try {
    const uid = req.user.uid;
    const token = crypto.randomUUID();

    await db.collection('sessions').doc(token).set({
      uid,
      startTime: Date.now(),
      used: false,
    });

    res.status(200).json({ token });
  } catch (error) {
    console.error('generateSessionToken error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la création de session.' });
  }
};

// ─── submitScore ──────────────────────────────────────────────────────────────
// POST /api/session/submit
// Headers : Authorization: Bearer <Firebase ID token>
// Body    : { token: string, score: number, seed: number }
// Valide le token de session, vérifie le ratio score/temps, enregistre si meilleur.
const submitScore = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { token, score, seed } = req.body;

    // ── Validation des paramètres ─────────────────────────────────────────
    if (typeof token !== 'string' || !token) {
      return res.status(400).json({ error: 'Token manquant.' });
    }
    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return res.status(400).json({ error: 'Score invalide.' });
    }

    // ── Récupération de la session ────────────────────────────────────────
    const sessionRef = db.collection('sessions').doc(token);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session introuvable ou déjà consommée.' });
    }

    const session = sessionDoc.data();

    if (session.used) {
      return res.status(409).json({ error: 'Ce token a déjà été utilisé.' });
    }

    if (session.uid !== uid) {
      await sessionRef.delete();
      return res.status(403).json({ error: 'Ce token ne vous appartient pas.' });
    }

    const elapsed = Date.now() - session.startTime;

    // ── Vérification TTL ──────────────────────────────────────────────────
    if (elapsed > SESSION_TTL_MS) {
      await sessionRef.delete();
      return res.status(410).json({ error: 'Session expirée (> 2 heures).' });
    }

    // ── Vérification ratio score/seconde ──────────────────────────────────
    const elapsedSeconds = elapsed / 1000;
    if (elapsedSeconds >= MIN_ELAPSED_SECONDS) {
      const scorePerSecond = score / elapsedSeconds;
      if (scorePerSecond > MAX_SCORE_PER_SECOND) {
        await sessionRef.delete();
        return res.status(400).json({
          error: `Score suspect : ${scorePerSecond.toFixed(1)} pts/s (max: ${MAX_SCORE_PER_SECOND}).`,
        });
      }
    }

    // ── Marquer le token comme utilisé (one-shot) ─────────────────────────
    await sessionRef.update({ used: true });

    // ── Enregistrer le score si meilleur ──────────────────────────────────
    let updated = false;

    try {
      const scoreRef = db.collection('scores').doc(uid);
      const scoreDoc = await scoreRef.get();

      if (!scoreDoc.exists || scoreDoc.data().score < score) {
        const userRecord = await admin.auth().getUser(uid);
        const existing = scoreDoc.exists ? scoreDoc.data() : {};

        await scoreRef.set({
          userId: uid,
          username: existing.username || userRecord.displayName || 'Joueur',
          photoURL: userRecord.photoURL || existing.photoURL || null,
          score,
          seed,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ...(existing.lastUsernameChange
            ? { lastUsernameChange: existing.lastUsernameChange }
            : {}),
        });

        updated = true;
      }
    } finally {
      await sessionRef.delete();
    }

    res.status(200).json({ updated });
  } catch (error) {
    console.error('submitScore error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la soumission du score.' });
  }
};

module.exports = { generateSessionToken, submitScore };
