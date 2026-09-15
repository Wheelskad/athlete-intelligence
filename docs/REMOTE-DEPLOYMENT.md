# Jalon B — déploiement distant sécurisé

Ce document est une préparation, pas une implémentation. Le jalon A ne doit pas être exposé sur Internet : il accepte les appels MCP locaux sans identité utilisateur. En `NODE_ENV=production`, le Worker refuse `/mcp` tant que la couche d’authentification n’existe pas.

## Démo publique sans données personnelles

L’environnement Wrangler `demo` utilise exclusivement `DATA_SOURCE=fixtures`. Il peut être déployé sur le plan gratuit pour présenter le dashboard et le contrat MCP :

```bash
npm run deploy:demo
```

Une prévisualisation réclamable peut aussi être créée sans connexion préalable avec `npm run deploy:temporary`. Elle ne doit contenir ni `INTERVALS_API_KEY`, ni `INTERVALS_ATHLETE_ID`. Le dashboard affiche « Données de démonstration » afin d’éviter toute confusion avec les séances de l’athlète.

## Architecture cible

Utiliser un fournisseur d’identité OAuth 2.1 reconnu ou la bibliothèque OAuth Provider de Cloudflare correctement configurée avec un fournisseur reconnu. Ne pas construire un serveur d’autorisation artisanal.

Le Worker devient le **resource server** MCP et doit :

1. publier `/.well-known/oauth-protected-resource` avec son URL HTTPS canonique, le serveur d’autorisation et les scopes en lecture ;
2. annoncer un scope minimal, par exemple `athlete:read`, sur chacun des trois outils ;
3. retourner `401` avec `WWW-Authenticate: Bearer resource_metadata="…"` lorsque l’identité manque ou échoue ;
4. retourner également `_meta["mcp/www_authenticate"]` dans les erreurs d’outil nécessitant la liaison OAuth ;
5. vérifier à chaque requête la signature via JWKS, `iss`, `aud`/`resource`, `exp`, `nbf` et les scopes ;
6. vérifier côté serveur que le sujet authentifié est autorisé à accéder à l’athlète configuré ;
7. ne jamais accepter un identifiant d’athlète libre envoyé par le modèle ;
8. conserver la clé Intervals.icu dans un secret Worker et ne jamais l’inclure dans un token OAuth.

Le serveur d’autorisation doit prendre en charge Authorization Code + PKCE `S256`, publier ses métadonnées, et gérer correctement CIMD, DCR ou un client pré-enregistré selon le mécanisme retenu. Le paramètre `resource` doit être conservé pendant le flux et apparaître dans le jeton comme audience vérifiable.

## Isolation et droits

Le MVP est mono-athlète. Avant un usage multi-utilisateur, remplacer la configuration globale par une résolution sécurisée `subject OAuth → athleteId autorisé → credential provider`, avec isolation stricte. Un stockage devient alors probablement nécessaire, mais aucune donnée de santé ni réponse Intervals.icu ne doit être placée dans l’état de transport MCP.

Les trois outils restent en lecture seule. Aucune permission Intervals.icu d’écriture ne doit être demandée. Les scopes OAuth MCP ne donnent jamais directement accès à la clé fournisseur.

## Validation avant ouverture

- tests négatifs : jeton absent, expiré, mauvaise signature, mauvais issuer, mauvaise audience, scope absent ;
- séparation de deux identités et prévention de l’énumération d’athlètes ;
- révocation et rotation des jetons et de la clé Intervals.icu ;
- vérification du challenge OAuth avec MCP Inspector puis ChatGPT developer mode ;
- audit des réponses, erreurs, journaux et métriques ;
- revue de la politique de confidentialité, rétention et suppression ;
- domaine HTTPS stable et procédure de rollback.

Références : [authentification MCP OpenAI](https://developers.openai.com/plugins/build/auth) et [autorisation MCP Cloudflare](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/).
