import { Global, Module } from '@nestjs/common';
import { SecretCryptoService } from './secret-crypto.service';

// Global: both SettingsService and AiProvidersService encrypt secrets with
// the same key, and more consumers are likely (webhook signing secrets, etc).
@Global()
@Module({
  providers: [SecretCryptoService],
  exports: [SecretCryptoService],
})
export class CryptoModule {}
