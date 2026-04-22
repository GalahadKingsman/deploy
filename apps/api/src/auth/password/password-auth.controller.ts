import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { PasswordAuthService } from './password-auth.service.js';

@ApiTags('Auth')
@Controller()
export class PasswordAuthController {
  constructor(private readonly passwordAuthService: PasswordAuthService) {}

  @Post('auth/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register by email+password (auto-login)' })
  @ApiResponse({ status: 200, description: 'Registered and logged in' })
  async register(@Body() body: unknown): Promise<ContractsV1.AuthPasswordResponseV1> {
    const parsed = ContractsV1.AuthRegisterRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    return await this.passwordAuthService.register(parsed.data);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login by email+password' })
  @ApiResponse({ status: 200, description: 'Logged in' })
  async login(@Body() body: unknown): Promise<ContractsV1.AuthPasswordResponseV1> {
    const parsed = ContractsV1.AuthLoginRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const out = await this.passwordAuthService.login(parsed.data);
    if (!out) {
      throw new UnauthorizedException({ code: ErrorCodes.UNAUTHORIZED, message: 'Invalid email or password' });
    }
    return out;
  }
}

