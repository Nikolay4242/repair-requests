import { DataSource } from 'typeorm';
import { Request, RequestStatus } from '../../modules/requests/entities/request.entity';
import { User } from '../../modules/users/entities/user.entity';

export async function seedRequests(dataSource: DataSource): Promise<void> {
  const requestRepository = dataSource.getRepository(Request);
  const userRepository = dataSource.getRepository(User);

  const masters = await userRepository.find({ where: { role: 'master' } });
  
  const requests = [
    {
      clientName: 'Алексей Петров',
      phone: '+79161234567',
      address: 'ул. Ленина, д. 10, кв. 5',
      problemText: 'Не включается стиральная машина, мигают все индикаторы',
      status: RequestStatus.NEW,
    },
    {
      clientName: 'Мария Иванова',
      phone: '+79167654321',
      address: 'пр. Мира, д. 25, кв. 12',
      problemText: 'Холодильник не морозит, компрессор работает постоянно',
      status: RequestStatus.ASSIGNED,
      assignedToId: masters[0]?.id,
    },
    {
      clientName: 'Дмитрий Сидоров',
      phone: '+79169876543',
      address: 'ул. Советская, д. 3, кв. 45',
      problemText: 'Телевизор не реагирует на пульт, кнопки на корпусе работают',
      status: RequestStatus.IN_PROGRESS,
      assignedToId: masters[1]?.id,
    },
    {
      clientName: 'Елена Козлова',
      phone: '+79163456789',
      address: 'ул. Гагарина, д. 7, кв. 23',
      problemText: 'Посудомоечная машина не сливает воду',
      status: RequestStatus.DONE,
      assignedToId: masters[0]?.id,
    },
    {
      clientName: 'Олег Новиков',
      phone: '+79165544332',
      address: 'ул. Пушкина, д. 15, кв. 8',
      problemText: 'Электрочайник не выключается после закипания',
      status: RequestStatus.CANCELED,
    },
  ];

  for (const requestData of requests) {
    const request = requestRepository.create(requestData);
    await requestRepository.save(request);
  }

  console.log('✅ Requests seeded successfully');
}
