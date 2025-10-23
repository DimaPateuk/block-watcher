# Configuration & Secrets Management

Managing environment variables and secrets in Kubernetes.

## Configuration Philosophy

All configuration comes from a single `.env` file:
- **Local Development**: `.env` on your machine
- **Kubernetes**: Secrets created from `.env`
- **Production**: Same `.env` format, different values

This ensures consistency across environments.

## Environment Variables

### Required Variables

```env
# Database Configuration
POSTGRES_DB=blockwatcher
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password

# Database Connection String
DATABASE_URL=postgresql://postgres:password@postgres-service:5432/blockwatcher

# Application Settings
NODE_ENV=production
PORT=3000
```

### Optional Variables

```env
# Logging
LOG_LEVEL=info

# External APIs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Feature Flags
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
```

## Local Development

### Setup .env File

```bash
# Copy template
cp .env.example .env

# Edit with your values
vim .env
```

**Example `.env` for local development:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/blockwatcher
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

The app automatically loads `.env` via `ConfigModule`:

```typescript
// src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true  // Available everywhere
    }),
    // ...
  ]
})
```

### Accessing Configuration in Code

```typescript
import { ConfigService } from '@nestjs/config';

export class MyService {
  constructor(private config: ConfigService) {}

  getPort(): number {
    return this.config.get<number>('PORT', 3000);
  }

  getDatabaseUrl(): string {
    return this.config.get<string>('DATABASE_URL');
  }

  // With type safety
  getRequiredValue(): string {
    const value = this.config.getOrThrow<string>('REQUIRED_VAR');
    return value;
  }
}
```

## Kubernetes Secrets

### How It Works

When deploying to Kubernetes, `.env` is converted to Kubernetes Secrets:

```bash
cd k8s
./create-secrets.sh
```

This creates 3 secrets:
1. **`postgres-secret`** - Database credentials
2. **`app-secret`** - DATABASE_URL
3. **`env-secret`** - All other .env variables

### Secret Creation Process

The `create-secrets.sh` script:
1. Reads `../.env` file
2. Creates `postgres-secret` with DB credentials
3. Creates `app-secret` with DATABASE_URL
4. Creates `env-secret` with all variables
5. Applies secrets to Kubernetes

```bash
#!/bin/bash
# Loads .env
source ../.env

# Creates postgres-secret
kubectl create secret generic postgres-secret \
    --from-literal=POSTGRES_DB="$POSTGRES_DB" \
    --from-literal=POSTGRES_USER="$POSTGRES_USER" \
    --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -n block-watcher

# Creates env-secret from entire .env file
kubectl create secret generic env-secret \
    --from-env-file=../.env \
    -n block-watcher
```

### Using Secrets in Pods

**Database Pod** uses specific secret keys:
```yaml
# postgres.yaml
env:
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: POSTGRES_PASSWORD
```

**Application Pod** loads all environment variables:
```yaml
# deployment.yaml
envFrom:
- secretRef:
    name: env-secret  # Loads ALL .env variables

env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: app-secret
      key: DATABASE_URL
```

## Security Best Practices

### What to Include in .env

✅ **DO Include:**
- Database credentials
- API keys
- Service URLs
- Feature flags
- Any sensitive data

❌ **DON'T Include:**
- Public information (put in ConfigMap instead)
- Binary data (use volumes instead)
- Large values (use ConfigMap or external secret store)

### Protecting Secrets

**1. Never Commit .env to Git**
```bash
# Verify .env is in .gitignore
cat .gitignore | grep .env

# If not, add it
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"
```

**2. Use Strong Passwords**
```bash
# Generate secure password
openssl rand -base64 32

# Or use password manager
```

**3. Rotate Secrets Regularly**
```bash
# Update .env
vim .env

# Recreate secrets
cd k8s
./create-secrets.sh

# Restart pods to pick up new values
kubectl rollout restart deployment/block-watcher -n block-watcher
kubectl rollout restart deployment/postgres -n block-watcher
```

**4. Different Secrets Per Environment**
```bash
# Development
.env.development

# Staging
.env.staging

# Production
.env.production

# Use the right one
cp .env.production .env
./deploy-production.sh
```

## Managing Secrets

### Viewing Secrets

```bash
# List all secrets
kubectl get secrets -n block-watcher

# View secret metadata
kubectl describe secret postgres-secret -n block-watcher

# Decode secret value
kubectl get secret postgres-secret -n block-watcher \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d

# View all secret data (decoded)
kubectl get secret postgres-secret -n block-watcher -o yaml
```

### Updating Secrets

**Method 1: Recreate from .env (Recommended)**
```bash
# 1. Edit .env
vim .env

# 2. Recreate secrets
cd k8s
./create-secrets.sh

# 3. Restart pods
kubectl rollout restart deployment/block-watcher -n block-watcher
```

**Method 2: Direct Update**
```bash
# Delete old secret
kubectl delete secret app-secret -n block-watcher

# Create new secret
kubectl create secret generic app-secret \
  --from-literal=DATABASE_URL="new-url" \
  -n block-watcher

# Restart pods
kubectl rollout restart deployment/block-watcher -n block-watcher
```

**Method 3: Patch Secret**
```bash
# Encode new value
echo -n "new-password" | base64
# Output: bmV3LXBhc3N3b3Jk

# Patch secret
kubectl patch secret postgres-secret -n block-watcher \
  -p '{"data":{"POSTGRES_PASSWORD":"bmV3LXBhc3N3b3Jk"}}'

# Restart pods
kubectl rollout restart deployment/postgres -n block-watcher
```

### Deleting Secrets

```bash
# Delete single secret
kubectl delete secret postgres-secret -n block-watcher

# Delete all secrets in namespace
kubectl delete secrets --all -n block-watcher

# Recreate them
cd k8s
./create-secrets.sh
```

## Troubleshooting

### Secret Not Found

```bash
# Check if secret exists
kubectl get secrets -n block-watcher

# If missing, create it
cd k8s
./create-secrets.sh
```

### Wrong Secret Value

```bash
# Verify secret content
kubectl get secret app-secret -n block-watcher \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d

# Compare with .env
cat ../.env | grep DATABASE_URL

# If different, recreate
./create-secrets.sh
kubectl rollout restart deployment/block-watcher -n block-watcher
```

### Pod Can't Access Secret

```bash
# Check pod events
kubectl describe pod <pod-name> -n block-watcher

# Common issues:
# - Secret doesn't exist in same namespace
# - Secret name misspelled in deployment.yaml
# - Key name wrong in secretKeyRef

# Verify deployment references correct secret
kubectl get deployment block-watcher -n block-watcher -o yaml | grep -A 10 secretKeyRef
```

### Secret Not Updating in Pod

Pods don't automatically reload secrets. After updating:

```bash
# Restart deployment
kubectl rollout restart deployment/block-watcher -n block-watcher

# Or delete pods (they'll be recreated)
kubectl delete pod -l app=block-watcher -n block-watcher
```

## Advanced: ConfigMaps

For non-sensitive configuration, use ConfigMaps instead of Secrets.

### Create ConfigMap

```bash
# From literal values
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=MAX_RETRIES=3 \
  -n block-watcher

# From file
kubectl create configmap app-config \
  --from-file=config.json \
  -n block-watcher
```

### Use in Pod

```yaml
# deployment.yaml
envFrom:
- configMapRef:
    name: app-config

# Or specific values
env:
- name: LOG_LEVEL
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: LOG_LEVEL
```

### When to Use ConfigMap vs Secret

**Use ConfigMap for:**
- Public configuration
- Non-sensitive data
- Configuration files
- Environment settings

**Use Secret for:**
- Passwords
- API keys
- Certificates
- Connection strings

## Production Deployment

### Transfer .env to Server

```bash
# Method 1: SCP
scp .env user@server:~/block-watcher/

# Method 2: Inline during SSH
ssh user@server 'cat > ~/block-watcher/.env' < .env
```

### Verify Secrets on Server

```bash
ssh user@server << 'EOF'
cd ~/block-watcher/k8s
kubectl get secrets -n block-watcher
kubectl get secret postgres-secret -n block-watcher -o yaml
EOF
```

## External Secret Management

For enterprise environments, consider external secret managers:

### AWS Secrets Manager
```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
```

### HashiCorp Vault
```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
```

### Sealed Secrets (GitOps)

Encrypt secrets for Git storage:
```bash
# Install sealed-secrets
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Install kubeseal CLI
brew install kubeseal

# Encrypt secret
kubectl create secret generic my-secret \
  --from-env-file=.env \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Now you can commit sealed-secret.yaml to Git
git add sealed-secret.yaml
git commit -m "Add encrypted secrets"
```

## Summary

**Configuration Flow:**
1. Create `.env` file with all variables
2. Run `./create-secrets.sh` to create Kubernetes secrets
3. Pods automatically load secrets as environment variables
4. Update secrets by editing `.env` and re-running script

**Key Points:**
- All configuration in `.env` file
- Automatic conversion to Kubernetes secrets
- Same format for local and production
- Secure by default (never commit .env)
- Easy to update and rotate

**Next Steps:**
- **[Observability](04-observability.md)** - Metrics and monitoring
- **[Kubernetes Reference](05-kubernetes-reference.md)** - Detailed manifest docs
