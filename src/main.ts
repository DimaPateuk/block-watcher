import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "nestjs-pino";
import { ValidationPipe } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import pkg from "../package.json";

// TODO: Remove this polyfill after upgrading to Node.js 20+ LTS
// @nestjs/schedule still requires crypto.randomUUID() on Node 18.x
if (!globalThis.crypto?.randomUUID) {
  const { randomUUID } = require('crypto');
  globalThis.crypto = { ...globalThis.crypto, randomUUID };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle("Ethereum Block Watcher API")
    .setDescription(
      "Watches Ethereum blocks, stores them in Postgres, exposes REST endpoints."
    )
    .setVersion(pkg.version)
    .addTag("Block Watcher")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api`);
  console.log(`📘 Swagger docs at http://localhost:${port}/docs`);
}
bootstrap();
