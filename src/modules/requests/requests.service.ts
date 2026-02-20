import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Request, RequestStatus } from './entities/request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private requestsRepository: Repository<Request>,
    private dataSource: DataSource,
    private auditService: AuditService,
    private usersService: UsersService,
  ) {}

  async create(createRequestDto: CreateRequestDto): Promise<Request> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = this.requestsRepository.create({
        ...createRequestDto,
        status: RequestStatus.NEW,
      });
      
      const savedRequest = await queryRunner.manager.save(request);
      
      await this.auditService.log({
        action: 'CREATE_REQUEST',
        entityId: savedRequest.id,
        entityType: 'request',
        newValue: savedRequest,
        userId: null, // Создано через публичную форму
      });

      await queryRunner.commitTransaction();
      return savedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters: any, user?: any): Promise<Request[]> {
    const query = this.requestsRepository.createQueryBuilder('request')
      .leftJoinAndSelect('request.assignedTo', 'assignedTo')
      .orderBy('request.createdAt', 'DESC');

    if (filters.status) {
      query.andWhere('request.status = :status', { status: filters.status });
    }

    // Если пользователь - мастер, показываем только его заявки
    if (user && user.role === UserRole.MASTER) {
      query.andWhere('request.assignedToId = :masterId', { masterId: user.id });
    }

    if (filters.masterId) {
      query.andWhere('request.assignedToId = :masterId', { masterId: filters.masterId });
    }

    if (filters.search) {
      query.andWhere(
        '(request.clientName LIKE :search OR request.phone LIKE :search OR request.address LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    return query.getMany();
  }

  async findOne(id: number): Promise<Request> {
    const request = await this.requestsRepository.findOne({
      where: { id },
      relations: ['assignedTo'],
    });
    
    if (!request) {
      throw new NotFoundException(`Request #${id} not found`);
    }
    
    return request;
  }

  async assignToMaster(requestId: number, masterId: number, dispatcherId: number): Promise<Request> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Блокируем запись для обновления
      const request = await queryRunner.manager.findOne(Request, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // Проверяем статус
      if (request.status !== RequestStatus.NEW) {
        throw new BadRequestException('Only new requests can be assigned');
      }

      // Проверяем существование мастера
      const master = await this.usersService.findById(masterId);
      if (master.role !== UserRole.MASTER) {
        throw new BadRequestException('User is not a master');
      }

      const oldStatus = request.status;
      const oldAssignedTo = request.assignedToId;
      
      request.assignedToId = masterId;
      request.status = RequestStatus.ASSIGNED;

      const updatedRequest = await queryRunner.manager.save(request);

      await this.auditService.log({
        action: 'ASSIGN_REQUEST',
        entityId: updatedRequest.id,
        entityType: 'request',
        oldValue: { status: oldStatus, assignedTo: oldAssignedTo },
        newValue: { status: updatedRequest.status, assignedTo: masterId },
        userId: dispatcherId,
      });

      await queryRunner.commitTransaction();
      return updatedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * КРИТИЧЕСКАЯ СЕКЦИЯ - Защита от гонок
   * Только один запрос из параллельных может выполниться успешно
   */
  async takeToWork(requestId: number, masterId: number): Promise<Request> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ПЕССИМИСТИЧНАЯ БЛОКИРОВКА - выбираем запись для обновления
      const request = await queryRunner.manager.findOne(Request, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' }, // SELECT ... FOR UPDATE
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // Проверяем, что заявка назначена этому мастеру
      if (request.assignedToId !== masterId) {
        throw new ForbiddenException('This request is not assigned to you');
      }

      // Проверяем статус
      if (request.status !== RequestStatus.ASSIGNED) {
        throw new ConflictException(
          `Request cannot be taken to work. Current status: ${request.status}`
        );
      }

      const oldStatus = request.status;
      request.status = RequestStatus.IN_PROGRESS;
      
      const updatedRequest = await queryRunner.manager.save(request);

      await this.auditService.log({
        action: 'TAKE_TO_WORK',
        entityId: updatedRequest.id,
        entityType: 'request',
        oldValue: { status: oldStatus },
        newValue: { status: updatedRequest.status },
        userId: masterId,
      });

      await queryRunner.commitTransaction();
      return updatedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async complete(requestId: number, masterId: number): Promise<Request> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(Request, {
        where: { id: requestId, assignedToId: masterId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException('Request not found or not assigned to you');
      }

      if (request.status !== RequestStatus.IN_PROGRESS) {
        throw new BadRequestException('Only requests in progress can be completed');
      }

      const oldStatus = request.status;
      request.status = RequestStatus.DONE;
      
      const updatedRequest = await queryRunner.manager.save(request);

      await this.auditService.log({
        action: 'COMPLETE_REQUEST',
        entityId: updatedRequest.id,
        entityType: 'request',
        oldValue: { status: oldStatus },
        newValue: { status: updatedRequest.status },
        userId: masterId,
      });

      await queryRunner.commitTransaction();
      return updatedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(requestId: number, dispatcherId: number): Promise<Request> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(Request, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      if (![RequestStatus.NEW, RequestStatus.ASSIGNED].includes(request.status)) {
        throw new BadRequestException('Only new or assigned requests can be canceled');
      }

      const oldStatus = request.status;
      request.status = RequestStatus.CANCELED;
      
      const updatedRequest = await queryRunner.manager.save(request);

      await this.auditService.log({
        action: 'CANCEL_REQUEST',
        entityId: updatedRequest.id,
        entityType: 'request',
        oldValue: { status: oldStatus },
        newValue: { status: updatedRequest.status },
        userId: dispatcherId,
      });

      await queryRunner.commitTransaction();
      return updatedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getStats(): Promise<any> {
    const stats = await this.requestsRepository
      .createQueryBuilder('request')
      .select('request.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('request.status')
      .getRawMany();

    const total = await this.requestsRepository.count();
    
    return {
      total,
      byStatus: stats.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }
}
