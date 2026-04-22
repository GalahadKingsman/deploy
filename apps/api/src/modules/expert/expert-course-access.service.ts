import { ForbiddenException, Injectable } from '@nestjs/common';
import { ErrorCodes } from '@tracked/shared';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertMemberCourseAccessRepository } from '../../experts/expert-member-course-access.repository.js';
import { LessonsRepository } from '../../authoring/lessons.repository.js';
import { CoursesRepository } from '../../authoring/courses.repository.js';

@Injectable()
export class ExpertCourseAccessService {
  constructor(
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly expertMemberCourseAccessRepository: ExpertMemberCourseAccessRepository,
    private readonly lessonsRepository: LessonsRepository,
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async assertCanAccessCourse(params: {
    expertId: string;
    userId: string;
    courseId: string;
  }): Promise<void> {
    const { expertId, userId, courseId } = params;
    const member = await this.expertMembersRepository.findMember(expertId, userId);
    if (!member) {
      throw new ForbiddenException({
        code: ErrorCodes.EXPERT_MEMBERSHIP_REQUIRED,
        message: 'Expert membership required',
      });
    }
    if (member.role === 'owner') {
      return;
    }
    const ok = await this.expertMemberCourseAccessRepository.hasAccess(expertId, userId, courseId);
    if (!ok) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN_EXPERT_COURSE_ACCESS,
        message: 'No access to this course for your role',
      });
    }
  }

  async assertCanAccessModule(params: {
    expertId: string;
    userId: string;
    moduleId: string;
  }): Promise<void> {
    const { courseId } = await this.coursesRepository.assertModuleBelongsToExpert(params);
    await this.assertCanAccessCourse({
      expertId: params.expertId,
      userId: params.userId,
      courseId,
    });
  }

  async assertCanAccessLesson(params: {
    expertId: string;
    userId: string;
    lessonId: string;
  }): Promise<void> {
    const { courseId } = await this.lessonsRepository.assertLessonBelongsToExpert({
      expertId: params.expertId,
      lessonId: params.lessonId,
    });
    await this.assertCanAccessCourse({
      expertId: params.expertId,
      userId: params.userId,
      courseId,
    });
  }
}
