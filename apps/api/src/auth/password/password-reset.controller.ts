import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { PasswordResetService } from './password-reset.service.js';

@ApiTags('Auth')
@Controller('auth/password/reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm password reset by one-time token' })
  @ApiResponse({ status: 200, description: 'OK' })
  async confirm(@Body() body: unknown): Promise<ContractsV1.AuthPasswordResetConfirmResponseV1> {
    const parsed = ContractsV1.AuthPasswordResetConfirmRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
      });
    }
    return await this.passwordResetService.confirmReset(parsed.data);
  }
}

