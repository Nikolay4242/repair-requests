import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Request } from '../../modules/requests/entities/request.entity';
import { AuditLog } from '../../modules/audit/entities/audit.entity';
import * as bcrypt from 'bcrypt';

async function runSeeds() {
  console.log('🌱 Starting database seeding...');
  
  const dataSource = new DataSource({
    type: 'sqlite',
    database: './data/database.sqlite',
    entities: [User, Request, AuditLog],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('📦 Database connected');

  try {
    // Seed users
    const userRepository = dataSource.getRepository(User);
    
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash('password', salt);

    const users = [
      {
        username: 'dispatcher',
        password: hashedPassword,
        role: 'dispatcher',
        fullName: 'Иван Диспетчеров',
        isActive: true,
      },
      {
        username: 'master1',
        password: hashedPassword,
        role: 'master',
        fullName: 'Петр Мастеров',
        isActive: true,
      },
      {
        username: 'master2',
        password: hashedPassword,
        role: 'master',
        fullName: 'Сергей Ремонтов',
        isActive: true,
      },
    ];

    for (const userData of users) {
      const exists = await userRepository.findOneBy({ username: userData.username });
      if (!exists) {
        await userRepository.save(userData);
        console.log(`✅ User created: ${userData.username}`);
      }
    }

    // Seed requests
    const requestRepository = dataSource.getRepository(Request);
    
    const masters = await userRepository.find({ where: { role: 'master' } });
    
    const requests = [
      {
        clientName: 'Алексей Петров',
        phone: '+79161234567',
        address: 'ул. Ленина, д. 10, кв. 5',
        problemText: 'Не включается стиральная машина, мигают все индикаторы',
        status: 'new',
      },
      {
        clientName: 'Мария Иванова',
        phone: '+79167654321',
        address: 'пр. Мира, д. 25, кв. 12',
        problemText: 'Холодильник не морозит, компрессор работает постоянно',
        status: 'assigned',
        assignedToId: masters[0]?.id,
      },
      {
        clientName: 'Дмитрий Сидоров',
        phone: '+79169876543',
        address: 'ул. Советская, д. 3, кв. 45',
        problemText: 'Телевизор не реагирует на пульт, кнопки на корпусе работают',
        status: 'in_progress',
        assignedToId: masters[1]?.id,
      },
    ];

    for (const requestData of requests) {
      const request = requestRepository.create(requestData);
      await requestRepository.save(request);
      console.log(`✅ Request created for: ${requestData.clientName}`);
    }
    
    console.log('✨ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds().catch(console.error);
