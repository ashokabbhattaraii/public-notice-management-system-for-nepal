import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from './users.module';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { TokenRevocationModule } from '../common/token-revocation.module';

@Module({
  imports: [
    ConfigModule,
    TokenRevocationModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret === 'change-me-in-production' || secret.length < 32) {
          throw new Error(
            'JWT_SECRET must be set to a strong random value (>=32 chars). Refusing to start with default/weak secret.',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as `${number}d`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, TokenRevocationModule],
})
export class AuthModule {}
