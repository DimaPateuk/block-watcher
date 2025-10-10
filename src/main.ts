import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "nestjs-pino";
import { ValidationPipe } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import pkg from "../package.json";

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
