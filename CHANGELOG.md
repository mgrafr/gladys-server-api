# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- The `server-api` sub-container (`mgrafr/server-api:v4`), started by the
  integration once its `save.sh` script is in place.
- **Back up the databases** action, in the Configuration screen and in the
  scene editor (outputs: download link and archive size).
- **Test the API server** action.
- **Last backup** dashboard widget: date, size and download link of the last
  backup, and a button to run a new one.
- An external server-api (run with docker compose, the Gladys data folder
  mounted) can replace the sub-container.

[Unreleased]: https://github.com/mgrafr/gladys-server-api/commits/main
