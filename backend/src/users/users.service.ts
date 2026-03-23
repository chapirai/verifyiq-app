import { Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    return await this.userRepository.findOneOrFail({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return await this.userRepository.findOne({ where: { email } }) ?? undefined;
  }

  async findAllByTenant(tenantId: string): Promise<User[]> {
    return await this.userRepository.find({ where: { tenantId } });
  }

  async create(user: Partial<User>, _userId?: string): Promise<User> {
    const entity = this.userRepository.create(user);
    return await this.userRepository.save(entity);
  }

  async update(id: string, user: Partial<User>, _userId?: string): Promise<User> {
    const { tenant: _tenant, refreshTokens: _refreshTokens, auditLogs: _auditLogs, ...safeFields } = user;
    await this.userRepository.update(id, safeFields);
    return this.findById(id);
  }
}