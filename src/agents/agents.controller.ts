import { Body, Controller, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
  ) {}

  @Post('uml')
  async generateUml(
    @Body() body: { description: string },
  ) {
    return this.agentsService.generateUml(
      body.description,
    );
  }
}