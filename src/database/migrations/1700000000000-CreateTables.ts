import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTables1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем таблицу users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR NOT NULL UNIQUE,
        password VARCHAR NOT NULL,
        role VARCHAR NOT NULL DEFAULT 'master',
        fullName VARCHAR,
        isActive BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем таблицу requests
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clientName VARCHAR NOT NULL,
        phone VARCHAR NOT NULL,
        address VARCHAR NOT NULL,
        problemText TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'new',
        assignedToId INTEGER,
        version INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assignedToId) REFERENCES users(id)
      )
    `);

    // Создаем таблицу audit_logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action VARCHAR NOT NULL,
        entityType VARCHAR NOT NULL,
        entityId INTEGER,
        oldValue TEXT,
        newValue TEXT,
        userId INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    // Создаем индексы
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assignedToId)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entityType, entityId)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
