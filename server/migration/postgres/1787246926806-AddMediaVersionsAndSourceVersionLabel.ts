import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaVersionsAndSourceVersionLabel1787246926806
  implements MigrationInterface
{
  name = 'AddMediaVersionsAndSourceVersionLabel1787246926806';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_version" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "mediaType" character varying NOT NULL, "jellyfinItemId" character varying NOT NULL, "title" character varying NOT NULL DEFAULT '', "label" character varying NOT NULL DEFAULT '', "isMain" boolean NOT NULL DEFAULT false, "coverage" text NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastSeenAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_700c46eac7c468a65d0712c534f" UNIQUE ("tmdbId", "mediaType", "jellyfinItemId"), CONSTRAINT "PK_media_version_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e90c01ae8c9ea10006576431fa" ON "media_version" ("tmdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "media_source" ADD "versionLabel" character varying NOT NULL DEFAULT ''`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_source" DROP COLUMN "versionLabel"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e90c01ae8c9ea10006576431fa"`
    );
    await queryRunner.query(`DROP TABLE "media_version"`);
  }
}
