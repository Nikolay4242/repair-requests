import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RequestStatus {
  NEW = 'new',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELED = 'canceled',
}

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_name' })
  clientName: string;

  @Column()
  phone: string;

  @Column()
  address: string;

  @Column({ name: 'problem_text', type: 'text' })
  problemText: string;

  @Column({
    type: 'simple-enum',
    enum: RequestStatus,
    default: RequestStatus.NEW,
  })
  status: RequestStatus;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User | null;

  @Column({ name: 'assigned_to_id', nullable: true })
  assignedToId: number | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
