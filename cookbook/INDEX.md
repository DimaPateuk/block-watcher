# Cookbook Index

Complete guide to Block Watcher - organized for progressive learning.

## Learning Path

### For New Developers

**Week 1: Understanding & Local Setup**
```
Day 1-2: Read 00-getting-started.md
Day 3-4: Follow 01-local-development.md
Day 5: Practice with 03-configuration.md
```

**Week 2: Kubernetes & Production**
```
Day 1-2: Study 02-kubernetes-deployment.md
Day 3-4: Practice deployment with 08-server-setup.md
Day 5: Review 05-kubernetes-reference.md
```

**Week 3: Operations**
```
Day 1-2: Learn 04-observability.md
Day 3: Go through 06-production-checklist.md
Day 4-5: Study 07-troubleshooting.md
```

## All Guides

### 00. Getting Started
**File**: `00-getting-started.md`  
**For**: Brand new developers joining the project  
**Time**: 30 minutes  
**Topics**:
- What is Block Watcher?
- Architecture overview
- Project structure
- Tech stack
- Quick start journey
- Key concepts

### 01. Local Development
**File**: `01-local-development.md`  
**For**: Setting up development environment  
**Time**: 1 hour  
**Topics**:
- Prerequisites installation
- Initial setup steps
- Development workflow
- Running tests
- Debugging techniques
- Database management

### 02. Kubernetes Deployment
**File**: `02-kubernetes-deployment.md`  
**For**: Deploying to production  
**Time**: 2 hours  
**Topics**:
- Local testing (Docker Desktop)
- Production server deployment
- Architecture explanation
- Database persistence
- Monitoring setup
- Scaling and updates

### 03. Configuration
**File**: `03-configuration.md`  
**For**: Managing environment variables  
**Time**: 30 minutes  
**Topics**:
- Configuration philosophy
- `.env` file setup
- Kubernetes secrets
- Security best practices
- Managing different environments

### 04. Observability
**File**: `04-observability.md`  
**For**: Understanding monitoring stack  
**Time**: 1 hour  
**Topics**:
- Metrics overview
- Prometheus setup
- Grafana dashboards
- Alertmanager configuration
- Custom metrics
- ServiceMonitor

### 05. Kubernetes Reference
**File**: `05-kubernetes-reference.md`  
**For**: Deep dive into Kubernetes manifests  
**Time**: Reference (as needed)  
**Topics**:
- File structure
- All manifests explained
- Deployment scripts
- Common patterns
- Best practices

### 06. Production Checklist
**File**: `06-production-checklist.md`  
**For**: Pre-deployment verification  
**Time**: Checklist  
**Topics**:
- Server setup verification
- Security checks
- Application readiness
- Testing requirements
- Monitoring setup
- Post-deployment validation

### 07. Troubleshooting
**File**: `07-troubleshooting.md`  
**For**: Solving common problems  
**Time**: Reference (as needed)  
**Topics**:
- Application issues
- Database problems
- Kubernetes errors
- Networking issues
- Performance problems
- Observability issues

### 08. Server Setup
**File**: `08-server-setup.md`  
**For**: Ubuntu server installation  
**Time**: 1 hour  
**Topics**:
- Ubuntu prerequisites
- K3s installation
- Helm setup
- NGINX Ingress
- Firewall configuration
- Certificate management

## Quick Reference

### I want to...

| Goal | Read This |
|------|-----------|
| Understand the project | [00-getting-started.md](00-getting-started.md) |
| Run it locally | [01-local-development.md](01-local-development.md) |
| Deploy to production | [02-kubernetes-deployment.md](02-kubernetes-deployment.md) |
| Setup environment variables | [03-configuration.md](03-configuration.md) |
| Create dashboards | [04-observability.md](04-observability.md) |
| Understand Kubernetes files | [05-kubernetes-reference.md](05-kubernetes-reference.md) |
| Prepare for production | [06-production-checklist.md](06-production-checklist.md) |
| Fix a problem | [07-troubleshooting.md](07-troubleshooting.md) |
| Setup Ubuntu server | [08-server-setup.md](08-server-setup.md) |

## Documentation Coverage

### Beginner Topics ✅
- [x] Project overview
- [x] Local development setup
- [x] First deployment
- [x] Basic configuration
- [x] Common commands

### Intermediate Topics ✅
- [x] Kubernetes deployment
- [x] Secret management
- [x] Monitoring setup
- [x] Database persistence
- [x] Troubleshooting basics

### Advanced Topics ✅
- [x] Kubernetes manifest reference
- [x] Custom metrics
- [x] Alert configuration
- [x] Production checklist
- [x] Performance optimization

## File Organization

```
cookbook/
├── README.md                   # Navigation hub
├── INDEX.md                    # This file
│
├── Getting Started (00-01)
│   ├── 00-getting-started.md
│   └── 01-local-development.md
│
├── Deployment (02-03)
│   ├── 02-kubernetes-deployment.md
│   └── 03-configuration.md
│
├── Operations (04-07)
│   ├── 04-observability.md
│   ├── 05-kubernetes-reference.md
│   ├── 06-production-checklist.md
│   └── 07-troubleshooting.md
│
└── Infrastructure (08)
    └── 08-server-setup.md
```

## How to Use This Cookbook

### As a New Developer
1. Start with `00-getting-started.md`
2. Follow the learning path sequentially
3. Do the hands-on exercises
4. Refer back to reference docs as needed

### As an Operator
1. Keep `07-troubleshooting.md` handy
2. Review `06-production-checklist.md` before deployments
3. Use `05-kubernetes-reference.md` for manifest details
4. Check `04-observability.md` for monitoring

### As a DevOps Engineer
1. Focus on `02-kubernetes-deployment.md`
2. Master `08-server-setup.md`
3. Understand `03-configuration.md` for secrets
4. Use `05-kubernetes-reference.md` for infrastructure

## Contributing to Documentation

### Adding New Guide
```bash
# Create new file with next number
vim cookbook/09-new-topic.md

# Update README.md
# Update INDEX.md (this file)

# Commit
git add cookbook/
git commit -m "docs: add new guide for [topic]"
```

### Updating Existing Guide
```bash
# Edit the guide
vim cookbook/XX-topic.md

# Verify links still work
# Check formatting
# Update last modified date

# Commit
git commit -m "docs: update XX-topic with [changes]"
```

## Maintenance

### Regular Updates
- **Weekly**: Check for broken links
- **Monthly**: Update versions and commands
- **Quarterly**: Comprehensive review
- **Major releases**: Update all affected guides

### Quality Checklist
- [ ] Clear, concise writing
- [ ] Working code examples
- [ ] Updated screenshots (if any)
- [ ] Correct links
- [ ] No outdated information
- [ ] Proper formatting
- [ ] Tested commands

## Getting Help

Can't find what you need?

1. **Search**: Use Ctrl+F in README.md
2. **Index**: Check this file for topic
3. **Troubleshooting**: Look in 07-troubleshooting.md
4. **Ask**: Create issue or ask in Slack

## Documentation Philosophy

**These guides are written to:**
- Help new developers onboard quickly
- Provide reference for experienced developers
- Document production procedures
- Reduce support burden
- Share knowledge across team

**They are NOT:**
- Exhaustive API documentation (see Swagger)
- Code-level documentation (see inline comments)
- Tutorial for learning NestJS/Kubernetes from scratch
- Replacement for official technology docs

**Best Used:**
- As practical, project-specific guides
- Alongside official documentation
- For understanding how things work together
- As a starting point for deeper learning

---

**Start Learning**: [00-getting-started.md](00-getting-started.md) →
