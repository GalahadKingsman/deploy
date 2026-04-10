import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { LessonsRepository } from '../../authoring/lessons.repository.js';
import { AssignmentsRepository } from '../../assignments/assignments.repository.js';

@ApiTags('Expert Assignments')
@Controller('experts/:expertId')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertAssignmentsController {
  constructor(
    private readonly lessonsRepository: LessonsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
  ) {}

  @Get('lessons/:lessonId/assignment')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Get assignment for lesson (reviewer+)' })
  @ApiResponse({ status: 200, description: 'Assignment (or null)' })
  async get(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<ContractsV1.GetLessonAssignmentResponseV1> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    return { assignment };
  }

  @Patch('lessons/:lessonId/assignment')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert assignment prompt for lesson (manager+)' })
  @ApiResponse({ status: 200, description: 'Assignment upserted' })
  async upsert(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: ContractsV1.UpsertAssignmentRequestV1,
  ): Promise<ContractsV1.AssignmentV1> {
    const parsed = ContractsV1.UpsertAssignmentRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      // Nest filter will map this to standard API error
      throw new Error('Validation failed');
    }
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    return await this.assignmentsRepository.upsertByLessonId({
      lessonId,
      promptMarkdown: parsed.data.promptMarkdown ?? null,
    });
  }
}

