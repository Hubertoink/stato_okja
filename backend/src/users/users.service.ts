import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findAll() { return this.repo.find({ relations: { org: true } }); }
  create(data: Partial<User>) { const u = this.repo.create(data); return this.repo.save(u); }
}
