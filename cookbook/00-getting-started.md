# Getting Started with Block Watcher

Welcome to Block Watcher! This guide helps new developers understand the project and get up to speed.

## What is Block Watcher?

Block Watcher is a NestJS application that monitors Ethereum blocks, stores them in PostgreSQL, and exposes REST endpoints with complete observability.

**Key Features:**
- Watches Ethereum blockchain blocks
- Stores block data in PostgreSQL
- REST API with Swagger documentation
- Prometheus metrics for monitoring
- Health checks for liveness/readiness
- Full Kubernetes deployment

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Block Watcher App                     │
│                     (NestJS)                            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │  EVM Blocks  │  │   Metrics    │  │   Health     ││
│  │   Module     │  │   Module     │  │   Module     ││
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘│
│         │                  │                           │
│         ▼                  ▼                           │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │  Prisma ORM  │  │  Prom-Client │                  │
│  └──────┬───────┘  └──────────────┘                  │
│         │                                              │
└─────────┼──────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────┐
  │  PostgreSQL   │
  │   Database    │
  └───────────────┘
```

## Project Structure

```
block-watcher/
├── src/                      # Application source code
│   ├── main.ts              # Application entry point
│   ├── app.module.ts        # Root module
│   ├── evm-blocks/          # Blockchain watching logic
│   ├── metrics/             # Prometheus metrics
│   ├── health/              # Health checks
│   ├── prisma/              # Database service
│   └── rpc/                 # RPC client
│
├── prisma/                   # Database schema
│   └── schema.prisma        # Prisma schema definition
│
├── test/                     # Tests
│   ├── *.spec.ts            # Unit tests
│   └── *.e2e.ts             # E2E tests
│
├── k8s/                      # Kubernetes manifests
│   ├── deployment.yaml      # App deployment
│   ├── postgres.yaml        # Database
│   ├── ingress.yaml         # Public access
│   └── *.sh                 # Deployment scripts
│
├── cookbook/                 # Documentation (you are here!)
│   ├── 00-getting-started.md
│   ├── 01-local-development.md
│   ├── 02-kubernetes-deployment.md
│   └── ...
│
├── Dockerfile               # Production Docker image
├── package.json             # Dependencies & scripts
└── .env.example             # Environment variables template
```

## Tech Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Modern ORM for PostgreSQL
- **Prom-client** - Prometheus metrics
- **Viem** - Ethereum library

### Database
- **PostgreSQL** - Relational database

### Observability
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards & visualization
- **Alertmanager** - Alert routing

### Infrastructure
- **Kubernetes (K3s)** - Container orchestration
- **Docker** - Containerization
- **Helm** - Kubernetes package manager

## Quick Start Journey

### Step 1: Understand the Basics (30 min)
Read these files in order:
1. This file (you're here!)
2. `01-local-development.md` - Run locally
3. `03-configuration.md` - Environment setup

### Step 2: Local Development (1 hour)
```bash
# Install dependencies
npm install

# Setup database (Docker)
docker-compose up -d postgres

# Run migrations
npx prisma migrate dev

# Start development server
npm run start:dev

# View API docs
open http://localhost:3000/docs
```

### Step 3: Explore the Code (2 hours)
1. **Read the source:**
   - `src/main.ts` - Entry point, app setup
   - `src/app.module.ts` - Module organization
   - `src/evm-blocks/` - Core blockchain logic
   - `src/metrics/` - Metrics implementation

2. **Run the tests:**
   ```bash
   npm test              # Unit tests
   npm run test:e2e      # E2E tests
   npm run test:cov      # Coverage
   ```

3. **Try the API:**
   ```bash
   # Check health
   curl http://localhost:3000/api/health/liveness
   
   # View metrics
   curl http://localhost:3000/api/metrics
   
   # API documentation
   open http://localhost:3000/docs
   ```

### Step 4: Understand Observability (1 hour)
Read: `04-observability.md`

Key concepts:
- **Metrics** - Application performance data
- **Health checks** - Liveness and readiness probes
- **Logging** - Structured logs with Pino
- **Dashboards** - Grafana visualization
- **Alerts** - Prometheus alerting rules

### Step 5: Kubernetes Deployment (2 hours)
Read: `02-kubernetes-deployment.md`

Learn:
- Local testing with Docker Desktop
- Production deployment to Ubuntu server
- Database persistence
- Public access via Ingress
- Secrets management

## Key Concepts

### 1. Application Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/docs` | Swagger API documentation |
| `/api/metrics` | Prometheus metrics |
| `/api/health/liveness` | Pod liveness check |
| `/api/health/readiness` | Pod readiness check |
| `/api/evm-blocks/*` | Blockchain data endpoints |

### 2. Environment Variables

Essential variables (see `.env.example`):
```env
DATABASE_URL=postgresql://user:password@host:5432/db
NODE_ENV=development
PORT=3000
```

All variables in `.env` are automatically loaded in Kubernetes.

### 3. Database Schema

```prisma
model EvmBlock {
  id         BigInt @id @default(autoincrement())
  chainId    Int
  number     BigInt
  hash       String
  parentHash String
  timestamp  BigInt
  
  @@unique([chainId, number])
  @@unique([chainId, hash])
}
```

### 4. Metrics Collected

- **HTTP requests** - Count, latency by route/method
- **Node.js metrics** - Memory, CPU, event loop
- **Custom metrics** - Business-specific metrics
- **Database metrics** - Connection pool, queries

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes**
   - Write tests first (TDD)
   - Follow existing code patterns
   - Update documentation

3. **Test locally**
   ```bash
   npm test
   npm run test:e2e
   npm run start:dev
   ```

4. **Deploy to local Kubernetes**
   ```bash
   ./dev-local.sh
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/my-feature
   ```

### Database Changes

1. **Update Prisma schema**
   ```prisma
   // prisma/schema.prisma
   model NewTable {
     id Int @id @default(autoincrement())
     name String
   }
   ```

2. **Create migration**
   ```bash
   npx prisma migrate dev --name add_new_table
   ```

3. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

4. **Test migration**
   ```bash
   npm run test:e2e
   ```

### Adding New Metrics

1. **Define metric in service**
   ```typescript
   // src/metrics/metrics.service.ts
   private myMetric = new Counter({
     name: 'my_metric_total',
     help: 'Description of my metric'
   });
   ```

2. **Use in your code**
   ```typescript
   this.metricsService.myMetric.inc();
   ```

3. **Test metric appears**
   ```bash
   curl http://localhost:3000/api/metrics | grep my_metric
   ```

## Common Tasks

### Run locally
```bash
npm run start:dev
```

### Run tests
```bash
npm test
npm run test:cov
```

### Build Docker image
```bash
docker build -t block-watcher:local .
```

### Deploy to local Kubernetes
```bash
./dev-local.sh
```

### View logs in Kubernetes
```bash
kubectl logs -l app=block-watcher -n block-watcher -f
```

### Access database
```bash
# Local
psql postgresql://postgres:password@localhost:5432/blockwatcher

# Kubernetes
kubectl exec -it -n block-watcher deployment/postgres -- psql -U postgres blockwatcher
```

### Reset database
```bash
npx prisma migrate reset
```

## Troubleshooting

### App won't start locally
```bash
# Check database is running
docker ps | grep postgres

# Check environment variables
cat .env

# Check dependencies
npm install
```

### Tests failing
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Reset test database
npm run test:e2e:cov
```

### Kubernetes deployment fails
```bash
# Check pods
kubectl get pods -n block-watcher

# Check logs
kubectl logs -l app=block-watcher -n block-watcher

# Check secrets
kubectl get secrets -n block-watcher
```

## Next Steps

Now that you understand the basics, dive deeper:

1. **[Local Development](01-local-development.md)** - Setup your dev environment
2. **[Kubernetes Deployment](02-kubernetes-deployment.md)** - Deploy to production
3. **[Configuration](03-configuration.md)** - Environment variables & secrets
4. **[Observability](04-observability.md)** - Monitoring & alerting
5. **[Kubernetes Reference](05-kubernetes-reference.md)** - Kubernetes manifests

## Getting Help

- **Documentation**: Read files in `cookbook/`
- **Code**: Check inline comments and tests
- **API Docs**: http://localhost:3000/docs
- **Logs**: `kubectl logs -l app=block-watcher -n block-watcher -f`

## Contributing

When adding features:
1. Write tests first
2. Follow TypeScript best practices
3. Add metrics where appropriate
4. Update documentation
5. Test in Kubernetes before merging

Welcome to the team! 🚀
