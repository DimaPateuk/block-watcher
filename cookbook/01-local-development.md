# Local Development Guide

Running Block Watcher on your local machine for development.

## Prerequisites

### Required Software
- **Node.js 20+** (LTS version)
- **Docker** (for running PostgreSQL)
- **Docker Compose** (for orchestration)
- **Git**

### Install Node.js
```bash
# macOS (using Homebrew)
brew install node@20

# Verify
node --version  # Should be 20.x
npm --version   # Should be 10.x
```

### Install Docker & Docker Compose
```bash
# macOS
brew install docker docker-compose

# Or install Docker Desktop (includes Docker Compose)
# Download from https://www.docker.com/products/docker-desktop

# Verify
docker --version
docker-compose --version
```

## Initial Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd block-watcher
```

### 2. Install Dependencies
```bash
npm install
```

This installs:
- NestJS framework
- Prisma ORM
- Testing tools (Jest)
- TypeScript compiler
- All other dependencies

### 3. Setup Database with Docker Compose

**Using Docker Compose (Recommended):**
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Verify it's running
docker-compose ps

# View logs
docker-compose logs -f postgres
```

The `docker-compose.yml` file already configures PostgreSQL with:
- Database: `blockwatcher`
- User: `postgres`
- Password: from `.env` file
- Port: `5432`

### 4. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit with your values
vim .env
```

**Example `.env` for local development:**
```env
# Database Configuration
POSTGRES_DB=blockwatcher
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-12345-secure-password-here

# Application Database URL (use localhost for local development)
DATABASE_URL=postgresql://postgres:your-12345-secure-password-here@localhost:5432/blockwatcher

# Application Configuration
NODE_ENV=development
PORT=3000

# Ethereum RPC URL
RPC_ETH_MAINNET_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY_HERE
```

### 5. Run Database Migrations
```bash
# Apply schema to database
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

This creates the `EvmBlock` table and other database structures.

### 6. Start Development Server
```bash
npm run start:dev
```

The app starts with hot-reload enabled. Changes to code automatically restart the server.

### 7. Verify It's Working
```bash
# Check health endpoint
curl http://localhost:3000/api/health/liveness

# Expected response:
# {"status":"ok","info":{"database":{"status":"up"}}}

# View Swagger docs
open http://localhost:3000/docs

# View metrics
curl http://localhost:3000/api/metrics
```

## Development Workflow

### File Structure
```
src/
├── main.ts                   # Entry point - app configuration
├── app.module.ts             # Root module - imports all modules
├── evm-blocks/               # Blockchain watching
│   ├── evm-blocks.module.ts
│   ├── evm-blocks.service.ts
│   ├── evm-blocks.controller.ts
│   └── evm-blocks.service.spec.ts
├── metrics/                  # Prometheus metrics
│   ├── metrics.module.ts
│   ├── metrics.service.ts
│   ├── metrics.controller.ts
│   └── metrics.middleware.ts
├── health/                   # Health checks
│   ├── health.module.ts
│   └── health.controller.ts
├── prisma/                   # Database service
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── rpc/                      # Ethereum RPC client
    ├── rpc.module.ts
    └── rpc.service.ts
```

### Hot Reload
The dev server watches for changes:
```bash
npm run start:dev
```

When you save a file, the server automatically:
1. Compiles TypeScript
2. Restarts the application
3. Reconnects to database

### Running Tests

**Unit Tests**
```bash
# Run all unit tests
npm test

# Run specific file
npm test -- evm-blocks.service.spec.ts

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage
npm run test:cov
open coverage/index.html
```

**E2E Tests**
```bash
# Run all E2E tests
npm run test:e2e

# With coverage
npm run test:e2e:cov
open coverage-e2e/index.html
```

### Database Management

**View Data in Database**
```bash
# Using Prisma Studio (GUI)
npx prisma studio
# Opens http://localhost:5555
```

**Run Prisma Commands**
```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name add_new_field

# Reset database (WARNING: deletes all data!)
npx prisma migrate reset

# Seed database
npx prisma db seed
```

**Direct SQL Access**
```bash
# Connect to database
psql postgresql://postgres:password@localhost:5432/blockwatcher

# Run queries
SELECT * FROM "EvmBlock" LIMIT 10;
```

### Debugging

**Using VS Code**
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:dev"],
      "console": "integratedTerminal"
    }
  ]
}
```

**Viewing Logs**
```bash
# Structured JSON logs in development
npm run start:dev

# Pretty logs
npm run start:dev | pino-pretty
```

**Debug Specific Service**
```typescript
// Add console logs
console.log('Debug info:', data);

// Or use logger
this.logger.debug('Debug info', data);
```

### Making Code Changes

**1. Create Feature Branch**
```bash
git checkout -b feature/add-new-endpoint
```

**2. Write Test First (TDD)**
```typescript
// src/evm-blocks/evm-blocks.service.spec.ts
describe('EvmBlocksService', () => {
  it('should fetch latest block', async () => {
    const block = await service.getLatestBlock(1);
    expect(block).toBeDefined();
    expect(block.chainId).toBe(1);
  });
});
```

**3. Implement Feature**
```typescript
// src/evm-blocks/evm-blocks.service.ts
async getLatestBlock(chainId: number) {
  return this.prisma.evmBlock.findFirst({
    where: { chainId },
    orderBy: { number: 'desc' }
  });
}
```

**4. Run Tests**
```bash
npm test
npm run test:e2e
```

**5. Test Manually**
```bash
# Start dev server
npm run start:dev

# Test endpoint
curl http://localhost:3000/api/evm-blocks/latest?chainId=1
```

### Adding New Endpoints

**1. Add to Controller**
```typescript
// src/evm-blocks/evm-blocks.controller.ts
import { Controller, Get, Query } from '@nestjs/common';

@Controller('evm-blocks')
export class EvmBlocksController {
  constructor(private readonly service: EvmBlocksService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get latest block' })
  async getLatest(@Query('chainId') chainId: string) {
    return this.service.getLatestBlock(parseInt(chainId));
  }
}
```

**2. Implement in Service**
```typescript
// src/evm-blocks/evm-blocks.service.ts
async getLatestBlock(chainId: number) {
  return this.prisma.evmBlock.findFirst({
    where: { chainId },
    orderBy: { number: 'desc' }
  });
}
```

**3. Add Metrics**
```typescript
this.metricsService.httpRequestsTotal
  .labels('GET', '/api/evm-blocks/latest', '200')
  .inc();
```

**4. Test**
```bash
curl http://localhost:3000/api/evm-blocks/latest?chainId=1
```

### Environment Variables

**Development Environment**
```env
# .env (local development)
DATABASE_URL=postgresql://postgres:password@localhost:5432/blockwatcher
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

**Using Environment Variables in Code**
```typescript
// src/app.module.ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true  // Makes config available everywhere
    }),
    // ... other modules
  ]
})
export class AppModule {}

// Using in service
import { ConfigService } from '@nestjs/config';

constructor(private config: ConfigService) {}

getPort() {
  return this.config.get<number>('PORT', 3000);
}
```

## Common Commands

```bash
# Development
npm run start:dev          # Start with hot-reload
npm run start:debug        # Start with debugger
npm run build              # Build for production
npm run start:prod         # Run production build

# Testing
npm test                   # Unit tests
npm run test:watch         # Unit tests (watch mode)
npm run test:cov           # Unit tests with coverage
npm run test:e2e           # E2E tests
npm run test:e2e:cov       # E2E tests with coverage

# Database
npx prisma studio          # GUI database browser
npx prisma migrate dev     # Run migrations
npx prisma generate        # Generate Prisma client
npx prisma db push         # Push schema without migration

# Linting & Formatting
npm run lint               # Check linting
npm run format             # Format code
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection string
cat .env | grep DATABASE_URL

# Test connection
psql postgresql://postgres:password@localhost:5432/blockwatcher
```

### Prisma Client Not Generated
```bash
# Regenerate Prisma client
npx prisma generate

# Clean and reinstall
rm -rf node_modules
npm install
npx prisma generate
```

### Tests Failing
```bash
# Clear Jest cache
npm test -- --clearCache

# Reset test database
NODE_ENV=test npx prisma migrate reset

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Module Not Found Errors
```bash
# Rebuild
npm run build

# Clean build
rm -rf dist
npm run build
```

## Next Steps

Once comfortable with local development:

1. **[Configuration Guide](03-configuration.md)** - Managing secrets and environment variables
2. **[Observability](04-observability.md)** - Adding metrics and monitoring
3. **[Kubernetes Deployment](02-kubernetes-deployment.md)** - Deploy to production

## Best Practices

- Always write tests before code (TDD)
- Use TypeScript types everywhere (no `any`)
- Follow existing code patterns
- Add Swagger documentation to endpoints
- Include metrics for important operations
- Use structured logging
- Keep functions small and focused
- Write descriptive commit messages
