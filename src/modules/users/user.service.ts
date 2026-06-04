import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../../config/database.config';
import { usersTable } from './user.schema';
import * as bcrypt from 'bcrypt';

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: PostgresJsDatabase,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    return user ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    return user ?? null;
  }

  async createUser(data: NewUser): Promise<User> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const [createdUser] = await this.db
      .insert(usersTable)
      .values({
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: data.role ?? 'user',
      })
      .returning();

    return createdUser;
  }
}
