import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaMetadataTable1787235643102 implements MigrationInterface {
    name = 'AddMediaMetadataTable1787235643102'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "user_push_subscription"`);
        await queryRunner.query(`ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`CREATE TABLE "media_metadata" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "tvdbId" integer, "imdbId" varchar, "title" varchar NOT NULL DEFAULT (''), "originalTitle" varchar NOT NULL DEFAULT (''), "year" integer, "posterPath" varchar NOT NULL DEFAULT (''), "overview" text NOT NULL DEFAULT (''), "seriesStatus" varchar NOT NULL DEFAULT (''), "lastAirDate" varchar, "releaseDate" varchar, "seasons" text NOT NULL DEFAULT ('[]'), "newSeasons" text NOT NULL DEFAULT ('[]'), "newSeasonsDetectedAt" datetime, "lastRefreshedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_9e93fbbb652672c43217d3b3101" UNIQUE ("tmdbId", "mediaType"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0f0d7a2bd45b0cc4f4f5a5b6a7" ON "media_metadata" ("tmdbId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a08808c619b9fd9ff446e73f82" ON "media_metadata" ("tvdbId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3eadc8455a53911ad7a290a570" ON "media_metadata" ("lastRefreshedAt") `);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "user_push_subscription"`);
        await queryRunner.query(`ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_e73d28c1e5e3c85125163f7c9c"`);
        await queryRunner.query(`CREATE TABLE "temporary_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "seasonId" integer, CONSTRAINT "UQ_619ebf32ab6d66ecab8cc9ba7b3" UNIQUE ("seasonId", "episodeNumber"), CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_episode"("id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId") SELECT "id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId" FROM "episode"`);
        await queryRunner.query(`DROP TABLE "episode"`);
        await queryRunner.query(`ALTER TABLE "temporary_episode" RENAME TO "episode"`);
        await queryRunner.query(`CREATE INDEX "IDX_e73d28c1e5e3c85125163f7c9c" ON "episode" ("seasonId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_e73d28c1e5e3c85125163f7c9c"`);
        await queryRunner.query(`ALTER TABLE "episode" RENAME TO "temporary_episode"`);
        await queryRunner.query(`CREATE TABLE "episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "seasonId" integer, CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "episode"("id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId") SELECT "id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId" FROM "temporary_episode"`);
        await queryRunner.query(`DROP TABLE "temporary_episode"`);
        await queryRunner.query(`CREATE INDEX "IDX_e73d28c1e5e3c85125163f7c9c" ON "episode" ("seasonId") `);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_3eadc8455a53911ad7a290a570"`);
        await queryRunner.query(`DROP INDEX "IDX_a08808c619b9fd9ff446e73f82"`);
        await queryRunner.query(`DROP INDEX "IDX_0f0d7a2bd45b0cc4f4f5a5b6a7"`);
        await queryRunner.query(`DROP TABLE "media_metadata"`);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
    }

}
