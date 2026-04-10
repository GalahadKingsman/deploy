import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { TopicsRepository } from '../authoring/topics.repository.js';

@ApiTags('Topics')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudentTopicsController {
  constructor(private readonly topicsRepository: TopicsRepository) {}

  @Get('topics')
  @ApiOperation({ summary: 'List all topics (for course editor)' })
  @ApiResponse({ status: 200, description: 'Topics' })
  async list(): Promise<ContractsV1.ListTopicsResponseV1> {
    const items = await this.topicsRepository.listAll();
    return { items };
  }
}
