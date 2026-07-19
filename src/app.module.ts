import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { throttleConfig } from './config/throttle.config';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => throttleConfig(),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
