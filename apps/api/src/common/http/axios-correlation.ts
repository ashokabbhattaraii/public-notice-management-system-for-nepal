import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { currentTrace } from '../logger/trace-context';

/**
 * Attach the in-flight correlation id as the `x-request-id` header to outbound
 * HTTP calls.
 *
 * IMPORTANT: `@nestjs/axios`'s HttpModule builds a fresh axios instance per
 * module via `axios.create(config)` — and that call happens at module LOAD time
 * (the `HttpModule.register(...)` expression sits inside the `@Module(...)`
 * decorator). Main.ts must therefore import this module BEFORE `AppModule`, so
 * every HttpService instance picks up the interceptor. See `src/main.ts`.
 */
export function installAxiosCorrelation(): void {
  // TS's typed export takes `import axios from 'axios'`; the CJS runtime adds a
  // self-referential `.default`, which @nestjs/axios itself targets. Resolve the
  // same object explicitly so the patch lands where HttpModule creates from.
  const axiosInstance = (axios as unknown as { default: typeof axios }).default;

  const originalCreate = axiosInstance.create.bind(axiosInstance);

  axiosInstance.create = ((config?: AxiosRequestConfig): AxiosInstance => {
    const instance = originalCreate(config);
    instance.interceptors.request.use((requestConfig) => {
      const { requestId } = currentTrace();
      if (requestId && requestId !== '-') {
        requestConfig.headers['x-request-id'] = requestId;
      }
      return requestConfig;
    });
    return instance;
  }) as typeof axiosInstance.create;
}

installAxiosCorrelation();