import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Request } from '../../requests/entities/request.entity';
import { AuditLog } from '../../audit/entities/audit.entity';

export enum UserRole {
  DISPATCHER = 'dispatcher',
  MASTER = 'master',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
    default: UserRole.MASTER,
  })
  role: UserRole;

  @Column({ nullable: true })
  fullName: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Request, request => request.assignedTo)
  assignedRequests: Request[];

  @OneToMany(() => AuditLog, log => log.user)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
