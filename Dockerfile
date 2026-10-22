FROM node:24-alpine

USER root

# Create a directory for application data
RUN mkdir -p /app/backups


RUN chmod -R 777 /app/backups


RUN apk update && apk add bash  --no-cache bash
# Créer un utilisateur non-root pour exécuter Node.js


RUN addgroup -g 1001 nodegroup \
    && adduser -D -u 1001 -G nodegroup nodeuser
    
# Créer le dossier de l'application et donner les droits
WORKDIR /app
RUN chown -R nodeuser:nodegroup /app

# Copier les fichiers du projet
COPY --chown=nodeuser:nodegroup package*.json ./

# Installer les dépendances
USER nodeuser

RUN npm install --only=production

# Copier le reste du code
COPY --chown=nodeuser:nodegroup . .

# COPY src/save.sh /opt/server-api/src/save.sh
RUN chmod +x /app/src/save.sh


# Exposer le port de l'application
EXPOSE 3004


# Commande de démarrage
CMD ["node", "index.js"]
