import { ConflictException, Injectable } from '@nestjs/common';
import { User } from '@context-whisperer/database';
import { UserRepository } from './user.repository';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<User> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    return this.userRepository.create({
      name: data.name,
      email: data.email,
      password: passwordHash,
      role: data.role ?? 'user',
    });
  }
}
