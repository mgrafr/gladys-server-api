# Server API

This integration backs up the Gladys databases with
[server-api](https://github.com/mgrafr/server-api), a Node.js (Fastify)
server: calling `http://<Gladys IP>:<port>/backup` runs its `save.sh`
script, which archives the Gladys data folder into `datas.tar.gz`.

## What you get

- The **server-api** container (`mgrafr/server-api:v4`), installed and
  started by the integration.
- The **Back up the databases** action, in the Configuration screen and in
  the scene editor.
- The **Test the API server** action.
- The **Last backup** dashboard widget.

## Important: access to the Gladys data

For its own safety, Gladys does **not** let an integration container read the
host folder `/var/lib/gladysassistant`: the volumes of a sub-container always
come from the integration's own folder. The container started by the
integration works, but **the archive it produces does not hold your
databases**. The widget and the action message say so ("Gladys data not
mounted").

For a real backup, run server-api yourself on the host, with the data folder
mounted, then fill in its URL in the configuration:

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

The host folder `/opt/server-api/src` must hold
[`save.sh`](https://github.com/mgrafr/server-api/blob/main/src/save.sh).

## Configuration

1. **External server URL**: leave it empty to use the integration's
   container, or give the server started above, e.g.
   `http://192.168.1.5:3004`. The integration then stops its own container.
2. **Gladys IP address**: the address your browser uses to reach Gladys on
   the LAN (e.g. `192.168.1.5`). It builds the download link of the widget
   when the integration's container is used: Gladys picks the port, the
   widget appends it.
3. **Time zone**: for the date shown (`Europe/Paris` by default).

## Actions

- **Back up the databases**: runs the backup (up to 2 minutes) and shows the
  archive size and its download link.
- **Test the API server**: checks that server-api answers.

## Scenes

The **Back up the databases** action is also available in the scene editor
(**Integrations** category): pair it with a time trigger for a daily backup.
The following actions can read the download link and the archive size.

## Dashboard

Add the **Last backup** widget: it shows the date and size of the last
backup, its download link, and a **Back up now** button to run a new one.
The link is `http`: Gladys only allows clickable `https` links in a widget,
copy it into your browser.

## Troubleshooting

- **HTTP 500 on backup**: check the logs of the server-api container and
  `backups/backup.log`.
- **No link in the widget**: fill in the Gladys IP address.
- The `mgrafr/server-api:v4` image is only published for `amd64`: it does
  not start on a Raspberry Pi (`arm64`).
