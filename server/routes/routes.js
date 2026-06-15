const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const { generateSessionToken, submitScore } = require('../controllers/sessionController');

router.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'VroomVroom 2.5D API' });
});

// Génère un token de session au démarrage d'une partie
router.post('/session/generate', verifyToken, generateSessionToken);

// Valide et enregistre le score à la fin d'une partie
router.post('/session/submit', verifyToken, submitScore);

module.exports = router;
