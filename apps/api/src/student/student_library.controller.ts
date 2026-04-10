import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { StudentCoursesRepository } from './student_courses.repository.js';

@ApiTags('Library')
@Controller()
export class LibraryController {
  constructor(private readonly coursesRepository: StudentCoursesRepository) {}

  @Get('library')
  @ApiOperation({ summary: 'Public library (published & public courses)' })
  @ApiResponse({ status: 200, description: 'Library' })
  async getLibrary(): Promise<ContractsV1.GetLibraryResponseV1> {
    return await this.coursesRepository.listLibrary();
  }
}

