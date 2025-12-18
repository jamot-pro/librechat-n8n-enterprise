# Deployment Guide for LibreChat (with Managed n8n)

This guide will help you deploy the LibreChat backend, MongoDB, and supporting services using Docker Compose. n8n workflows are managed externally at https://nadyaputriast-n8n.hf.space.

---

## 1. Clone the Repository

```
git clone <your-repo-url>
cd librechat-n8n-enterprise
```

## 2. Environment Setup

- Copy `.env.example` to `.env` and fill in the required environment variables (MongoDB URI, ports, etc.).
- Adjust `librechat.yaml` or other config files if needed.
- **Important:** Ensure your `.env` contains:
  ```
  VITE_N8N_WEBHOOK_URL=https://nadyaputriast-n8n.hf.space
  ```

## 3. Start Services with Docker Compose

Make sure Docker and Docker Compose are installed.

```
docker compose up -d
```

This will start all services: LibreChat API, MongoDB, Meilisearch, RAG API, etc.

## 4. n8n Workflows (Managed Externally)

- All n8n workflows are managed at https://nadyaputriast-n8n.hf.space.
- **You do NOT need to run or import n8n workflows locally.**
- LibreChat will communicate with n8n via the webhook URL set in your `.env`.

## 5. Access the Application

- LibreChat API: http://localhost:3080 (or your configured port)

## 6. Customization (Optional)

- Update environment variables, ports, or volumes as needed in `docker-compose.yml` or override files.

## 7. Troubleshooting

- Check logs with:
  ```
  docker compose logs
  ```
- Make sure all services are running:
  ```
  docker compose ps
  ```
- Review the `logs/` directory for application logs.

---