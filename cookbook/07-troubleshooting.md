# Troubleshooting Guide

Common issues and solutions for Block Watcher.

## Table of Contents

- [Application Issues](#application-issues)
- [Database Issues](#database-issues)
- [Kubernetes Issues](#kubernetes-issues)
- [Networking Issues](#networking-issues)
- [Performance Issues](#performance-issues)
- [Observability Issues](#observability-issues)

## Application Issues

### App Won't Start Locally

**Symptoms:**
- `npm run start:dev` fails
- "Module not found" errors
- TypeScript compilation errors

**Solutions:**

```bash
# 1. Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# 2. Rebuild
npm run build

# 3. Check Node version
node --version  # Should be 20.x

# 4. Check environment variables
cat .env
```

### Port Already in Use

**Symptoms:**
- Error: `listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

### Tests Failing

**Symptoms:**
- Jest tests fail
- Database connection errors in tests

**Solutions:**

```bash
# Clear Jest cache
npm test -- --clearCache

# Reset test database
NODE_ENV=test npx prisma migrate reset --force

# Run tests with verbose output
npm test -- --verbose

# Check test database connection
cat .env.test
```

### Build Fails

**Symptoms:**
- TypeScript compilation errors
- Missing dependencies

**Solutions:**

```bash
# Check TypeScript configuration
cat tsconfig.json

# Rebuild
rm -rf dist
npm run build

# Check for type errors
npx tsc --noEmit

# Update dependencies
npm update
```

## Database Issues

### Can't Connect to Database

**Symptoms:**
- `Error: connect ECONNREFUSED 127.0.0.1:5432`
- Prisma client connection errors

**Solutions:**

**Local Development:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start PostgreSQL
docker run -d \
  --name block-watcher-db \
  -e POSTGRES_DB=blockwatcher \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15-alpine

# Test connection
psql postgresql://postgres:password@localhost:5432/blockwatcher
```

**Kubernetes:**
```bash
# Check database pod
kubectl get pods -l app=postgres -n block-watcher

# View logs
kubectl logs -l app=postgres -n block-watcher

# Check connection from app pod
kubectl exec -it deployment/block-watcher -n block-watcher -- \
  sh -c 'wget -O- postgres-service:5432 || echo "Cannot connect"'
```

### Wrong DATABASE_URL

**Symptoms:**
- `Invalid DATABASE_URL` errors
- Connection string parse errors

**Solutions:**

```bash
# Check .env file
cat .env | grep DATABASE_URL

# Format should be:
# postgresql://user:password@host:port/database

# For local development:
DATABASE_URL=postgresql://postgres:password@localhost:5432/blockwatcher

# For Kubernetes:
DATABASE_URL=postgresql://postgres:password@postgres-service:5432/blockwatcher

# Verify in secret (Kubernetes)
kubectl get secret app-secret -n block-watcher \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

### Prisma Client Not Generated

**Symptoms:**
- `Cannot find module '@prisma/client'`
- Prisma import errors

**Solution:**
```bash
# Generate Prisma client
npx prisma generate

# If schema changed, migrate
npx prisma migrate dev

# Verify client exists
ls node_modules/.prisma/client/
```

### Migration Fails

**Symptoms:**
- `Migration failed` errors
- Database schema out of sync

**Solutions:**

```bash
# Check migration status
npx prisma migrate status

# Reset database (development only!)
npx prisma migrate reset

# Apply migrations
npx prisma migrate deploy

# Force reset (destroys data!)
npx prisma migrate reset --force
```

### Data Lost After Restart

**Kubernetes Only:**

**Symptoms:**
- Database empty after pod restart
- Data doesn't persist

**Solutions:**

```bash
# Check if PVC exists
kubectl get pvc -n block-watcher

# Check PVC status (should be "Bound")
kubectl describe pvc postgres-pvc -n block-watcher

# Verify postgres.yaml uses PVC not emptyDir
kubectl get deployment postgres -n block-watcher -o yaml | grep -A 5 volumes

# Should show:
# persistentVolumeClaim:
#   claimName: postgres-pvc
```

## Kubernetes Issues

### Pods Not Starting

**Symptoms:**
- Pods stuck in `Pending` state
- Pods in `CrashLoopBackOff`
- `ImagePullBackOff` errors

**Diagnose:**
```bash
# Check pod status
kubectl get pods -n block-watcher

# View detailed events
kubectl describe pod <pod-name> -n block-watcher

# Check logs
kubectl logs <pod-name> -n block-watcher

# Previous container logs (if crashed)
kubectl logs <pod-name> -n block-watcher --previous
```

**Solutions by Error:**

**ImagePullBackOff:**
```bash
# Check image exists locally
docker images | grep block-watcher

# For local images, ensure imagePullPolicy: Never
kubectl get deployment block-watcher -n block-watcher -o yaml | grep imagePullPolicy

# Rebuild image
docker build -t block-watcher:local .
```

**CrashLoopBackOff:**
```bash
# Check application logs
kubectl logs -l app=block-watcher -n block-watcher --tail=50

# Common causes:
# - DATABASE_URL incorrect
# - Secrets not created
# - Database not ready

# Check secrets exist
kubectl get secrets -n block-watcher
```

**Pending:**
```bash
# Check node resources
kubectl top nodes

# Check events
kubectl get events -n block-watcher --sort-by='.lastTimestamp'

# Describe pod for reason
kubectl describe pod <pod-name> -n block-watcher
```

### Secret Not Found

**Symptoms:**
- `Error: secret "app-secret" not found`

**Solution:**
```bash
# Check if secrets exist
kubectl get secrets -n block-watcher

# If missing, create them
cd k8s
./create-secrets.sh

# Verify secrets
kubectl describe secret app-secret -n block-watcher
```

### Service Not Accessible

**Symptoms:**
- Cannot reach service from another pod
- Connection timeout

**Diagnose:**
```bash
# Check service exists
kubectl get svc -n block-watcher

# Check endpoints (should show pod IPs)
kubectl get endpoints block-watcher-service -n block-watcher

# If no endpoints, service selector doesn't match pods
kubectl get pods -n block-watcher --show-labels
kubectl get svc block-watcher-service -n block-watcher -o yaml | grep selector
```

**Solution:**
```bash
# Fix selector in service.yaml to match pod labels
# Both should have: app: block-watcher
```

### Init Container Fails

**Symptoms:**
- Pod stuck in `Init:Error` or `Init:CrashLoopBackOff`
- Prisma migrations failing

**Diagnose:**
```bash
# Check init container logs
kubectl logs <pod-name> -n block-watcher -c prisma-migrate

# Common issues:
# - DATABASE_URL incorrect in init container
# - Database not ready yet
```

**Solution:**
```bash
# Ensure init container has DATABASE_URL
kubectl get deployment block-watcher -n block-watcher -o yaml | \
  grep -A 10 initContainers

# Manually run migration to test
kubectl exec -it deployment/postgres -n block-watcher -- \
  psql -U postgres -d blockwatcher -c "\dt"
```

## Networking Issues

### Ingress Not Working

**Symptoms:**
- Domain not accessible
- 404 or 503 errors
- SSL certificate errors

**Diagnose:**
```bash
# Check ingress exists
kubectl get ingress -A

# Check ingress details
kubectl describe ingress block-watcher-api -n block-watcher

# Check NGINX Ingress Controller
kubectl get pods -n ingress-nginx

# Check controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=50
```

**Solutions:**

**DNS not resolving:**
```bash
# Test DNS
dig api.yourdomain.com
ping api.yourdomain.com

# Should resolve to your server IP
```

**NGINX not installed:**
```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

**Wrong ingressClassName:**
```bash
# Check ingress class
kubectl get ingressclass

# Ensure ingress.yaml uses correct class
grep ingressClassName k8s/ingress.yaml
# Should show: ingressClassName: nginx
```

### Cannot Reach External Services

**Symptoms:**
- API calls to external services timeout
- Cannot connect to Ethereum RPC

**Solutions:**
```bash
# Test from pod
kubectl exec -it deployment/block-watcher -n block-watcher -- \
  wget -O- https://eth-mainnet.g.alchemy.com/v2/demo

# Check network policies
kubectl get networkpolicies -n block-watcher

# Check firewall rules
sudo ufw status
```

## Performance Issues

### High Memory Usage

**Symptoms:**
- Pods using excessive memory
- OOMKilled events

**Diagnose:**
```bash
# Check resource usage
kubectl top pods -n block-watcher

# Check events for OOMKilled
kubectl get events -n block-watcher | grep OOM

# View resource limits
kubectl describe pod <pod-name> -n block-watcher | grep -A 5 Limits
```

**Solutions:**
```bash
# Increase memory limits in deployment.yaml
resources:
  limits:
    memory: "1Gi"  # Increase from 512Mi

# Apply changes
kubectl apply -f k8s/deployment.yaml

# Monitor heap usage
curl http://localhost:8080/api/metrics | grep nodejs_heap
```

### Slow Response Times

**Symptoms:**
- API responses taking >1 second
- Timeout errors

**Diagnose:**
```bash
# Check metrics
curl http://localhost:8080/api/metrics | grep http_server_requests_seconds

# Check database performance
kubectl exec -it deployment/postgres -n block-watcher -- \
  psql -U postgres -d blockwatcher -c "SELECT * FROM pg_stat_activity;"

# Check resource usage
kubectl top pods -n block-watcher
```

**Solutions:**
```bash
# Add database indexes
npx prisma studio
# Create indexes for frequently queried fields

# Scale horizontally
kubectl scale deployment block-watcher --replicas=3 -n block-watcher

# Increase resources
# Edit deployment.yaml resources section
kubectl apply -f k8s/deployment.yaml
```

### Event Loop Lag

**Symptoms:**
- Application feels sluggish
- High `nodejs_eventloop_lag_seconds`

**Solutions:**
```typescript
// Identify blocking code
// Check for:
// - Synchronous operations in async handlers
// - Large loops
// - Heavy CPU computations

// Use worker threads for CPU-intensive tasks
import { Worker } from 'worker_threads';

// Optimize database queries
// Use proper indexes
// Batch operations
// Use connection pooling
```

## Observability Issues

### Metrics Not Appearing in Prometheus

**Symptoms:**
- Prometheus targets show "down"
- Metrics endpoint returns 404

**Diagnose:**
```bash
# Check metrics endpoint directly
kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher
curl http://localhost:8080/api/metrics

# Should return metrics in Prometheus format

# Check ServiceMonitor exists
kubectl get servicemonitor -n observability

# Check Prometheus targets
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability
open http://localhost:9090/targets
```

**Solutions:**

**ServiceMonitor not found:**
```bash
cd k8s
kubectl apply -f service-monitor.yaml
```

**ServiceMonitor has wrong labels:**
```bash
# Must have: release: observability
kubectl get servicemonitor block-watcher-service-monitor -n observability -o yaml | grep labels -A 5

# Fix in service-monitor.yaml
labels:
  release: observability  # REQUIRED
```

**Service selector doesn't match:**
```bash
# Service must have matching label
kubectl get svc block-watcher-service -n block-watcher -o yaml | grep labels -A 3
# Should have: app: block-watcher

# ServiceMonitor selector must match
kubectl get servicemonitor block-watcher-service-monitor -n observability -o yaml | grep selector -A 3
```

### Alerts Not Firing

**Symptoms:**
- Expected alerts not triggering
- Alertmanager empty

**Diagnose:**
```bash
# Check alert rules exist
kubectl get prometheusrules -n observability

# Check Prometheus rules page
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability
open http://localhost:9090/rules

# Manually trigger alert condition
# E.g., stop all pods to trigger BlockWatcherDown
kubectl scale deployment block-watcher --replicas=0 -n block-watcher
```

**Solutions:**
```bash
# Apply alert rules
cd k8s
kubectl apply -f alert-rules.yaml

# Check alert rule has correct labels
kubectl get prometheusrule block-watcher-alerts -n observability -o yaml | grep labels -A 3
# Must have: release: observability
```

### Grafana Can't Connect to Prometheus

**Symptoms:**
- Grafana data source shows error
- "Bad Gateway" or timeout errors

**Solution:**
```bash
# Prometheus URL should be:
# http://observability-kube-prometheus-prometheus.observability:9090

# Test from Grafana pod
kubectl exec -it deployment/observability-grafana -n observability -- \
  wget -O- observability-kube-prometheus-prometheus:9090/api/v1/query?query=up

# If fails, check Prometheus service
kubectl get svc -n observability | grep prometheus
```

## Getting More Help

### Collect Diagnostic Information

```bash
# Create diagnostic bundle
mkdir -p diagnostics

# Pod status
kubectl get pods -A > diagnostics/pods.txt

# Events
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > diagnostics/events.txt

# Logs
kubectl logs -l app=block-watcher -n block-watcher --tail=500 > diagnostics/app-logs.txt
kubectl logs -l app=postgres -n block-watcher --tail=500 > diagnostics/db-logs.txt

# Descriptions
kubectl describe deployment block-watcher -n block-watcher > diagnostics/deployment.txt
kubectl describe service block-watcher-service -n block-watcher > diagnostics/service.txt

# Resource usage
kubectl top nodes > diagnostics/nodes.txt
kubectl top pods -n block-watcher > diagnostics/pods-usage.txt

# Create tarball
tar -czf diagnostics.tar.gz diagnostics/
```

### Enable Debug Logging

**Application:**
```env
# Add to .env
LOG_LEVEL=debug
NODE_ENV=development
```

**Kubernetes:**
```bash
# Recreate secrets with debug enabled
./create-secrets.sh

# Restart pods
kubectl rollout restart deployment/block-watcher -n block-watcher

# Follow logs
kubectl logs -l app=block-watcher -n block-watcher -f
```

### Check System Resources

```bash
# Node resources
kubectl describe nodes

# Disk space
kubectl exec -it deployment/block-watcher -n block-watcher -- df -h

# Memory pressure
kubectl top nodes
kubectl top pods -A

# Database size
kubectl exec -it deployment/postgres -n block-watcher -- \
  psql -U postgres -d blockwatcher -c "\l+"
```

## Prevention

### Regular Maintenance

```bash
# Weekly
- Check logs for errors
- Review metrics in Grafana
- Check disk space
- Update dependencies

# Monthly
- Review alert thresholds
- Optimize database queries
- Update Kubernetes components
- Security patches

# Quarterly
- Load testing
- Disaster recovery drill
- Review runbooks
- Team training
```

### Monitoring Checklist

- [ ] Prometheus scraping successfully
- [ ] Grafana dashboards updated
- [ ] Alerts configured and tested
- [ ] Log aggregation working
- [ ] Resource usage within limits
- [ ] Backup success verified
- [ ] Certificate expiration monitored

## Common Commands Reference

```bash
# View logs
kubectl logs -l app=block-watcher -n block-watcher -f

# Restart deployment
kubectl rollout restart deployment/block-watcher -n block-watcher

# Scale deployment
kubectl scale deployment block-watcher --replicas=3 -n block-watcher

# Access database
kubectl exec -it deployment/postgres -n block-watcher -- psql -U postgres blockwatcher

# Port forward
kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher

# Check resource usage
kubectl top pods -n block-watcher

# View events
kubectl get events -n block-watcher --sort-by='.lastTimestamp'

# Delete and recreate pod
kubectl delete pod <pod-name> -n block-watcher
```
