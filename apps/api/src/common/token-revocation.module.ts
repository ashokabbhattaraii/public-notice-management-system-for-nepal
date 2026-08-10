import { Global, Module } from '@nestjs/common';
import { TokenRevocationService } from './token-revocation.service';

/**
 * Owns the single TokenRevocationService instance.
 *
 * JwtAuthGuard/OptionalJwtAuthGuard inject it, and those guards are applied by
 * controllers spread across several feature modules. A guard is instantiated in
 * the injector of the module that hosts the controller, so every such module
 * needs the service in scope — otherwise the guard is built with an undefined
 * dependency and every request to that controller dies with
 * "Cannot read properties of undefined (reading 'isRevoked')".
 *
 * Global so the service is a process-wide singleton (a second instance would
 * mean logouts recorded in one module aren't seen by another); feature modules
 * still import it explicitly to keep the dependency visible.
 */
@Global()
@Module({
  providers: [TokenRevocationService],
  exports: [TokenRevocationService],
})
export class TokenRevocationModule {}
