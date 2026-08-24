import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

// 3001 is taken by Botc in the rosti stack, so the quiz listens on 3002.
const PORT = Number(process.env.PORT ?? 3002);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(PORT);
  console.log(`Quiz server running on http://localhost:${PORT}`);
}
bootstrap();
