import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { OptionalJwtAuthGuard } from '../auth/session/optional-jwt-auth.guard.js';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { CourseModulesRepository } from '../authoring/course-modules.repository.js';
import { ProgressRepository } from './student_progress.repository.js';
import { computeCourseLessonAccess } from './student_lesson_access.js';

@ApiTags('Course Structure')
@Controller()
export class StudentCourseStructureController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly modulesRepository: CourseModulesRepository,
    private readonly progressRepository: ProgressRepository,
  ) {}

  @Get('courses/:id/modules')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List course modules (public; lessons require enrollment)' })
  @ApiResponse({ status: 200, description: 'Modules' })
  async listModules(@Param('id') id: string): Promise<ContractsV1.ListExpertCourseModulesResponseV1> {
    const course = await this.coursesRepository.getCourse(id);
    if (!course) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });
    const items = await this.modulesRepository.listByCourseId(id);
    return { items };
  }

  @Get('courses/:courseId/modules/:moduleId/lessons')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List module lessons (enrolled only; otherwise empty)' })
  @ApiResponse({ status: 200, description: 'Lessons' })
  async listModuleLessons(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: FastifyRequest & { user?: { userId?: string } },
  ): Promise<ContractsV1.ListModuleLessonsResponseV1> {
    const course = await this.coursesRepository.getCourse(courseId);
    if (!course) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });

    const userId = req.user?.userId ?? null;
    if (!userId) return { items: [], unlockedLessonIds: [], completedLessonIds: [] };
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId });
    if (!ok) return { items: [], unlockedLessonIds: [], completedLessonIds: [] };

    const items = await this.coursesRepository.listLessonsByModuleId({ courseId, moduleId });
    const access = await computeCourseLessonAccess({
      userId,
      courseId,
      coursesRepository: this.coursesRepository,
      progressRepository: this.progressRepository,
    });
    const lessonIds = new Set(items.map((x) => x.id));
    return {
      items,
      unlockedLessonIds: access.unlockedLessonIds.filter((id) => lessonIds.has(id)),
      completedLessonIds: access.completedLessonIds.filter((id) => lessonIds.has(id)),
    };
  }
}

