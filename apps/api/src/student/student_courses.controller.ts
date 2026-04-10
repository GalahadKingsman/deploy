import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { StudentCoursesRepository } from './student_courses.repository.js';

@ApiTags('Courses')
@Controller()
export class CoursesController {
  constructor(private readonly coursesRepository: StudentCoursesRepository) {}

  @Get('courses/:id')
  @ApiOperation({ summary: 'Get course by id (student)' })
  @ApiResponse({ status: 200, description: 'Course + lessons' })
  async getCourse(@Param('id') id: string): Promise<ContractsV1.GetCourseResponseV1> {
    const course = await this.coursesRepository.getCourse(id);
    if (!course) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });
    }
    const lessons = await this.coursesRepository.listLessonsByCourseId(id);
    return { course, lessons };
  }
}

