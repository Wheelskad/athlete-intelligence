# Athlete Intelligence

Un dashboard personnel et un serveur MCP pour exploiter mes données Intervals.icu dans ChatGPT.

Le projet rassemble les activités, la récupération, la charge d'entraînement et quelques métriques avancées dans un format compact. Il conserve aussi le contexte exact utilisé par ChatGPT, les recommandations proposées et leur statut. Le ressenti du jour et la publication d'un planning restent soumis à confirmation.

Ce n'est pas un dispositif médical : les chiffres décrivent l'entraînement, ils ne posent aucun diagnostic.

## Ce qui fonctionne

- dashboard sur 14, 28 ou 42 jours ;
- historique fitness (CTL), fatigue (ATL) et forme (TSB) ;
- synthèse hebdomadaire, régularité et répartition par sport ;
- VO₂ max, FTP, TRIMP, charge cardiaque et efficacité quand Intervals.icu les fournit ;
- treize outils MCP pour ChatGPT ou MCP Inspector ;
- snapshots immuables et historique des décisions du coach dans Cloudflare D1 ;
- mode démo sans compte ni donnée personnelle ;
- mode live avec Intervals.icu ;
- Worker MCP séparé, protégé par OAuth 2.1 et Cloudflare Access.

```text
Garmin / ROUVY / autres sources
              │
              ▼
         Intervals.icu
              │ API
              ▼
   Athlete Intelligence
       ├── dashboard
       ├── D1 : snapshots + décisions + séances gérées
       └── MCP OAuth ──► ChatGPT (moteur de décision)
```

Les clés et tokens ne sont jamais copiés dans la base. Le KV Cloudflare sert uniquement à l'état OAuth. D1 conserve les snapshots normalisés, les décisions auditées et la correspondance des séances gérées. Il ne stocke ni trace GPS, ni fichier FIT/GPX, ni raisonnement privé du modèle.

## Lancer le projet en local

Prérequis : Node.js 20 ou plus récent et npm.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Le mode par défaut utilise des fixtures anonymisées. Wrangler affiche l'adresse locale, généralement :

- dashboard : `http://localhost:8787/`
- MCP : `http://localhost:8787/mcp`

## Utiliser mon compte Intervals.icu

Dans `.dev.vars` :

```dotenv
DATA_SOURCE=intervals
INTERVALS_ATHLETE_ID=0
INTERVALS_API_KEY=ma-cle-api
DEFAULT_TIMEZONE=Europe/Paris
MAX_HISTORY_DAYS=42
NODE_ENV=development
ATHLETE_ID=primary
```

Le profil stable est optionnel et se configure sans logique de coaching :

```dotenv
ATHLETE_PROFILE_JSON={"goals":[],"preferences":{"indoorCyclingAvailable":true,"maxSessionsPerWeek":4},"currentObjective":{"name":"Mon objectif","priority":"HIGH"}}
```

`INTERVALS_ATHLETE_ID=0` désigne le compte associé à la clé. La clé API se récupère dans les paramètres Intervals.icu. `.dev.vars` est ignoré par Git : il ne faut jamais déplacer la clé vers un fichier versionné.

Après modification, relancer `npm run dev`. Le dashboard doit afficher `Intervals.icu` comme source et une date de fraîcheur cohérente.

## Tester le MCP avec Inspector

Garder le serveur local ouvert puis lancer, dans un second terminal :

```bash
npx @modelcontextprotocol/inspector@latest
```

Dans Inspector :

1. choisir `Streamable HTTP` ;
2. saisir `http://localhost:8787/mcp` ;
3. cliquer sur **Connect** puis **List tools** ;
4. appeler par exemple `get_performance_metrics` avec `{"historyDays": 42}`.

On peut aussi tester sans l'interface :

```bash
npx @modelcontextprotocol/inspector@latest --cli \
  http://localhost:8787/mcp \
  --method tools/list \
  --format json
```

## Outils MCP

| Outil | Rôle |
|---|---|
| `get_week_summary` | Résumé d'une période d'activités |
| `get_recovery_summary` | Sommeil, FC au repos, VFC et tendances |
| `get_training_context` | Contexte complet avec calendrier à venir |
| `get_performance_metrics` | Vue consolidée utilisée par le dashboard |
| `get_training_runtime_context` | Snapshot normalisé complet et décisions récentes |
| `get_coach_dashboard` | Vue compacte du jour : récupération, charge, prochaine séance et décision en attente |
| `get_workout_detail` | Détail canonique d'une séance gérée et durée relue dans Intervals.icu |
| `get_training_decision_history` | Historique compact des recommandations |
| `save_training_decision` | Persiste une proposition structurée de ChatGPT |
| `update_training_decision_status` | Accepte ou refuse une proposition confirmée |
| `record_daily_check_in` | Enregistre fatigue, stress, motivation et courbatures |
| `record_pre_workout_feedback` | Conserve le ressenti pré-séance, le temps disponible, la préférence sportive ou une douleur déclarée |
| `publish_training_plan` | Publie jusqu'à 14 séances confirmées |

Les huit outils de consultation sont en lecture seule du point de vue de l'athlète. `get_training_runtime_context` et `get_coach_dashboard` capturent toutefois une copie immuable du contexte pour l'audit. Une décision est d'abord `PROPOSED`, puis explicitement `ACCEPTED` ou `REJECTED`. La publication est séparée et fait passer une décision acceptée à `PUBLISHED` uniquement si la séance relue dans Intervals.icu est valide. Les confirmations utilisateur sont obligatoires pour le ressenti, l'acceptation/refus et la publication. Le planning ne peut mettre à jour que les événements créés par ce connecteur, identifiés par le préfixe `athlete-ai:`.

ChatGPT reste le moteur de décision : aucun score maison ne choisit automatiquement une séance. Le serveur calcule seulement les métriques, fournit les contraintes et persiste le résultat structuré. `reasoningSummary` doit contenir quelques explications destinées à l'utilisateur, jamais une chain-of-thought.

## Adaptive coaching runtime

```text
Intervals.icu
     ↓
Athlete Intelligence
     ↓
contexte normalisé et immuable
     ↓
LLM coach
     ↓
décision structurée
     ↓
confirmation utilisateur
     ↓
écriture Intervals.icu contrôlée puis vérifiée
```

`get_coach_dashboard` est le point d'entrée conseillé pour les demandes courtes comme « coach » ou « séance ? ». Il rassemble en un appel les métriques de récupération et de charge, la prochaine séance gérée, les deux ou trois suivantes, le dernier feedback subjectif et une éventuelle décision en attente. Le champ `state` ne vient jamais d'une règle de coaching cachée : il reprend uniquement l'état d'une décision déjà produite par le modèle, sinon il vaut `null`.

`get_workout_detail` retourne la description canonique, les blocs structurés disponibles, la durée attendue et la durée réellement interprétée par Intervals.icu. `record_pre_workout_feedback` complète le check-in quotidien : « flemme » peut être conservé comme `NO_MOTIVATION` avec son texte libre, tandis qu'une fatigue ou une douleur chiffrée n'est jamais déduite d'un message vague. Une douleur déclarée reste un ressenti subjectif et non un diagnostic.

Chaque séance créée par le connecteur possède un `managedId` stable. Une adaptation ou un déplacement réutilise cet identifiant ; une séance sans le préfixe privé `athlete-ai:` ne peut pas être écrasée par l'upsert. Plusieurs séances gérées peuvent coexister sur les 5 à 7 prochains jours.

Les blocs structurés de `publish_training_plan` sont sérialisés au format natif du Workout Builder. Un bloc répété est notamment envoyé sous cette forme, sans indentation :

```text
4x
- 5m seated, cadence 55-60rpm, RPE 6/10
- 3m easy, cadence 90-95rpm
```

Après l'écriture, le connecteur relit l'événement et compare sa durée `workout_doc` à la durée attendue avec une tolérance d'une minute. Le résultat contient `verified`, `parsedDurationMinutes` et `durationDeltaMinutes`. En cas de `WORKOUT_DURATION_MISMATCH` ou de durée indisponible, la décision reste `ACCEPTED`, la vérification est persistée et elle ne passe pas silencieusement à `PUBLISHED`.

Cycle de décision :

```text
PROPOSED → ACCEPTED → publication vérifiée → PUBLISHED
         ↘ REJECTED
```

Le service applicatif `buildCoachRuntime({ runtimeType: "DAILY" | "WEEKLY" })` prépare aussi un snapshot factuel pour une future exécution planifiée. Il ne contient aucune règle choisissant la séance : l'appel externe au modèle restera responsable de la décision.

Exemple de parcours complet :

```text
"coach"
→ get_coach_dashboard
→ proposition enregistrée avec save_training_decision

"flemme, 35 min"
→ record_pre_workout_feedback après confirmation
→ nouveau dashboard
→ proposition REDUCE conservant le même managedId

"go"
→ update_training_decision_status(ACCEPTED)
→ publish_training_plan
→ relecture et vérification
→ PUBLISHED seulement si la durée est cohérente
```

Exemples :

```json
{ "historyDays": 42 }
```

```json
{
  "historyDays": 14,
  "includeUpcomingCalendar": true,
  "calendarDays": 28
}
```

## Comprendre les métriques

- **Fitness / CTL** : moyenne pondérée de la charge sur le long terme. Elle évolue lentement, donc une courbe assez plate sur quelques jours est normale.
- **Fatigue / ATL** : charge récente, plus sensible aux grosses séances.
- **Forme / TSB** : fitness moins fatigue. Une valeur négative traduit surtout une charge récente supérieure à l'habitude.
- **VO₂ max, FTP et métriques avancées** : affichées seulement si la source fournit une valeur exploitable.
- **Couverture** : proportion de séances ou de jours pour lesquels la métrique existe.

Les infobulles du dashboard donnent une explication courte sans transformer ces indicateurs en recommandations médicales.

## Données absentes ou indisponibles

Certaines métriques Garmin propriétaires ne sont pas garanties par l'API Intervals.icu : Training Readiness, Garmin Recovery Time, Training Status, Acute Load Focus et Endurance Score. Elles apparaissent dans `missingMetrics` au lieu d'être estimées.

Intervals.icu peut aussi empêcher l'accès API au détail d'activités importées depuis Strava. Ces séances sont comptées dans `unavailableActivityCount` et ne sont pas considérées comme une panne générale. Une connexion directe Garmin ou ROUVY vers Intervals.icu donne en général un historique plus exploitable.

Le serveur retire volontairement les positions GPS, traces, noms libres, descriptions d'activités, fichiers FIT/GPX et identifiants fournisseur de ses réponses MCP.

## Déploiements Cloudflare

Trois configurations sont séparées :

- `npm run deploy:demo` : dashboard avec fixtures anonymisées ;
- `npm run deploy:live` : dashboard personnel avec Intervals.icu, à placer derrière Cloudflare Access ;
- `npm run deploy:mcp` : endpoint MCP OAuth destiné à ChatGPT.

La mémoire utilise la base D1 `athlete-intelligence-training`. Le schéma versionné se trouve dans `migrations/`. Avant un premier déploiement :

```bash
npm run db:migrate:remote
```

Pour le dashboard live, ajouter les secrets sans les écrire dans `wrangler.jsonc` :

```bash
npx wrangler secret put INTERVALS_API_KEY --env live
npx wrangler secret put INTERVALS_ATHLETE_ID --env live
npm run deploy:live
```

Le dashboard et le MCP sont deux Workers différents. Le premier peut être protégé par Access sur tout le trafic. Le second doit laisser ses routes `/.well-known/*` accessibles afin qu'un client MCP puisse découvrir son serveur OAuth ; `/mcp` reste protégé par jeton.

## Préparer le MCP distant

Le Worker prévu par `wrangler.mcp.jsonc` s'appelle `athlete-intelligence-mcp`. Son URL attendue est :

```text
https://athlete-intelligence-mcp.alpine-lancer.workers.dev/mcp
```

Dans Cloudflare Zero Trust :

1. ouvrir **Access controls → Applications → Add an application** ;
2. choisir **SaaS**, puis une application OIDC personnalisée ;
3. utiliser `https://athlete-intelligence-mcp.alpine-lancer.workers.dev/callback` comme Redirect URL ;
4. activer `openid`, `email`, `profile` et PKCE ;
5. ajouter une règle Allow limitée à mon adresse e-mail ;
6. récupérer le Client ID, le Client secret et les quatre URLs OIDC.

Ajouter ensuite les secrets au Worker :

```bash
npx wrangler secret put INTERVALS_API_KEY --config wrangler.mcp.jsonc
npx wrangler secret put INTERVALS_ATHLETE_ID --config wrangler.mcp.jsonc
npx wrangler secret put ACCESS_CLIENT_ID --config wrangler.mcp.jsonc
npx wrangler secret put ACCESS_CLIENT_SECRET --config wrangler.mcp.jsonc
npx wrangler secret put ACCESS_TOKEN_URL --config wrangler.mcp.jsonc
npx wrangler secret put ACCESS_AUTHORIZATION_URL --config wrangler.mcp.jsonc
npx wrangler secret put ACCESS_JWKS_URL --config wrangler.mcp.jsonc
npx wrangler secret put ACCESS_ISSUER --config wrangler.mcp.jsonc
npx wrangler secret put COOKIE_ENCRYPTION_KEY --config wrangler.mcp.jsonc
npx wrangler secret put AUTHORIZED_EMAILS --config wrangler.mcp.jsonc
npm run deploy:mcp
```

Générer la clé de cookie avec `openssl rand -hex 32`. `AUTHORIZED_EMAILS` accepte une ou plusieurs adresses séparées par des virgules.

Les détails de sécurité et la checklist de mise en production sont dans [docs/REMOTE-DEPLOYMENT.md](docs/REMOTE-DEPLOYMENT.md).

## Ajouter le MCP dans ChatGPT

Une fois le Worker MCP déployé :

1. dans ChatGPT, ouvrir **Settings → Security and login** et activer **Developer mode** ;
2. ouvrir **Plugins**, cliquer sur `+` et créer une connexion ;
3. saisir l'URL publique complète se terminant par `/mcp` ;
4. terminer la connexion Cloudflare Access ;
5. démarrer une nouvelle conversation et sélectionner la connexion dans le menu des outils.

Après un nouveau déploiement qui change les outils, actualiser les métadonnées de la connexion. Procédure officielle : [OpenAI — Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Test de runtime dans ChatGPT :

```text
Fais mon runtime d'entraînement du jour. Utilise get_training_runtime_context,
produis une décision structurée, puis persiste-la avec save_training_decision.
Présente-la comme PROPOSED. Ne l'accepte et ne la publie pas sans ma confirmation.
```

## Commandes utiles

```bash
npm run dev          # dashboard + MCP local
npm run dev:mcp      # Worker OAuth local, port 8788
npm test
npm run lint
npm run typecheck
npm run build
npm run build:mcp
npm run db:migrate:local
npm run db:migrate:remote
```

Les commandes `build` effectuent un dry-run Wrangler et ne déploient rien.

## Licence

[MIT](LICENSE)
