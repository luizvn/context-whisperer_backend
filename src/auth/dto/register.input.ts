import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, Length } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @Length(2, 100)
  name!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @Length(8, 128)
  password!: string;

  @Field({ nullable: true })
  @IsOptional()
  role?: string;
}
