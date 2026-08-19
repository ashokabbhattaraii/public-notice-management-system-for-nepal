import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EvolutionConnectionState {
  instance?: { instanceName: string; state: string };
  state?: string;
}

export interface EvolutionQrResponse {
  base64?: string;
  code?: string;
  pairingCode?: string;
}

/**
 * Thin typed client for the shared Evolution API WhatsApp instance. One
 * instance name is configured for the whole app (EVOLUTION_INSTANCE_NAME) —
 * it represents a single sender number, not a per-user session (see
 * NotificationsService for the per-user phone verification flow that sits
 * on top of this single instance).
 */
// A stuck/slow Evolution API request must never hang the caller indefinitely
// — the alert queue processes one item at a time (see AlertMatchingService),
// so one unbounded request would otherwise stall every alert behind it.
const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly instanceName: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = (this.configService.get<string>('EVOLUTION_API_URL') || 'http://localhost:8080').replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
    this.instanceName = this.configService.get<string>('EVOLUTION_INSTANCE_NAME') || '';
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
    };
  }

  private fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey && this.instanceName);
  }

  /**
   * Send a plain text WhatsApp message to a phone number (E.164 digits, no
   * "+"). `linkPreview: true` (default) tells Baileys to render any URL in
   * the text as a tappable link with a preview card — without it explicitly
   * set, some Evolution API versions default to suppressing link detection.
   */
  async sendText(number: string, text: string, linkPreview = true): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('Evolution API not configured — skipping sendText');
      return false;
    }
    const url = `${this.apiUrl}/message/sendText/${this.instanceName}`;
    try {
      const res = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ number, text, linkPreview }),
      });
      if (!res.ok) {
        this.logger.error(`sendText failed (${res.status}): ${await res.text()}`);
        return false;
      }
      return true;
    } catch (error: any) {
      this.logger.error(`sendText error: ${error.message}`);
      return false;
    }
  }

  async getConnectionState(): Promise<EvolutionConnectionState | null> {
    if (!this.isConfigured()) return null;
    const url = `${this.apiUrl}/instance/connectionState/${this.instanceName}`;
    try {
      const res = await this.fetchWithTimeout(url, { headers: this.headers() });
      if (!res.ok) return null;
      return (await res.json()) as EvolutionConnectionState;
    } catch (error: any) {
      this.logger.error(`getConnectionState error: ${error.message}`);
      return null;
    }
  }

  /** QR code / pairing code for connecting the shared sender instance. Admin-only usage. */
  async getQrCode(): Promise<EvolutionQrResponse | null> {
    if (!this.isConfigured()) return null;
    const url = `${this.apiUrl}/instance/connect/${this.instanceName}`;
    try {
      const res = await this.fetchWithTimeout(url, { headers: this.headers() });
      if (!res.ok) return null;
      return (await res.json()) as EvolutionQrResponse;
    } catch (error: any) {
      this.logger.error(`getQrCode error: ${error.message}`);
      return null;
    }
  }

  /**
   * Force-disconnect the shared sender instance's active WhatsApp session
   * (does not delete the instance itself), so an admin can scan a fresh QR
   * to link a different number. Admin-only usage.
   */
  async logout(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const url = `${this.apiUrl}/instance/logout/${this.instanceName}`;
    try {
      const res = await this.fetchWithTimeout(url, { method: 'DELETE', headers: this.headers() });
      if (!res.ok) {
        this.logger.error(`logout failed (${res.status}): ${await res.text()}`);
        return false;
      }
      return true;
    } catch (error: any) {
      this.logger.error(`logout error: ${error.message}`);
      return false;
    }
  }
}
