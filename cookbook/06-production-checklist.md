# Production Deployment Checklist

Complete checklist before deploying to production.

## Pre-Deployment

### Server Setup
- [ ] Ubuntu Server 20.04 or 22.04 installed
- [ ] Minimum 8GB RAM, 4 CPU cores
- [ ] 50GB+ disk space available
- [ ] Public IP address assigned
- [ ] SSH access configured (key-based authentication)
- [ ] Firewall rules configured (ports 22, 80, 443)

### Domain & DNS
- [ ] Domain name registered
- [ ] DNS A records configured:
  - [ ] `api.yourdomain.com` → Server IP
  - [ ] `grafana.yourdomain.com` → Server IP
  - [ ] `alerts.yourdomain.com` → Server IP
- [ ] DNS propagation verified (`dig api.yourdomain.com`)

### Software Prerequisites
- [ ] K3s installed and running
- [ ] Helm 3 installed
- [ ] kubectl configured and working
- [ ] NGINX Ingress Controller deployed
- [ ] cert-manager installed (for HTTPS)

### Configuration Files
- [ ] `.env` file created with production values
- [ ] Database credentials are strong (20+ characters)
- [ ] All API keys and secrets configured
- [ ] `k8s/ingress.yaml` updated with correct domains
- [ ] `.env` file configured with production values

## Security

### Secrets Management
- [ ] `.env` file NOT committed to Git
- [ ] Strong passwords used (no defaults!)
- [ ] Different passwords per environment
- [ ] Secrets rotation plan documented
- [ ] Kubernetes RBAC configured

### Access Control
- [ ] SSH key-based authentication only
- [ ] SSH password authentication disabled
- [ ] Firewall enabled (ufw or iptables)
- [ ] Only necessary ports open (22, 80, 443)
- [ ] fail2ban installed and configured
- [ ] Grafana admin password changed from default
- [ ] Database not exposed publicly (ClusterIP only)

### SSL/TLS
- [ ] cert-manager ClusterIssuer configured
- [ ] Let's Encrypt production issuer used
- [ ] Ingress configured with TLS
- [ ] SSL redirect enabled
- [ ] Certificate auto-renewal verified

## Application

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Rollback plan documented

### Docker Image
- [ ] Production Dockerfile tested
- [ ] Image builds successfully
- [ ] Image size optimized (<500MB)
- [ ] No dev dependencies in production image
- [ ] Health checks working in container
- [ ] Environment variables properly configured

### Database
- [ ] Prisma schema validated
- [ ] Migrations tested on staging
- [ ] Backup strategy defined
- [ ] Data retention policy set
- [ ] Connection pool configured
- [ ] Indexes created for queries

## Kubernetes

### Resource Limits
- [ ] CPU requests/limits set
- [ ] Memory requests/limits set
- [ ] Resource limits tested under load
- [ ] Node resources sufficient
- [ ] Storage capacity adequate (10GB+ for DB)

### High Availability
- [ ] Application replicas configured (2+)
- [ ] Pod disruption budget set
- [ ] Anti-affinity rules configured
- [ ] Rolling update strategy defined
- [ ] Health checks configured correctly

### Persistence
- [ ] PersistentVolumeClaim configured
- [ ] Storage class appropriate
- [ ] Backup schedule defined
- [ ] Restore procedure documented
- [ ] Data migration plan ready

### Networking
- [ ] Services configured correctly
- [ ] Ingress rules tested
- [ ] Network policies defined
- [ ] DNS working internally
- [ ] LoadBalancer / NodePort configured

## Observability

### Metrics
- [ ] Prometheus installed and running
- [ ] ServiceMonitor configured
- [ ] Metrics endpoint accessible
- [ ] Prometheus scraping successfully
- [ ] Key metrics identified and documented

### Dashboards
- [ ] Grafana accessible
- [ ] Prometheus data source configured
- [ ] At least one dashboard created
- [ ] Dashboard shows real data
- [ ] Panels document what they show

### Alerting
- [ ] Alert rules configured
- [ ] Alert thresholds tested
- [ ] Alertmanager configured
- [ ] Notification channel configured (Slack/Email/PagerDuty)
- [ ] Test alerts sent and received
- [ ] On-call rotation defined
- [ ] Alert runbooks documented

### Logging
- [ ] Logs structured (JSON format)
- [ ] Log aggregation configured
- [ ] Log retention policy set
- [ ] Sensitive data not logged
- [ ] Error tracking configured (Sentry)

## Testing

### Functional Testing
- [ ] Application accessible via domain
- [ ] API endpoints respond correctly
- [ ] Database connection working
- [ ] Health checks returning 200
- [ ] Metrics endpoint accessible
- [ ] Authentication working (if applicable)

### Performance Testing
- [ ] Load testing performed
- [ ] Response times acceptable (<500ms p95)
- [ ] Database queries optimized
- [ ] No memory leaks
- [ ] CPU usage reasonable (<70%)
- [ ] Horizontal scaling tested

### Failure Testing
- [ ] Pod restart tested (data persists)
- [ ] Node failure tested (pods reschedule)
- [ ] Database restart tested (app reconnects)
- [ ] Network partition tested
- [ ] Resource exhaustion tested

## Deployment

### Deployment Process
- [ ] Deployment script tested on staging
- [ ] Rollback procedure documented
- [ ] Database backup taken before deployment
- [ ] Maintenance window scheduled
- [ ] Team notified of deployment
- [ ] Monitoring active during deployment

### Post-Deployment
- [ ] Application accessible
- [ ] Health checks passing
- [ ] Metrics being collected
- [ ] Logs flowing correctly
- [ ] No errors in logs
- [ ] Database migrations successful
- [ ] Performance acceptable

## Documentation

### Technical Docs
- [ ] README updated
- [ ] API documentation current
- [ ] Architecture diagrams created
- [ ] Database schema documented
- [ ] Environment variables documented
- [ ] Deployment process documented

### Operational Docs
- [ ] Runbooks created for common issues
- [ ] Alert response procedures
- [ ] Backup/restore procedures
- [ ] Scaling procedures
- [ ] Rollback procedures
- [ ] Incident response plan

### Team Knowledge
- [ ] Team trained on deployment
- [ ] Access credentials shared securely
- [ ] On-call schedule defined
- [ ] Escalation paths documented
- [ ] Knowledge transfer completed

## Monitoring

### Application Monitoring
- [ ] Request rate monitored
- [ ] Error rate monitored
- [ ] Response time monitored
- [ ] Database performance monitored
- [ ] Resource usage monitored

### Infrastructure Monitoring
- [ ] Node health monitored
- [ ] Disk space monitored
- [ ] Network bandwidth monitored
- [ ] Certificate expiration monitored
- [ ] Backup success monitored

### Business Metrics
- [ ] Active users tracked
- [ ] Key business KPIs monitored
- [ ] SLO/SLA defined and tracked
- [ ] Uptime monitored
- [ ] Revenue impact tracked (if applicable)

## Compliance

### Data Protection
- [ ] GDPR compliance verified (if EU users)
- [ ] Data encryption at rest
- [ ] Data encryption in transit
- [ ] PII handling procedures
- [ ] Data retention policy

### Security
- [ ] Security audit performed
- [ ] Vulnerability scanning configured
- [ ] Dependencies up to date
- [ ] Security patches applied
- [ ] Penetration testing performed

### Legal
- [ ] Terms of service published
- [ ] Privacy policy published
- [ ] Cookie policy (if applicable)
- [ ] Acceptable use policy
- [ ] Data processing agreement

## Backup & Recovery

### Backup Strategy
- [ ] Database backups automated
- [ ] Backup frequency defined (daily)
- [ ] Backup retention policy (30 days)
- [ ] Backups stored off-site
- [ ] Backup integrity tested

### Recovery Procedures
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined
- [ ] Disaster recovery plan documented
- [ ] Recovery procedures tested
- [ ] Business continuity plan ready

## Cost Management

### Resource Optimization
- [ ] Resource requests optimized
- [ ] Unused resources identified
- [ ] Auto-scaling configured
- [ ] Cost monitoring enabled
- [ ] Budget alerts configured

### Financial
- [ ] Monthly cost estimated
- [ ] Cost allocation tags applied
- [ ] Reserved instances considered
- [ ] Spot instances evaluated (if applicable)
- [ ] Cost optimization plan

## Final Checks

### Before Going Live
- [ ] All above checklist items completed
- [ ] Staging environment mirrors production
- [ ] Final testing on staging passed
- [ ] Team ready for go-live
- [ ] Rollback plan ready
- [ ] Monitoring dashboard open
- [ ] Support team on standby

### Go-Live Verification
- [ ] Application responding
- [ ] No errors in logs
- [ ] Metrics flowing
- [ ] Alerts not firing
- [ ] Performance acceptable
- [ ] Users can access
- [ ] Features working as expected

### Post-Launch
- [ ] Monitor for 24 hours
- [ ] Address any issues immediately
- [ ] Collect user feedback
- [ ] Document lessons learned
- [ ] Plan next iteration
- [ ] Celebrate success! 🎉

## Emergency Contacts

```yaml
# Update with your team's contacts
oncall:
  primary: "+1-555-1234"
  secondary: "+1-555-5678"
  
slack:
  channel: "#prod-alerts"
  
escalation:
  level1: "Platform Team"
  level2: "Engineering Manager"
  level3: "CTO"
```

## Rollback Procedure

If deployment fails:

```bash
# 1. Rollback deployment
kubectl rollout undo deployment/block-watcher -n block-watcher

# 2. Check status
kubectl rollout status deployment/block-watcher -n block-watcher

# 3. Restore database (if needed)
kubectl exec -i -n block-watcher deployment/postgres -- \
  psql -U postgres blockwatcher < backup.sql

# 4. Verify application
curl https://api.yourdomain.com/api/health/liveness

# 5. Notify team
# Post in #prod-alerts Slack channel
```

## Next Steps After Production

1. **Week 1:** Monitor closely, fix any issues
2. **Week 2:** Optimize based on real usage
3. **Month 1:** Review metrics, adjust alerts
4. **Month 3:** Plan next features
5. **Ongoing:** Regular security updates

## Resources

- [Kubernetes Best Practices](02-kubernetes-deployment.md)
- [Observability Guide](04-observability.md)
- [Troubleshooting](07-troubleshooting.md)
- [Configuration Management](03-configuration.md)

---

**Remember:** This checklist is a living document. Update it based on your experience and specific requirements.
