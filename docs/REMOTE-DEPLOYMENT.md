# Déploiement distant sécurisé

Le MCP distant est implémenté dans un Worker séparé du dashboard. Cette séparation garde le dashboard derrière Cloudflare Access tout en laissant les métadonnées OAuth du MCP accessibles à ChatGPT. L’endpoint `/mcp` reste protégé par jeton.

## Démo publique sans données personnelles

L’environnement Wrangler `demo` utilise exclusivement `DATA_SOURCE=fixtures`. Il peut être déployé sur le plan gratuit pour présenter le dashboard et le contrat MCP :

```bash
npm run deploy:demo
```

Une prévisualisation réclamable peut aussi être créée sans connexion préalable avec `npm run deploy:temporary`. Elle ne doit contenir ni `INTERVALS_API_KEY`, ni `INTERVALS_ATHLETE_ID`. Le dashboard affiche « Données de démonstration » afin d’éviter toute confusion avec les séances de l’athlète.

## Architecture déployable

Le projet utilise `@cloudflare/workers-oauth-provider` comme serveur OAuth 2.1 et Cloudflare Access for SaaS comme fournisseur OIDC amont. Le namespace KV `athlete-intelligence-oauth` ne stocke aucune donnée sportive.

Le Worker est le **resource server** MCP et :

1. publie `/.well-known/oauth-protected-resource/mcp` avec son URL HTTPS canonique, le serveur d’autorisation et le scope `athlete:access` ;
2. annonce ce scope dans les métadonnées de chacun des six outils ;
3. retourne `401` avec `WWW-Authenticate: Bearer resource_metadata="…"` lorsque l’identité manque ou échoue ;
4. retourne également `_meta["mcp/www_authenticate"]` dans les erreurs d’outil nécessitant la liaison OAuth ;
5. vérifier à chaque requête la signature via JWKS, `iss`, `aud`/`resource`, `exp`, `nbf` et les scopes ;
6. vérifier côté serveur que le sujet authentifié est autorisé à accéder à l’athlète configuré ;
7. ne jamais accepter un identifiant d’athlète libre envoyé par le modèle ;
8. conserver la clé Intervals.icu dans un secret Worker et ne jamais l’inclure dans un token OAuth.

Le serveur prend en charge Authorization Code + PKCE `S256`, CIMD et DCR de compatibilité. Il contrôle également CSRF, state signé à usage unique, nonce OIDC, signature JWKS, issuer, audience, expiration, e-mail autorisé et scope. Le paramètre `resource` est lié au grant et vérifié comme audience par la bibliothèque.

## Configuration Cloudflare Access for SaaS

1. Créer une application **SaaS → OIDC** nommée `Athlete Intelligence MCP`.
2. Utiliser `https://athlete-intelligence-mcp.alpine-lancer.workers.dev/callback` comme Redirect URL.
3. Activer les scopes d’identité `openid`, `email`, `profile` et PKCE.
4. Ajouter une politique Allow limitée à l’identité de l’athlète.
5. Copier Client ID, Client secret, Issuer, Token endpoint, Authorization endpoint et Key endpoint dans les secrets Worker correspondants.
6. Ajouter `AUTHORIZED_EMAILS`, `COOKIE_ENCRYPTION_KEY`, `INTERVALS_API_KEY` et `INTERVALS_ATHLETE_ID` comme secrets.
7. Déployer avec `npm run deploy:mcp`.

Le hostname du Worker MCP ne doit pas recevoir une règle Cloudflare Access globale : cela empêcherait ChatGPT de lire les routes `/.well-known/*`. L’authentification est effectuée dans le protocole OAuth du Worker.

## Isolation et droits

Le MVP est mono-athlète. Avant un usage multi-utilisateur, remplacer la configuration globale par une résolution sécurisée `subject OAuth → athleteId autorisé → credential provider`, avec isolation stricte. Un stockage devient alors probablement nécessaire, mais aucune donnée de santé ni réponse Intervals.icu ne doit être placée dans l’état de transport MCP.

Les quatre outils de consultation restent en lecture seule. Les deux écritures Intervals.icu sont limitées au check-in quotidien et aux séances explicitement confirmées. Les scopes OAuth MCP ne donnent jamais directement accès à la clé fournisseur.

## Validation avant ouverture

- tests négatifs : jeton absent, expiré, mauvaise signature, mauvais issuer, mauvaise audience, scope absent ;
- séparation de deux identités et prévention de l’énumération d’athlètes ;
- révocation et rotation des jetons et de la clé Intervals.icu ;
- vérification du challenge OAuth avec MCP Inspector puis ChatGPT developer mode ;
- audit des réponses, erreurs, journaux et métriques ;
- revue de la politique de confidentialité, rétention et suppression ;
- domaine HTTPS stable et procédure de rollback.

Références : [authentification MCP OpenAI](https://developers.openai.com/plugins/build/auth) et [autorisation MCP Cloudflare](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/).
