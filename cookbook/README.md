# Block Watcher Cookbook

Complete documentation for developing, deploying, and operating Block Watcher.

## Quick Navigation

### New to the Project?
**Start here** → [Getting Started](00-getting-started.md)

Follow this learning path:
1. [Getting Started](00-getting-started.md) - Understand the project (30 min)
2. [Local Development](01-local-development.md) - Run it locally (1 hour)
3. [Configuration](03-configuration.md) - Setup environment (30 min)
4. [Kubernetes Deployment](02-kubernetes-deployment.md) - Deploy to production (2 hours)

### Need Something Specific?

| Topic | Guide | Description |
|-------|-------|-------------|
| **Setup & Development** | [Local Development](01-local-development.md) | Running the app on your machine |
| **Configuration** | [Configuration](03-configuration.md) | Environment variables & secrets |
| **Deployment** | [Kubernetes Deployment](02-kubernetes-deployment.md) | Deploy to Kubernetes |
| **Monitoring** | [Observability](04-observability.md) | Metrics, logs, and alerts |
| **Reference** | [Kubernetes Reference](05-kubernetes-reference.md) | Detailed manifest docs |
| **Pre-Deployment** | [Production Checklist](06-production-checklist.md) | What to verify before launch |
| **Help!** | [Troubleshooting](07-troubleshooting.md) | Common problems and solutions |

## Documentation Structure

### Guides (Step-by-Step)

**[00-getting-started.md](00-getting-started.md)**
- Project overview
- Architecture
- Tech stack
- Quick start journey
- Key concepts

**[01-local-development.md](01-local-development.md)**
- Prerequisites installation
- Initial setup
- Development workflow
- Testing
- Debugging
- Common commands

**[02-kubernetes-deployment.md](02-kubernetes-deployment.md)**
- Deployment options (local/production)
- Architecture
- Database persistence
- Monitoring setup
- Scaling and updates

**[03-configuration.md](03-configuration.md)**
- Environment variables
- Kubernetes secrets
- Security best practices
- Managing configurations
- Production setup

**[04-observability.md](04-observability.md)**
- Metrics overview
- Prometheus setup
- Grafana dashboards
- Alertmanager configuration
- Custom metrics

### Reference Documents

**[05-kubernetes-reference.md](05-kubernetes-reference.md)**
- All Kubernetes manifests explained
- Deployment scripts
- Common patterns
- Resource management

**[06-production-checklist.md](06-production-checklist.md)**
- Pre-deployment verification
- Security checks
- Testing requirements
- Monitoring setup
- Post-deployment steps

**[07-troubleshooting.md](07-troubleshooting.md)**
- Application issues
- Database problems
- Kubernetes errors
- Network issues
- Performance problems
- Observability issues

## Common Workflows

### First Time Setup

```bash
# 1. Clone and install
git clone <repository>
cd block-watcher
npm ci

# 2. Setup database
docker run -d --name db -p 5432:5432 \
  -e POSTGRES_DB=blockwatcher \
  -e POSTGRES_PASSWORD=password \
  postgres:15-alpine

# 3. Configure environment
cp .env.example .env
vim .env

# 4. Run migrations
npx prisma migrate dev

# 5. Start development
npm run start:dev

# 6. View API docs
open http://localhost:3000/docs
```

**Full guide:** [Local Development](01-local-development.md)

### Deploy to Production

```bash
# 1. Configure deployment
cd k8s
./configure.sh
# Configure .env file

# 2. Deploy everything (on server)
ssh user@server
cd block-watcher
./deploy-production.sh
```

**Full guide:** [Kubernetes Deployment](02-kubernetes-deployment.md)

### Add New Feature

```bash
# 1. Create branch
git checkout -b feature/my-feature

# 2. Write test
# Edit: src/**/*.spec.ts

# 3. Implement feature
# Edit: src/**/*.ts

# 4. Test
npm test
npm run test:e2e

# 5. Test in Kubernetes
./dev-local.sh

# 6. Commit and push
git commit -m "feat: add feature"
git push
```

### Troubleshoot Issue

```bash
# 1. Check logs
kubectl logs -l app=block-watcher -n block-watcher -f

# 2. Check pod status
kubectl get pods -n block-watcher

# 3. Check metrics
curl http://localhost:8080/api/metrics

# 4. Access database
kubectl exec -it deployment/postgres -n block-watcher -- \
  psql -U postgres blockwatcher
```

**Full guide:** [Troubleshooting](07-troubleshooting.md)

## Technology Reference

### Core Technologies

- **NestJS** - https://nestjs.com - Node.js framework
- **Prisma** - https://prisma.io - Database ORM
- **PostgreSQL** - https://postgresql.org - Database
- **Prometheus** - https://prometheus.io - Metrics
- **Grafana** - https://grafana.com - Dashboards
- **Kubernetes** - https://kubernetes.io - Orchestration

### Key Endpoints

| Endpoint | Purpose | Port |
|----------|---------|------|
| `/docs` | Swagger API docs | 3000 |
| `/api/metrics` | Prometheus metrics | 3000 |
| `/api/health/liveness` | Liveness probe | 3000 |
| `/api/health/readiness` | Readiness probe | 3000 |

### Important Files

```
block-watcher/
├── src/                      # Application code
├── prisma/schema.prisma      # Database schema
├── k8s/                      # Kubernetes manifests
├── cookbook/                 # Documentation (you are here)
├── Dockerfile                # Production image
├── package.json              # Dependencies
└── .env.example              # Configuration template
```

## Learning Path

### Week 1: Local Development
- Day 1-2: Setup and run locally
- Day 3-4: Understand codebase
- Day 5: Add simple feature

### Week 2: Kubernetes
- Day 1-2: Deploy to local Kubernetes
- Day 3-4: Setup observability
- Day 5: Deploy to production

### Week 3: Observability
- Day 1-2: Create Grafana dashboards
- Day 3-4: Configure alerts
- Day 5: Test disaster recovery

### Week 4: Advanced
- Day 1-2: Performance optimization
- Day 3-4: Security hardening
- Day 5: Documentation updates

## Getting Help

### Documentation
1. Search this cookbook first
2. Check inline code comments
3. Review test files for examples

### Debugging
1. Check logs: `kubectl logs -l app=block-watcher -n block-watcher -f`
2. Check metrics: `curl http://localhost:8080/api/metrics`
3. Check database: `kubectl exec -it deployment/postgres -n block-watcher -- psql`

### Escalation
1. Check [Troubleshooting Guide](07-troubleshooting.md)
2. Review recent changes in Git history
3. Ask team in Slack
4. Create detailed bug report

## Contributing to Docs

### Adding New Documentation

```bash
# Create new guide
vim cookbook/08-new-guide.md

# Follow naming convention:
# XX-topic-name.md
# Where XX is next number

# Add to this README
# Update table of contents

# Commit
git add cookbook/
git commit -m "docs: add new guide"
```

### Documentation Standards

- **Clear titles** - What the doc covers
- **Prerequisites** - What reader should know first
- **Code examples** - Real, runnable examples
- **Troubleshooting** - Common errors and fixes
- **Next steps** - What to read next

### Style Guide

```markdown
# Use H1 for title
## Use H2 for main sections  
### Use H3 for subsections

- Lists for items
- Not complete sentences

**Bold** for emphasis
`code` for inline code

```bash
# Code blocks with language
command here
```

[Links](relative-path.md) to other docs
```

## Quick Reference

### Essential Commands

```bash
# Local Development
npm run start:dev              # Start with hot-reload
npm test                       # Run tests
npx prisma studio              # Database GUI

# Kubernetes
kubectl get pods -A            # List all pods
kubectl logs <pod> -f          # Follow logs
kubectl port-forward svc/<service> 8080:80  # Access service

# Deployment
./deploy-production.sh         # Production deployment (on server)
./dev-local.sh                 # Local Kubernetes testing
cd k8s && ./verify.sh          # Verify deployment

# Troubleshooting
kubectl describe pod <pod>     # Detailed pod info
kubectl get events             # Recent events
kubectl top pods               # Resource usage
```

### Important URLs

**Local:**
- API: http://localhost:3000/api
- Docs: http://localhost:3000/docs
- Metrics: http://localhost:3000/api/metrics

**Production:**
- API: https://api.yourdomain.com
- Grafana: https://grafana.yourdomain.com
- Alertmanager: https://alerts.yourdomain.com

## Maintenance

### Keep Documentation Updated

When you:
- Add new feature → Update relevant guide
- Change configuration → Update [Configuration](03-configuration.md)
- Fix bug → Add to [Troubleshooting](07-troubleshooting.md)
- Change deployment → Update [Kubernetes Deployment](02-kubernetes-deployment.md)

### Review Schedule

- **Weekly**: Check for outdated content
- **Monthly**: Update versions and links
- **Quarterly**: Comprehensive review
- **Major releases**: Update all affected docs

## Feedback

Found an error? Missing information? Unclear section?

1. Create GitHub issue with `documentation` label
2. Submit pull request with fix
3. Ask in team Slack

**Good documentation helps everyone!**

---

**Start your journey:** [Getting Started](00-getting-started.md) →
