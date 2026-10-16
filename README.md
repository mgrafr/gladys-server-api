# gladys-server-api

Intégration externe [Gladys Assistant](https://gladysassistant.com) qui installe
le conteneur [server-api](https://github.com/mgrafr/server-api)
(`mgrafr/server-api:v4`, un serveur Fastify) et l'utilise pour sauvegarder les
bases de données de Gladys.

_English below._

## Fonctionnalités

- **Action « Sauvegarder les bases de données »** : appelle
  `http://<IP de Gladys>:<port>/backup` et affiche la taille de l'archive et
  son lien de téléchargement. Disponible aussi dans l'éditeur de scènes, pour
  une sauvegarde planifiée.
- **Action « Tester le serveur API »**.
- **Widget « Dernière sauvegarde »** : date, taille et URL de la dernière
  sauvegarde, et un bouton pour en lancer une nouvelle.

La documentation utilisateur est dans [`docs/fr.md`](./docs/fr.md) et
[`docs/en.md`](./docs/en.md). **Lisez la section sur l'accès aux données de
Gladys** : dans le bac à sable de Gladys, le conteneur de l'intégration ne peut
pas lire `/var/lib/gladysassistant`. Pour une vraie sauvegarde, lancez
server-api sur l'hôte et renseignez son URL dans la configuration.

## Fonctionnement

```
Gladys ──WebSocket── intégration (ce dépôt, ghcr.io/mgrafr/gladys-server-api)
                         │  écrit save.sh dans /data/containers/server-api/opt/server-api
                         │  startContainer('server-api')
                         └── GET http://server-api:3004/backup ──> conteneur server-api
                                                                   (mgrafr/server-api:v4)
```

- Le sous-conteneur `server-api` est déclaré dans le champ `containers` du
  manifest, avec `start: "manual"` et le volume `/opt/server-api`.
  L'intégration y dépose `src/save.sh` (l'image l'exécute depuis
  `/opt/server-api/src/save.sh` mais ne le contient pas), puis le démarre.
- L'intégration le joint par son alias DNS `server-api` sur le réseau privé.
  Gladys publie le port 3004 sur un port de l'hôte qu'il choisit lui-même, et
  le widget construit le lien avec ce port.
- L'archive est servie par server-api sur
  `/opt/server-api/backups/datas.tar.gz`. Le résultat de la dernière
  sauvegarde est mémorisé dans `/data/last-backup.json`.

```
index.js                          connexion du SDK
src/app.js                        handlers : actions, action de scène, widget, cycle de vie
src/serverApi.js                  pilotage de server-api (conteneur, /backup, état)
src/widgets.js                    contenu du widget last_backup
src/config.js                     configuration par défaut + normalisation
src/save.sh                       script de sauvegarde déposé dans le conteneur
gladys-assistant-integration.json manifest
```

## Développement

```bash
npm install
npm test               # node --test
npm run lint           # ESLint
npm run format:check   # Prettier
npx github:GladysAssistant/integration-store .   # contrôles du store
```

## Publication

Les workflows viennent du
[template officiel](https://github.com/GladysAssistant/integration-template-js) :

1. **Actions → Release** : choisissez la version. Le workflow met à jour
   `package.json`, le manifest et le `CHANGELOG.md`, crée le tag, puis
   construit et publie l'image `ghcr.io/mgrafr/gladys-server-api:<version>`
   (amd64 + arm64).
2. Rendez le paquet ghcr **public** (GitHub → Packages → Package settings) :
   Gladys le télécharge sans authentification.
3. Pour tester avant publication : **Intégrations → Installer une intégration
   → Mode développeur**, avec le manifest affiché dans le résumé du workflow
   _Build and publish image_.

Ne modifiez pas les versions à la main : c'est le rôle du workflow Release.

---

## English

A Gladys Assistant external integration that installs the
[server-api](https://github.com/mgrafr/server-api) container
(`mgrafr/server-api:v4`, a Fastify server) and uses it to back up the Gladys
databases: a **Back up the databases** action (also a scene action), a
**Test the API server** action and a **Last backup** dashboard widget showing
the date, size and download URL of the last backup. See
[`docs/en.md`](./docs/en.md), in particular the note on the access to the
Gladys data folder.
