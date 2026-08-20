import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderColumns1787243347561 implements MigrationInterface {
  name = 'AddOrderColumns1787243347561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_metadata" ADD "detectedOrder" character varying NOT NULL DEFAULT ''`
    );
    await queryRunner.query(
      `ALTER TABLE "media_metadata" ADD "orderOverride" character varying NOT NULL DEFAULT ''`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_metadata" DROP COLUMN "orderOverride"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_metadata" DROP COLUMN "detectedOrder"`
    );
  }
}
