import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { StudentCoursesRepository } from '../student/student_courses.repository.js';

@ApiTags('Catalog')
@Controller()
export class PublicCatalogController {
  constructor(private readonly coursesRepository: StudentCoursesRepository) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Public catalog (alias of library; published & public courses)' })
  @ApiResponse({ status: 200, description: 'Catalog list' })
  async list(): Promise<ContractsV1.GetLibraryResponseV1> {
    return await this.coursesRepository.listLibrary();
  }

  @Get('catalog/courses/:id')
  @ApiOperation({ summary: 'Public catalog course detail (alias of /courses/:id)' })
  @ApiResponse({ status: 200, description: 'Course + lessons' })
  async get(@Param('id') id: string): Promise<ContractsV1.GetCourseResponseV1> {
    const course = await this.coursesRepository.getCourse(id);
    if (!course) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });
    const lessons = await this.coursesRepository.listLessonsByCourseId(id);
    return { course, lessons };
  }
}

