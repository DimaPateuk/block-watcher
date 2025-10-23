# Block Watcher

NestJS application that monitors Ethereum blocks with complete observability stack.

## Quick Start

### 🏠 Local Development with Kubernetes

```bash
# 1. Install prerequisites: Docker, kubectl, and one of: kind/minikube/k3d
brew install kind  # or: minikube, k3d

# 2. Copy and configure .env
cp .env.example .env
# Edit .env with your Ethereum RPC URL

# 3. Run the local development script
./dev-local.sh
```

Access at: http://localhost:8080 | Grafana: http://localhost:3001

### 🚀 Production Deployment

SSH into your server and run:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd block-watcher

# 2. Create .env file with production config
cp .env.example .env
nano .env  # Add your config

# 3. Run production deployment
./deploy-production.sh
```

The script will:
- ✅ Build Docker image
- ✅ Deploy PostgreSQL with persistent storage
- ✅ Deploy application
- ✅ Install Prometheus, Grafana, Alertmanager
- ✅ Configure monitoring and alerts

### Need Help?
**→ Check [cookbook/07-troubleshooting.md](cookbook/07-troubleshooting.md)**

## Features

- 📊 REST API with Swagger documentation
- 🔍 Prometheus metrics for monitoring
- 💊 Health checks for Kubernetes
- 🐳 Docker containerization
- ☸️ Kubernetes deployment
- 📈 Grafana dashboards
- 🚨 Alertmanager notifications
- 💾 Persistent database storage

## Quick Commands

```bash
# Local Development with Kubernetes
./dev-local.sh

# Production Deployment (run on server)
./deploy-production.sh

# View Logs
kubectl logs -f -l app=block-watcher -n block-watcher

# Rebuild and Update (local)
docker build -t block-watcher:local .
kind load docker-image block-watcher:local --name block-watcher-dev
kubectl rollout restart deployment/block-watcher -n block-watcher

# Update Production (run on server)
git pull && ./deploy-production.sh
```

## Documentation

**All documentation is in [cookbook/](cookbook/)**

- [Getting Started](cookbook/00-getting-started.md)
- [Local Development](cookbook/01-local-development.md)
- [Kubernetes Deployment](cookbook/02-kubernetes-deployment.md)
- [Configuration](cookbook/03-configuration.md)
- [Observability](cookbook/04-observability.md)
- [Troubleshooting](cookbook/07-troubleshooting.md)

## Tech Stack

**Backend**: NestJS, TypeScript, Prisma, PostgreSQL  
**Observability**: Prometheus, Grafana, Alertmanager  
**Infrastructure**: Kubernetes (K3s), Docker, Helm
