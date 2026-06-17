// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { setDefaultOpenAIKey } from '@openai/agents';
// import { OpenAIService } from '../openai/openai.service';
// import * as fs from 'fs/promises';
// import * as path from 'path';

// @Injectable()
// export class AgentsService {
//   constructor(
//     private configService: ConfigService,
//     private readonly openaiService: OpenAIService,
//   ) {
//     const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');

//     if (!openaiApiKey) {
//       throw new Error('OPENAI_API_KEY is required but not provided');
//     }

//     setDefaultOpenAIKey(openaiApiKey);
//   }

//   // async generateUml(description: string) {
//   //   const promptPath = path.join(
//   //     process.cwd(),
//   //     'src',
//   //     'agents',
//   //     'prompts',
//   //     'agent-mvp-prompt.txt',
//   //   );

//   //   // let prompt = await fs.readFile(promptPath, 'utf-8');

//   //   // prompt = prompt.replace('{{DESCRIPTION}}', description);

//   //   // const response = await this.openaiService.getClient().responses.create({
//   //   //   model: 'gpt-4',
//   //   //   input: prompt,
//   //   // });

//   //   return 'response.output_tex';
//   // }
// }
