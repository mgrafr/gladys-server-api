
const Fastify = require('fastify');
const fastify = Fastify({ logger: true });
const { exec } = require('child_process');
const path = require('path');
const fastifyStatic = require('@fastify/static');
const { fileURLToPath } = require('url');
const HOST="0.0.0.0";
const PORT= 3002;
const NAME= "Gladys";

// Enregistrement du plugin avec le dossier contenant vos fichiers publics
fastify.register(fastifyStatic, {
  root: '/opt/server-api/backups',
  prefix: '/opt/server-api/backups/', // Optionnel : préfixe pour vos URL (ex: /public/mon-fichier.pdf)
});

fastify.get('/', function (request, reply) {
  reply.send({ hello: "xxx" })
})

fastify.get('/backup', async (request, reply) => {
  try {
    // Use an absolute, validated path to avoid command injection
    const scriptPath = path.resolve('/opt/server-api/src/save.sh');

// Execute the script
    return await new Promise((resolve, reject) => {
      exec(`bash "${scriptPath}"`, { timeout: 60_000 }, (error, stdout, stderr) => {
        if (error) {
          // Log and reject on error
          fastify.log.error(error);
          return reject(reply.code(500).send({ error: 'Backup failed', details: stderr || error.message }));
        }
//        resolve(reply.code(200).send({ message: 'Backup completed', output: stdout.trim() }));

const nomFichier = 'datas.tar.gz';

  // Optionnel : Forcer le navigateur à télécharger le fichier plutôt qu'à essayer de l'ouvrir
  reply.header('Content-Disposition', `attachment; filename="${nomFichier}"`);
  
  // Définir le bon type MIME pour une archive .tar.gz
  reply.type('application/gzip');

  // Envoyer le fichier (le chemin est relatif au dossier 'root' défini plus haut)
  return reply.sendFile(nomFichier);
});
  });
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Unexpected server error' });
  }
});

fastify.listen({ host: HOST, port: PORT }, (err, address) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }
});
