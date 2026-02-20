import { DataSource } from 'typeorm';
import { User, UserRole } from '../../modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

export async function seedUsers(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash('password', salt);

  const users = [
    {
      username: 'dispatcher',
      password: hashedPassword,
      role: UserRole.DISPATCHER,
      fullName: 'Иван Диспетчеров',
      isActive: true,
    },
    {
      username: 'master1',
      password: hashedPassword,
      role: UserRole.MASTER,
      fullName: 'Петр Мастеров',
      isActive: true,
    },
    {
      username: 'master2',
      password: hashedPassword,
      role: UserRole.MASTER,
      fullName: 'Сергей Ремонтов',
      isActive: true,
    },
  ];

  for (const userData of users) {
    const exists = await userRepository.findOneBy({ username: userData.username });
    if (!exists) {
      await userRepository.save(userData);
    }
  }

  console.log('✅ Users seeded successfully');
}
