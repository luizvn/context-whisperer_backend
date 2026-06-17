import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

async function bootstrap() {
  const adapter = new FastifyAdapter();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  await app.listen({
    port: Number(process.env.PORT || 3000),
    host: '0.0.0.0',
  });

  console.log(
    `Server listening on ${process.env.PORT || 3000}`,
  );

  // const port = process.env.PORT ?? 3000;
  // await app.listen(port);
}
void bootstrap();
