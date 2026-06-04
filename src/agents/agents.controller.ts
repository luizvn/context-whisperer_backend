import { Body, Controller, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import {
  ApiTags,
  //   ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('uml')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          example: 'Sistema de gerenciamento de biblioteca',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'string',
      example: `
    Atores:
    - Usuário

    Casos de Uso:
    - Emprestar Livro

    @startuml
    ...
    @enduml
    `,
    },
  })
  async generateUml(@Body() body: { description: string }) {
    return this.agentsService.generateUml(body.description);
  }
}
