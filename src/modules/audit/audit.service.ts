import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit.entity';

export interface AuditLogData {
  action: string;
  entityType: string;
  entityId?: number;
  oldValue?: any;
  newValue?: any;
  userId?: number | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(data: AuditLogData): Promise<AuditLog> {
    const log = this.auditRepository.create({
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      userId: data.userId,
    });

    return this.auditRepository.save(log);
  }

  async getHistory(entityType: string, entityId?: number): Promise<AuditLog[]> {
    const query = this.auditRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.entityType = :entityType', { entityType })
      .orderBy('log.createdAt', 'DESC');

    if (entityId) {
      query.andWhere('log.entityId = :entityId', { entityId });
    }

    return query.getMany();
  }

  async getUserActions(userId: number): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
