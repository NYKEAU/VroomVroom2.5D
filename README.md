# Vroom Vroom 2.5D Racing Game

Un jeu de course 2.5D avec un système de leaderboard et de connexion Google.

## Configuration Firebase

Le jeu utilise Firebase pour l'authentification Google et le stockage des scores. Pour configurer Firebase :

1. Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Activez l'authentification Google :
   - Dans la console Firebase, allez dans "Authentication" > "Sign-in method"
   - Activez "Google" comme fournisseur
3. Créez une base de données Firestore :
   - Dans la console Firebase, allez dans "Firestore Database"
   - Créez une base de données en mode production ou test
4. Configurez les règles de sécurité Firestore :
   - Allez dans l'onglet "Règles" de Firestore
   - Remplacez les règles par défaut par celles-ci :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /scores/{userId} {
         // Allow read to anyone
         allow read: if true;

         // Allow write only for authenticated users and only to their own document
         allow create, update: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
5. Obtenez vos informations de configuration :
   - Dans la console Firebase, cliquez sur l'icône ⚙️ (paramètres) > "Paramètres du projet"
   - Dans l'onglet "Général", faites défiler jusqu'à "Vos applications"
   - Cliquez sur l'icône Web (</>) pour ajouter une application web
   - Enregistrez votre application avec un nom
   - Copiez les informations de configuration (apiKey, authDomain, etc.)
6. Configurez vos variables d'environnement :
   - Créez un fichier `.env.local` à la racine du projet
   - Ajoutez vos informations Firebase comme suit :

```
VITE_API_KEY=votre_api_key
VITE_AUTH_DOMAIN=votre_project_id.firebaseapp.com
VITE_PROJECT_ID=votre_project_id
VITE_STORAGE_BUCKET=votre_project_id.appspot.com
VITE_MESSAGING_SENDER_ID=votre_messaging_sender_id
VITE_APP_ID=votre_app_id
```

## Installation

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Build pour la production
npm run build
```

## Fonctionnalités

- Course avec voiture télécommandée cartoonesque
- Terrain généré procéduralement basé sur une seed
- Connexion avec Google
- Leaderboard des meilleurs scores
- Stockage des scores dans Firebase
- Possibilité de copier les seeds des meilleurs scores

## Résolution des problèmes courants

### Erreur "Missing or insufficient permissions"

Si vous voyez cette erreur dans la console :

```
Erreur lors de l'enregistrement du score: FirebaseError: Missing or insufficient permissions.
```

Assurez-vous que :

1. Vous avez correctement configuré les règles de sécurité de Firestore comme indiqué dans la section "Configuration Firebase"
2. L'utilisateur est correctement authentifié avant d'essayer d'enregistrer un score
3. L'utilisateur essaie bien d'écrire dans son propre document (userId)

### Véhicule retourné

Le jeu détecte automatiquement quand le véhicule reste retourné sur le toit pendant plus de 3 secondes et déclenche une fin de partie.
