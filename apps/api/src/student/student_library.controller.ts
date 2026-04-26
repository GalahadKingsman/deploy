import { Controller, Get, Query } from '@nestjs/common';
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
  async getLibrary(
    @Query('q') q: string | undefined,
    @Query('topic') topic: string | undefined,
  ): Promise<ContractsV1.GetLibraryResponseV1> {
    return await this.coursesRepository.listLibrary({
      q: typeof q === 'string' ? q : undefined,
      topic: typeof topic === 'string' ? topic : undefined,
    });
  }
}

