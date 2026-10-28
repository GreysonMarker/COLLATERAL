# Collateral on Render

Run with Node 24: `node render/server.mjs`. Render supplies PORT and RENDER_EXTERNAL_URL.
Run verification with `node render/check.mjs`.

Create a free Node web service from the repository, build command `node --check render/server.mjs`, start command `node render/server.mjs`, health check `/healthz`, NODE_VERSION `24.22.1`.

The existing game and room protocol are served together. Room data is temporary in-memory SQLite: rooms reset when the free service sleeps, restarts, or redeploys. No saved accounts or persistent progress are stored. All game assets and API requests use this host; the Open Game link is rewritten to this deployment.

After deployment, verify health, create and join a room, and test the live game before replacing the Google Sites embed with the returned Render address.
