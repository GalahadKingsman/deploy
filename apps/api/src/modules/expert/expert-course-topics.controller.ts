import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { TopicsRepository } from '../../authoring/topics.repository.js';
import { CoursesRepository } from '../../authoring/courses.repository.js';

@ApiTags('Expert Course Topics')
@Controller('experts/:expertId/courses/:courseId/topics')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertCourseTopicsController {
  constructor(
    private readonly topicsRepository: TopicsRepository,
    private readonly coursesRepository: CoursesRepository,
  ) {}

  @Get()
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List topics assigned to course' })
  @ApiResponse({ status: 200, description: 'Topics' })
  async list(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
  ): Promise<ContractsV1.ListCourseTopicsResponseV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    const items = await this.topicsRepository.listForCourse(courseId);
    return { items };
  }

  @Put()
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Replace course topics (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async replace(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Body() body: unknown,
  ): Promise<ContractsV1.ListCourseTopicsResponseV1> {
    const parsed = ContractsV1.SetCourseTopicsRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    await this.topicsRepository.setCourseTopics({
      expertId,
      courseId,
      topicIds: parsed.data.topicIds,
    });
    const items = await this.topicsRepository.listForCourse(courseId);
    return { items };
  }
}
