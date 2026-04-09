import { Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

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

  async findByTenantAndEmail(tenantId: string, email: string): Promise<User | undefined> {
    return (
      (await this.userRepository.findOne({
        where: { tenantId, email: email.trim().toLowerCase() },
      })) ?? undefined
    );
  }

  async findAllByTenant(tenantId: string): Promise<User[]> {
    return await this.userRepository.find({ where: { tenantId } });
  }

  async create(user: Partial<User>, _userId?: string): Promise<User> {
    const payload: Partial<User> & { password?: string } = { ...user } as any;
    if (payload.password) {
      payload.passwordHash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }
    const entity = this.userRepository.create(payload);
    return await this.userRepository.save(entity);
  }

  async update(id: string, user: Partial<User>, _userId?: string): Promise<User> {
    const payload: Partial<User> & { password?: string } = { ...user } as any;
    if (payload.password) {
      payload.passwordHash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }
    const { tenant: _tenant, refreshTokens: _refreshTokens, auditLogs: _auditLogs, ...safeFields } = payload;
    await this.userRepository.update(id, safeFields);
    return this.findById(id);
  }
}