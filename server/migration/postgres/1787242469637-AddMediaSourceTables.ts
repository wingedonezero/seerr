import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaSourceTables1787242469637 implements MigrationInterface {
  name = 'AddMediaSourceTables1787242469637';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_source" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "mediaType" character varying NOT NULL, "seasonNumber" integer, "kind" character varying NOT NULL, "name" character varying NOT NULL DEFAULT '', "grp" character varying NOT NULL DEFAULT '', "info" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_media_source_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac679ca6a13627fbbc12d37c06" ON "media_source" ("tmdbId", "mediaType") `
    );
    await queryRunner.query(
      `CREATE TABLE "source_log" ("id" SERIAL NOT NULL, "title" character varying NOT NULL DEFAULT '', "body" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sourceId" integer NOT NULL, CONSTRAINT "PK_source_log_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97ae606a0b2f963671d59b0e4b" ON "source_log" ("sourceId") `
    );
    await queryRunner.query(
      `ALTER TABLE "source_log" ADD CONSTRAINT "FK_97ae606a0b2f963671d59b0e4b7" FOREIGN KEY ("sourceId") REFERENCES "media_source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_log" DROP CONSTRAINT "FK_97ae606a0b2f963671d59b0e4b7"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97ae606a0b2f963671d59b0e4b"`
    );
    await queryRunner.query(`DROP TABLE "source_log"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac679ca6a13627fbbc12d37c06"`
    );
    await queryRunner.query(`DROP TABLE "media_source"`);
  }
}
