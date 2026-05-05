import bcrypt from 'bcryptjs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { UsersRepository } from '../../users/users.repository.js';
import { ReferralAttributionService } from '../../users/referral-attribution.service.js';
import { JwtService } from '../session/jwt.service.js';

@Injectable()
export class PasswordAuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly referralAttribution: ReferralAttributionService,
  ) {}

  async register(input: ContractsV1.AuthRegisterRequestV1): Promise<ContractsV1.AuthPasswordResponseV1> {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Email already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersRepository.createEmailUser({
      email,
      passwordHash,
      firstName,
      lastName,
    });

    await this.referralAttribution.tryAttributeByCode({
      userId: user.id,
      rawCode: input.referralAttributionCode ?? null,
    });

    const accessToken = this.jwtService.signAccessToken({
      userId: user.id,
      telegramUserId: user.telegramUserId ?? '',
    });

    return { user, accessToken };
  }

  async login(input: ContractsV1.AuthLoginRequestV1): Promise<ContractsV1.AuthPasswordResponseV1 | null> {
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    const user = await this.usersRepository.findByEmail(email);
    const hash = user?.passwordHash ?? null;
    if (!user || !hash) return null;

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return null;

    await this.referralAttribution.tryAttributeByCode({
      userId: user.id,
      rawCode: input.referralAttributionCode ?? null,
    });

    const accessToken = this.jwtService.signAccessToken({
      userId: user.id,
      telegramUserId: user.telegramUserId ?? '',
    });
    // Strip passwordHash from return
    const { passwordHash, ...safe } = user as any;
    return { user: safe as ContractsV1.UserV1, accessToken };
  }
}

