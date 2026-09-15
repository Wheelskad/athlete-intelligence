# Athlete Data Connector

Serveur MCP générique qui transforme les données récentes d’un athlète en contexte d’entraînement et de récupération. Les lectures sont privées et compactes ; deux écritures Intervals.icu strictement contrôlées permettent d’enregistrer le ressenti du jour et de publier des séances confirmées. Un mode fixtures anonymisées permet de lancer le projet sans compte ni secret.

> Ce projet fournit des données et des tendances factuelles. Il ne pose aucun diagnostic médical et ne remplace pas un professionnel de santé. Seul le mode démo à données anonymisées peut être exposé publiquement ; le mode Intervals.icu réel reste local tant que l’authentification distante n’est pas implémentée.

## Flux de données

```text
Garmin / ROUVY / autres sources
              │ synchronisation configurée par l’athlète
              ▼
         Intervals.icu
              │ API REST (lectures + écritures confirmées)
              ▼
   adaptateur → domaine normalisé → agrégations → liste blanche vie privée
              │
              ▼
     MCP Streamable HTTP /mcp → ChatGPT / client MCP
```

Le code est organisé en ports et adaptateurs. Les objets Intervals.icu, le modèle métier, les cas d’usage, la protection des sorties et le transport MCP restent séparés. Aucune réponse fournisseur n’est persistée, et aucun Durable Object, KV, D1, Redis ou autre stockage n’est utilisé.

## Jalons

### Jalon A — local, implémenté

- Worker Cloudflare stateless sur `/mcp`, compatible Streamable HTTP ;
- trois outils MCP en lecture seule et deux outils d’écriture avec confirmation obligatoire ;
- sources `fixtures` et `intervals` séparées ;
- secret Intervals.icu conservé dans `.dev.vars`, jamais retourné ;
- écritures Intervals.icu limitées au check-in du jour et aux séances du plan explicitement confirmées ;
- filtrage des sorties par liste blanche ;
- tests unitaires et contrat de sortie.

### Jalon B — distant sécurisé, non implémenté

Le mode `NODE_ENV=production` refuse actuellement `/mcp` avec `503 PRODUCTION_AUTH_NOT_CONFIGURED`. Le serveur ne doit être déployé qu’après mise en place d’un fournisseur d’identité OAuth 2.1 établi et des contrôles décrits dans [docs/REMOTE-DEPLOYMENT.md](docs/REMOTE-DEPLOYMENT.md).

### Démo publique Cloudflare Workers

Une configuration séparée `demo` est prévue pour publier uniquement les fixtures anonymisées. Le dashboard l’indique explicitement et aucun secret Intervals.icu n’est utilisé :

```bash
npm run deploy:demo
```

Sans compte Cloudflare authentifié, `npm run deploy:temporary` crée une prévisualisation réclamable. Cette URL est adaptée à une démonstration, pas à un hébergement durable. Ne jamais remplacer `DATA_SOURCE=fixtures` par `intervals` dans l’environnement public avant d’avoir implémenté et testé l’authentification du jalon B.

## Prérequis et installation

- Node.js 20 ou plus récent ;
- npm ;
- aucun compte Cloudflare nécessaire pour les tests et le développement local.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Par défaut, `.dev.vars.example` utilise `DATA_SOURCE=fixtures`. Les données sont anonymisées et recalées sur la date locale courante afin que les outils retournent immédiatement un exemple utile.

Wrangler affiche normalement l’adresse `http://localhost:8787`. Le point MCP est :

```text
http://localhost:8787/mcp
```

Le dashboard local est disponible sur `http://localhost:8787/`. Il charge par défaut 42 jours et permet de basculer entre 14, 28 et 42 jours. Il affiche notamment une courbe quotidienne fitness (CTL), fatigue (ATL) et forme (`CTL - ATL`) sur la période choisie. Son endpoint JSON interne est `GET /api/dashboard?historyDays=42`. La clé Intervals.icu reste côté Worker et n’est jamais envoyée au navigateur.

Les métriques avancées sont affichées uniquement lorsqu’elles existent : VO₂ max avec date et couverture, FTP modélisée, TRIMP, charge cardiaque et facteur d’efficacité. Une couverture insuffisante est indiquée explicitement ; le connecteur ne complète pas les valeurs par une estimation maison.

## Utiliser de vraies données Intervals.icu

1. Ouvrir les paramètres Intervals.icu (`/settings`). La clé API personnelle se trouve dans la section développeur/API vers le bas de la page. Cette clé est un mot de passe : ne jamais la publier.
2. Pour ses propres données, `INTERVALS_ATHLETE_ID=0` est accepté par l’API actuelle. Un identifiant explicite apparaît aussi dans Intervals.icu pour les comptes autorisés à consulter plusieurs athlètes.
3. Copier l’exemple local si ce n’est pas déjà fait : `cp .dev.vars.example .dev.vars`.
4. Modifier uniquement le fichier non versionné `.dev.vars` :

```dotenv
DATA_SOURCE=intervals
INTERVALS_ATHLETE_ID=0
INTERVALS_API_KEY=remplacer-localement
DEFAULT_TIMEZONE=Europe/Paris
MAX_HISTORY_DAYS=42
NODE_ENV=development
```

Ne collez jamais la clé dans une issue GitHub, un message, une capture d’écran ou un fichier suivi par Git. L’application produit une erreur explicite au démarrage d’une requête si l’un des deux identifiants manque en mode réel.

### Connecter Garmin à Intervals.icu

Le chemin habituel est `appareil Garmin → Garmin Connect → Intervals.icu` :

1. Vérifier que l’activité est visible dans Garmin Connect.
2. Dans Intervals.icu, ouvrir **Settings → Connections → Garmin Connect**.
3. Autoriser la connexion et activer le téléchargement des activités et, si désiré, des données de bien-être disponibles.
4. Éviter d’activer plusieurs imports équivalents (par exemple Garmin et Strava) sans vérifier la déduplication.

La disponibilité de sommeil, VFC et autres données dépend de ce que Garmin transmet effectivement à Intervals.icu.

### Connecter ROUVY à Intervals.icu

ROUVY propose une intégration directe :

1. Ouvrir le portail Riders ROUVY.
2. Aller dans **Profile → Connected Apps and Devices → Connected Apps**.
3. Choisir **Intervals.icu**, cliquer sur **Connect**, puis autoriser l’accès côté Intervals.icu.
4. Choisir la synchronisation automatique ou manuelle et aligner le fuseau horaire des deux services.

Les sorties ROUVY terminées sont alors envoyées à Intervals.icu. Référence : [ROUVY and Intervals.icu](https://support.rouvy.com/hc/en-us/articles/35523188955793-ROUVY-and-Intervals-icu).

## Tester avec MCP Inspector

Dans un premier terminal :

```bash
npm run dev
```

Dans un second terminal :

```bash
npx @modelcontextprotocol/inspector
```

Dans l’interface Inspector, sélectionner **Streamable HTTP**, saisir `http://localhost:8787/mcp`, se connecter, puis utiliser **List tools**. Tester chaque outil avec `{}` puis avec des bornes invalides. Aucune authentification MCP n’est activée au jalon A : ce serveur doit rester local.

## Outils MCP

Les trois outils de consultation portent les annotations `readOnlyHint: true`, `destructiveHint: false` et `openWorldHint: false`. Les deux outils d’écriture sont explicitement signalés comme tels au client MCP et exigent `confirmed: true`.

### `get_week_summary`

Entrée :

```json
{ "startDate": "2026-09-08", "endDate": "2026-09-14" }
```

Les dates sont optionnelles. La valeur par défaut couvre les sept derniers jours calendaires, aujourd’hui inclus, dans `DEFAULT_TIMEZONE`. Les dates futures sont refusées. La sortie contient durée, séances, distance, dénivelé, charge, agrégation par sport, répartition d’intensité lorsque disponible, activités compactes et couverture des métriques.

### `get_recovery_summary`

Entrée : `{ "days": 7 }`, avec un entier de 3 à 42.

La sortie compare la période avec la fenêtre précédente de même longueur. La moyenne ignore les absences. Une tendance est `unknown` si la période actuelle ou sa référence couvre moins de 60 % des jours. Le seuil de variation initial de 5 % est une **règle produit**, pas une règle médicale. Pour le sommeil, le score est préféré lorsqu’il est suffisamment couvert ; la durée est utilisée sinon, sans fabriquer de score.

Lorsque Intervals.icu les fournit, `loadDynamics` expose également les métriques avancées du modèle de charge : fitness (CTL), fatigue (ATL), forme (`fitness - fatigue`), ratio aiguë/chronique (`fatigue / fitness`), ramp rate et variation sur sept jours. Le connecteur utilise les valeurs calculées par Intervals.icu au lieu de reconstruire approximativement leur historique. Ces nombres décrivent la charge d’entraînement ; ils ne constituent ni un diagnostic, ni une prédiction de blessure, ni à eux seuls une recommandation de séance.

### `get_training_context`

Entrée :

```json
{ "historyDays": 14, "includeUpcomingCalendar": true, "calendarDays": 28 }
```

`historyDays` et `calendarDays` acceptent 7 à 42 jours. Cet outil principal regroupe activités, récupération, qualité globale, fraîcheur et, par défaut, séances planifiées sur les 28 jours suivants. Les métriques propriétaires non garanties figurent explicitement dans `missingMetrics`.

Le bloc `performance`, inspiré de l’approche de consolidation d’Elevate, fournit une vue compacte pour l’IA : série hebdomadaire sur toute la période (jusqu’à six semaines), cumul glissant des sept derniers jours, comparaison avec les sept jours précédents, variations en pourcentage, jours actifs et séances par semaine, durée moyenne et maximale, charge hebdomadaire moyenne et part de chaque sport. La comparaison est absente si moins de quatorze jours d’historique ont été demandés ; les sommes partielles restent accompagnées de leur couverture de charge.

### `record_daily_check_in`

Enregistre dans le wellness Intervals.icu la fatigue du jour et, facultativement, les courbatures, le stress et la motivation sur une échelle de 1 à 10. La date est déterminée côté serveur avec `DEFAULT_TIMEZONE`. L’outil doit être appelé uniquement après confirmation explicite des valeurs, puis le contexte doit être relu avant toute proposition d’adaptation.

### `publish_training_plan`

Crée ou met à jour jusqu’à 14 séances confirmées dans le calendrier Intervals.icu, sur un horizon maximal de 42 jours. Chaque séance utilise un `external_id` préfixé par `athlete-ai:`. Le connecteur ne peut donc modifier par upsert que les séances qu’il gère lui-même ; les événements manuels et ceux d’autres applications ne sont pas ciblés. La description accepte la syntaxe native des entraînements Intervals.icu.

Flux attendu pour une adaptation quotidienne : l’utilisateur décrit son état, l’IA lit le contexte, affiche les changements proposés, attend une confirmation explicite, enregistre le check-in, publie les séances révisées puis relit le contexte. Le dashboard s’actualise automatiquement chaque minute lorsqu’il est visible et reste actualisable manuellement.

## Données volontairement exclues

Les sorties sont reconstruites par liste blanche. Elles n’incluent jamais :

- latitude, longitude, départ, arrivée, adresse ou localisation ;
- carte, trace, route, itinéraire ou polyline ;
- nom ou description libre d’une activité ou d’un événement ;
- fichier FIT, GPX, TCX, ZIP ou flux seconde par seconde ;
- corps fournisseur brut ;
- cookie, en-tête, jeton ou clé ;
- identifiant Garmin, information menstruelle/de grossesse ou paiement.

Les identifiants réels d’activité sont également omis des sorties MCP. Le filtre est couvert par un test récursif anti-GPS et anti-secret.

## Données manquantes et limites

Intervals.icu ne garantit pas les métriques propriétaires Garmin suivantes : Training Readiness, temps de récupération Garmin, statut d’entraînement, charge aiguë/Load Focus et Endurance Score. Le connecteur ne les invente pas et les retourne dans `missingMetrics`. Les propriétés partielles restent absentes ; `0` reste une vraie valeur.

Intervals.icu peut également refuser de restituer via son API les activités dont la source est Strava. Le connecteur ne traite pas ces réponses comme une panne : il ignore les enregistrements incomplets et renseigne `dataQuality.unavailableActivityCount`. Pour analyser les séances, privilégier une synchronisation directe Garmin ou ROUVY vers Intervals.icu plutôt qu’un import uniquement issu de Strava.

La classification d’intensité du MVP utilise les seuils produits `≤ 65`, `> 65 à 85`, `> 85` sur `icu_intensity`. Elle est fournie uniquement lorsque cette métrique existe. Les événements de calendrier ne contiennent ni nom ni description libre.

## Configuration

| Variable | Défaut | Règle |
|---|---:|---|
| `DATA_SOURCE` | `fixtures` | `fixtures` ou `intervals` |
| `INTERVALS_API_KEY` | aucun | obligatoire en mode `intervals` |
| `INTERVALS_ATHLETE_ID` | aucun | obligatoire en mode `intervals` ; `0` pour soi-même |
| `DEFAULT_TIMEZONE` | `Europe/Paris` | fuseau IANA valide |
| `MAX_HISTORY_DAYS` | `42` | entier, maximum absolu `90` |
| `NODE_ENV` | `development` | `development`, `test` ou `production` |

## Qualité et commandes

```bash
npm test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
```

`npm run build` effectue un bundle Wrangler en mode `--dry-run` : il ne déploie rien.

## Rotation ou révocation de la clé Intervals.icu

1. Arrêter le Worker local.
2. Révoquer/régénérer la clé depuis les paramètres Intervals.icu.
3. Remplacer la valeur uniquement dans `.dev.vars` ou, au jalon B, dans le magasin de secrets Cloudflare.
4. Redémarrer et vérifier un appel local.
5. Si une clé a pu fuiter, la considérer compromise, la révoquer immédiatement et examiner l’historique Git avant toute publication.

## Security checklist before remote deployment

- [ ] Choisir et configurer un fournisseur OAuth 2.1 établi.
- [ ] Publier les métadonnées de ressource protégée RFC 9728.
- [ ] Exiger Authorization Code + PKCE S256 et une audience `resource` exacte.
- [ ] Vérifier signature, issuer, audience, expiration et scopes à chaque requête.
- [ ] Associer l’identité authentifiée à l’athlète autorisé côté serveur.
- [ ] Retourner les challenges `WWW-Authenticate` et MCP appropriés.
- [ ] Stocker la clé Intervals.icu avec `wrangler secret`, jamais dans `vars`.
- [ ] Vérifier que les logs ne contiennent ni requête, ni réponse, ni donnée sportive.
- [ ] Ajouter tests d’authentification, révocation et séparation entre utilisateurs.
- [ ] Effectuer une revue de sécurité et de confidentialité avant exposition publique.

## Références techniques

- [OpenAI — Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI — Authentication](https://developers.openai.com/plugins/build/auth)
- [Cloudflare — MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/)
- [Intervals.icu — Open API](https://www.intervals.icu/features/open-api/)

## Licence

[MIT](LICENSE)
