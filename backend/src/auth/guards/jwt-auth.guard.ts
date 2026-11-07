import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// @UseGuards(JwtAuthGuard) 를 붙인 라우트는 Authorization: Bearer <accessToken> 필요
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
