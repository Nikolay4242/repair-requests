import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Request as RequestEntity, RequestStatus } from '../src/modules/requests/entities/request.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { Repository } from 'typeorm';

describe('Race Condition Tests (e2e)', () => {
  let app: INestApplication;
  let requestRepository: Repository<RequestEntity>;
  let userRepository: Repository<User>;
  let masterUser: User;
  let testRequest: RequestEntity;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    requestRepository = moduleFixture.get<Repository<RequestEntity>>(getRepositoryToken(RequestEntity));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));

    // Создаем тестового мастера
    masterUser = await userRepository.save({
      username: 'test_master',
      password: '$2b$10$X7UxV0Y1Q2Z3Q4Z5Q6Z7Q8', // hashed 'password'
      role: UserRole.MASTER,
      fullName: 'Test Master',
      isActive: true,
    });

    // Получаем токен авторизации
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'test_master', password: 'password' });
    
    authToken = loginResponse.body.access_token;

    // Создаем тестовую заявку со статусом ASSIGNED
    testRequest = await requestRepository.save({
      clientName: 'Test Client',
      phone: '+1234567890',
      address: 'Test Address',
      problemText: 'Test Problem',
      status: RequestStatus.ASSIGNED,
      assignedToId: masterUser.id,
    });
  });

  it('should handle concurrent take-to-work requests (only one success)', async () => {
    const promises = [];
    const numberOfRequests = 10;

    // Запускаем параллельные запросы
    for (let i = 0; i < numberOfRequests; i++) {
      promises.push(
        request(app.getHttpServer())
          .patch(`/api/requests/${testRequest.id}/take-to-work`)
          .set('Authorization', `Bearer ${authToken}`)
          .send()
          .then(response => ({ status: response.status, body: response.body }))
          .catch(error => ({ status: error.status, error: error.message }))
      );
    }

    const results = await Promise.all(promises);

    // Проверяем, что только один запрос успешен (200)
    const successful = results.filter(r => r.status === 200);
    const conflicted = results.filter(r => r.status === 409);
    const otherErrors = results.filter(r => r.status !== 200 && r.status !== 409);

    console.log(`Results: ${successful.length} successful, ${conflicted.length} conflicted, ${otherErrors.length} other errors`);

    expect(successful.length).toBe(1);
    expect(conflicted.length).toBe(numberOfRequests - 1);
    expect(otherErrors.length).toBe(0);

    // Проверяем статус заявки в БД
    const updatedRequest = await requestRepository.findOne({
      where: { id: testRequest.id }
    });
    
    expect(updatedRequest.status).toBe(RequestStatus.IN_PROGRESS);
  });

  it('should prevent taking already in-progress request', async () => {
    // Создаем заявку в статусе IN_PROGRESS
    const inProgressRequest = await requestRepository.save({
      clientName: 'Another Client',
      phone: '+1987654321',
      address: 'Another Address',
      problemText: 'Another Problem',
      status: RequestStatus.IN_PROGRESS,
      assignedToId: masterUser.id,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/requests/${inProgressRequest.id}/take-to-work`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('cannot be taken to work');
  });

  afterAll(async () => {
    // Очистка тестовых данных
    await requestRepository.delete({ id: testRequest.id });
    await userRepository.delete({ id: masterUser.id });
    await app.close();
  });
});
