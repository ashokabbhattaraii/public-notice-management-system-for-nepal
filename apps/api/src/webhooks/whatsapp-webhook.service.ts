import {Injectable, Logger} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);
    private readonly apiUrl : string;
    private readonly apiKey : string;
    private readonly instanceName : string;


    constructor(private readonly configService: ConfigService){
        this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL') || 'http://localhost:8080';
        this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
        this.instanceName = this.configService.get<string>('EVOLUTION_INSTANCE_NAME') || '';
    }
    async sendMessage(action: string, payload: any) {
       const url = `${this.apiUrl}/message/${action}/${this.instanceName}`;

       try {
        await fetch(url,{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: this.apiKey,
            },
            body: JSON.stringify(payload),
        })
       }
         catch (error:any) {
            this.logger.error(`Failed to send message to Evolution API: ${error.message}`);
         }
    }
}
