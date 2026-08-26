import { Injectable } from '@nestjs/common';
import { prisma, User } from '@context-whisperer/database';

@Injectable()
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<User> {
    return await prisma.user.create({
      data,
    });
  }
}
