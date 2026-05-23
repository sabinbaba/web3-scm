# Docker Setup

This project can run the Fabric network, backend API, and frontend UI through Docker Compose.

## Start Everything

From the repository root:

```bash
cd beer-network
./start-network.sh
```

The script starts the Compose stack, creates and joins `beerchannel`, installs the `beer` chaincode, approves it for each org, and commits it.

Frontend:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:3001/health
```

## Build App Images Only

```bash
cd beer-network
docker compose build beer-backend beer-frontend
```

## Start Compose Stack Without Lifecycle Commands

Use this only after the channel and chaincode lifecycle have already been set up:

```bash
cd beer-network
docker compose up -d
```

## Stop Everything

```bash
cd beer-network
docker compose down
```

To also remove the backend SQLite volume:

```bash
docker compose down -v
```

## Notes

- The frontend container serves the production React build with Nginx and proxies `/api` to `beer-backend:3001`.
- The backend container uses `FABRIC_CONNECTION_MODE=docker`, so it connects to Fabric peers by Docker service name instead of `localhost`.
- The backend SQLite database is persisted in the `backend_data` Docker volume.
- Fabric chaincode installation requires access to the host Docker socket because Fabric builds and runs the chaincode container.
