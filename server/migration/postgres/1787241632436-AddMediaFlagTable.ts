import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaFlagTable1787241632436 implements MigrationInterface {
  name = 'AddMediaFlagTable1787241632436';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_flag" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "mediaType" character varying NOT NULL, "flag" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_42f324cc3115c2fbfe0248aca4f" UNIQUE ("tmdbId", "mediaType", "flag"), CONSTRAINT "PK_media_flag_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5141fbd797d9d4f48629ac891f" ON "media_flag" ("tmdbId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5141fbd797d9d4f48629ac891f"`
    );
    await queryRunner.query(`DROP TABLE "media_flag"`);
  }
}
