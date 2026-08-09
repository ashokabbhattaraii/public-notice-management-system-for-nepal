import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from './users.module';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { TokenRevocationService } from '../common/token-revocation.service';

// Global: JwtAuthGuard/OptionalJwtAuthGuard (which depend on
// TokenRevocationService) are used by every feature module's controllers,
// not just auth's own — without @Global(), each of those modules would need
// to import AuthModule individually, and any that forgot would silently get
// an undefined TokenRevocationService injected into the guard.
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
