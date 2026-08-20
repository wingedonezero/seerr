import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaMetadataTable1787235643103 implements MigrationInterface {
  name = 'AddMediaMetadataTable1787235643103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_metadata" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "mediaType" character varying NOT NULL, "tvdbId" integer, "imdbId" character varying, "title" character varying NOT NULL DEFAULT '', "originalTitle" character varying NOT NULL DEFAULT '', "year" integer, "posterPath" character varying NOT NULL DEFAULT '', "overview" text NOT NULL DEFAULT '', "seriesStatus" character varying NOT NULL DEFAULT '', "lastAirDate" character varying, "releaseDate" character varying, "seasons" text NOT NULL DEFAULT '[]', "newSeasons" text NOT NULL DEFAULT '[]', "newSeasonsDetectedAt" TIMESTAMP WITH TIME ZONE, "lastRefreshedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_9e93fbbb652672c43217d3b3101" UNIQUE ("tmdbId", "mediaType"), CONSTRAINT "PK_7f5f49bbcc32aa2a5e1e1f96b7e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0f0d7a2bd45b0cc4f4f5a5b6a7" ON "media_metadata" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a08808c619b9fd9ff446e73f82" ON "media_metadata" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3eadc8455a53911ad7a290a570" ON "media_metadata" ("lastRefreshedAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3eadc8455a53911ad7a290a570"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a08808c619b9fd9ff446e73f82"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0f0d7a2bd45b0cc4f4f5a5b6a7"`
    );
    await queryRunner.query(`DROP TABLE "media_metadata"`);
  }
}
