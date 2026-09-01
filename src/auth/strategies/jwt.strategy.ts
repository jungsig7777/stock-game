import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  // 여기서 반환하는 값이 request.user 에 들어간다 (= CurrentUser 데코레이터가 읽는 값)
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return { sub: payload.sub, role: payload.role };
  }
}
