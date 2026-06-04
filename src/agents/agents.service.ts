import { Injectable} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setDefaultOpenAIKey } from '@openai/agents';


@Injectable()
export class AgentsService {
  constructor(private configService: ConfigService) {
    
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required but not provided');
    }

    setDefaultOpenAIKey(openaiApiKey);
  }

   async generateUml(description: string) {

    return {
      message: 'Agent funcionando',
      description,
    };

  }

}