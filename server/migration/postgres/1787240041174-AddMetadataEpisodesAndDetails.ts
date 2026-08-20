import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMetadataEpisodesAndDetails1787240041174
  implements MigrationInterface
{
  name = 'AddMetadataEpisodesAndDetails1787240041174';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_metadata" ADD "genres" text NOT NULL DEFAULT '[]'`
    );
    await queryRunner.query(
      `ALTER TABLE "media_metadata" ADD "runtime" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "media_metadata" ADD "certification" character varying NOT NULL DEFAULT ''`
    );
    await queryRunner.query(
      `ALTER TABLE "media_metadata" ADD "backdropPath" character varying NOT NULL DEFAULT ''`
    );
    await queryRunner.query(
      `ALTER TABLE "media_metadata" ADD "network" character varying NOT NULL DEFAULT ''`
    );
    await queryRunner.query(
      `CREATE TABLE "metadata_episode" ("id" SERIAL NOT NULL, "seasonNumber" integer NOT NULL, "episodeNumber" integer NOT NULL, "absoluteNumber" integer, "dvdSeasonNumber" integer, "dvdEpisodeNumber" integer, "title" character varying NOT NULL DEFAULT '', "airDate" character varying, "overview" text NOT NULL DEFAULT '', "runtime" integer, "providerEpisodeId" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "metadataId" integer NOT NULL, CONSTRAINT "UQ_c35d90b1979c4d2d98c5b83411d" UNIQUE ("metadataId", "seasonNumber", "episodeNumber"), CONSTRAINT "PK_metadata_episode_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fa0d10d42b895ad77b0dfc9df5" ON "metadata_episode" ("metadataId") `
    );
    await queryRunner.query(
      `ALTER TABLE "metadata_episode" ADD CONSTRAINT "FK_fa0d10d42b895ad77b0dfc9df52" FOREIGN KEY ("metadataId") REFERENCES "media_metadata"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "metadata_episode" DROP CONSTRAINT "FK_fa0d10d42b895ad77b0dfc9df52"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fa0d10d42b895ad77b0dfc9df5"`
    );
    await queryRunner.query(`DROP TABLE "metadata_episode"`);
    await queryRunner.query(`ALTER TABLE "media_metadata" DROP COLUMN "network"`);
    await queryRunner.query(
      `ALTER TABLE "media_metadata" DROP COLUMN "backdropPath"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_metadata" DROP COLUMN "certification"`
    );
    await queryRunner.query(`ALTER TABLE "media_metadata" DROP COLUMN "runtime"`);
    await queryRunner.query(`ALTER TABLE "media_metadata" DROP COLUMN "genres"`);
  }
}
