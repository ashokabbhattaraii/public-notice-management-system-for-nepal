import { Controller, Post, Body, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return { message: 'Login endpoint', token: 'placeholder' };
  }

  @Post('register')
  register(@Body() body: { email: string; password: string; name: string }) {
    return { message: 'Register endpoint', user: { email: body.email, name: body.name } };
  }

  @Get('me')
  me() {
    return { message: 'Current user endpoint' };
  }
}
