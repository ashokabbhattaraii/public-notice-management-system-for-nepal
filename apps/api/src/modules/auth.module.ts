import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from './users.module';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { TokenRevocationService } from '../common/token-revocation.service';

/**
 * Global: JwtAuthGuard/OptionalJwtAuthGuard inject TokenRevocationService and
 * are used by controllers in other modules (documents, scraping, rag,
 * settings) that don't import AuthModule. Without @Global(), Nest can't
 * resolve that dependency there and silently leaves it undefined instead of
 * failing at boot, which crashes every guarded route at request time.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TokenRevocationService],
  exports: [AuthService, TokenRevocationService],
})
export class AuthModule {}
