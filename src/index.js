
const Fastify = require('fastify');
const fastify = Fastify({ logger: true });
const { exec } = require('child_process');
const path = require('path');
const fastifyStatic = require('@fastify/static');
const fastifyMultipart = require('@fastify/multipart')
const { fileURLToPath } = require('url');
const HOST="0.0.0.0";
const PORT= 3004;
const traps = require('@dnlup/fastify-traps')
const fs = require('fs')


fastify.register(require('@fastify/cors'), {
  origin: '*' //  affiner si besoin pour plus de securiteé
});
// POUR VERSION SEND FICHIER
// Enregistrement du plugin avec le dossier contenant vos fichiers publics
fastify.register(fastifyStatic, {
  root: '/opt/server-api/backups',
  prefix: '/opt/server-api/backups/', // Optionnel : préfixe pour vos URL (ex: /public/mon-fichier.pdf)
});


fastify.get('/', function (request, reply) {
  reply
    .code(200)
    .send({ statut:"OK" })
})

fastify.get('/backup', async (request, reply) => {
  try {
    // Use an absolute, validated path to avoid command injection
    const scriptPath = path.resolve('/opt/server-api/src/save.sh');

// Execute the script
    return await new Promise ((resolve, reject) => {
      exec(`bash "${scriptPath}"`, { timeout: 60_000 }, (error, stdout, stderr) => {
        if (error) {
          // Log and reject on error
          fastify.log.error(error);
          return reject(reply.code(500).send({ error: 'Backup failed', details: stderr || error.message }));
        }
const nomFichier = 'datas.tar.gz';

// POUR VERSION SEND FICHIER
  // Optionnel : Forcer le navigateur à télécharger le fichier plutôt qu'à essayer de l'ouvrir
  //reply.header('Content-Disposition', `attachment; filename="${nomFichier}"`);

  // Définir le bon type MIME pour une archive .tar.gz
  reply.type('application/json');
  //const filePath = '/opt/server-api/backups/datas.tar.gz';
 // reply.send(fs.createReadStream(filePath)); //pour gladys
  // Envoyer le fichier (le chemin est relatif au dossier 'root' défini plus haut)
    //return reply.sendFile(nomFichier);


 reply.send({ lien: "192.168.1.131:3004/opt/server-api/datas.tar.gz" });
});
  });
  }
  catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Unexpected server error' });
  }
});

fastify.get('/script/:interpreteur/:name', function (request, reply) {
  // curl ${app-url}/example/12345
  // userId === '12345'
   try {
  const { interpreteur,name } = res.params;
    if (!interpreteur || !name) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }
      // Respond with extracted parameters
        res.json({
            message: 'Parameters received successfully.',
            interpreteur: interpreteur,
            name: name
        });  
  } catch (err) {
        console.error('Error handling request:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }        

})

fastify.register(traps, {
  timeout: 5000 // wait 5 second before forcing exiting
})
fastify.get('/stop', (request, reply) => {
  reply.send({ ok: true })
})
const start = async () => {
  try {
    await fastify.listen({ host: HOST, port: PORT });
    console.log('Fastify file upload server running on http://localhost:3004');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
