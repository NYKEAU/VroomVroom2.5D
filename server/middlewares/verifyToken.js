const admin = require('../config/firebase-admin');

/**
 * Middleware Express : vérifie le Firebase ID token fourni dans
 * l'en-tête  Authorization: Bearer <idToken>
 * Injecte req.user = { uid, email, ... } si valide.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Erreur verifyToken:', error.message);
    return res.status(403).json({ error: 'Token invalide', details: error.message });
  }
};

module.exports = verifyToken;
