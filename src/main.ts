import { NestFactory } from '@nestjs/core';
import { AppModule } from './App.module';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useWebSocketAdapter(new WsAdapter(app));

    await app.listen(3000, '0.0.0.0');
    console.log('Application is running on: http://localhost:3000');
}

void bootstrap();
