import { Controller, Sse, UseGuards, Req, MessageEvent } from '@nestjs/common';
import { EventsService } from './events.service';
import { SseAuthGuard } from './guards/sse-auth.guard';
import { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { User } from '@context-whisperer/database';

interface RequestWithUser extends FastifyRequest {
  user: User;
}

@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse('stream')
  @UseGuards(SseAuthGuard)
  streamEvents(@Req() req: RequestWithUser): Observable<MessageEvent> {
    const userId = req.user.id;
    return this.eventsService.getUserEventStream(userId);
  }
}
