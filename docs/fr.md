# Server API

Cette intégration sauvegarde les bases de données de Gladys grâce à
[server-api](https://github.com/mgrafr/server-api), un serveur Node.js
(Fastify) : l'appel `http://<IP de Gladys>:<port>/backup` lance le script
`save.sh`, qui archive le dossier de données de Gladys dans `datas.tar.gz`.

## Ce que vous obtenez

- Le conteneur **server-api** (`mgrafr/server-api:v4`), installé et démarré
  par l'intégration.
- L'action **Sauvegarder les bases de données**, dans l'écran de
  configuration et dans l'éditeur de scènes.
- L'action **Tester le serveur API**.
- Le widget **Dernière sauvegarde** pour le tableau de bord.

## Important : l'accès aux données de Gladys

Pour sa sécurité, Gladys ne laisse **pas** un conteneur d'intégration lire le
dossier de l'hôte `/var/lib/gladysassistant` : les volumes d'un sous-conteneur
viennent toujours du dossier propre à l'intégration. Le conteneur démarré par
l'intégration fonctionne donc, mais **l'archive qu'il produit ne contient pas
vos bases de données**. Le widget et le message de l'action le signalent
(« Données Gladys non montées »).

Pour une vraie sauvegarde, lancez server-api vous-même sur l'hôte, avec le
dossier de données monté, puis renseignez son URL dans la configuration :

```yaml
services:
  server-api:
    image: mgrafr/server-api:v4
    ports:
      - '3004:3004'
    volumes:
      - /opt/server-api:/opt/server-api
      - /var/lib/gladysassistant:/var/lib/gladysassistant:ro
    restart: unless-stopped
```

Le dossier `/opt/server-api/src` de l'hôte doit contenir
[`save.sh`](https://github.com/mgrafr/server-api/blob/main/src/save.sh).

## Configuration

1. **URL du serveur externe** : laissez vide pour utiliser le conteneur de
   l'intégration, ou indiquez le serveur lancé ci-dessus, par exemple
   `http://192.168.1.5:3004`. L'intégration arrête alors son propre conteneur.
2. **Adresse IP de Gladys** : l'adresse avec laquelle votre navigateur joint
   Gladys sur le réseau local (par exemple `192.168.1.5`). Elle sert à
   construire le lien de téléchargement du widget quand le conteneur de
   l'intégration est utilisé : Gladys choisit le port, le widget l'ajoute.
3. **Fuseau horaire** : pour l'affichage de la date (`Europe/Paris` par
   défaut).

## Actions

- **Sauvegarder les bases de données** : lance la sauvegarde (jusqu'à 2
  minutes) et affiche la taille de l'archive et son lien de téléchargement.
- **Tester le serveur API** : vérifie que server-api répond.

## Scènes

L'action **Sauvegarder les bases de données** est aussi disponible dans
l'éditeur de scènes (catégorie **Intégrations**) : combinez-la avec un
déclencheur horaire pour une sauvegarde quotidienne. Les actions suivantes
peuvent lire le lien de téléchargement et la taille de l'archive.

## Tableau de bord

Ajoutez le widget **Dernière sauvegarde** : il affiche la date et la taille
de la dernière sauvegarde, son lien de téléchargement, et un bouton
**Sauvegarder** pour en lancer une nouvelle. Le lien est en `http` : Gladys
n'autorise que les liens `https` cliquables dans un widget, copiez-le dans
votre navigateur.

## Dépannage

- **HTTP 500 sur la sauvegarde** : consultez les logs du conteneur
  server-api et `backups/backup.log`.
- **Pas de lien dans le widget** : renseignez l'adresse IP de Gladys.
- Le conteneur `mgrafr/server-api:v4` n'est publié que pour `amd64` : il ne
  démarre pas sur un Raspberry Pi (`arm64`).
