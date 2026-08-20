import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaSourceTables1787242469636 implements MigrationInterface {
    name = 'AddMediaSourceTables1787242469636'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "user_push_subscription"`);
        await queryRunner.query(`ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`CREATE TABLE "media_source" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "seasonNumber" integer, "kind" varchar NOT NULL, "name" varchar NOT NULL DEFAULT (''), "grp" varchar NOT NULL DEFAULT (''), "info" text NOT NULL DEFAULT (''), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE INDEX "IDX_ac679ca6a13627fbbc12d37c06" ON "media_source" ("tmdbId", "mediaType") `);
        await queryRunner.query(`CREATE TABLE "source_log" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "title" varchar NOT NULL DEFAULT (''), "body" text NOT NULL DEFAULT (''), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "sourceId" integer NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_97ae606a0b2f963671d59b0e4b" ON "source_log" ("sourceId") `);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "user_push_subscription"`);
        await queryRunner.query(`ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_97ae606a0b2f963671d59b0e4b"`);
        await queryRunner.query(`CREATE TABLE "temporary_source_log" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "title" varchar NOT NULL DEFAULT (''), "body" text NOT NULL DEFAULT (''), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "sourceId" integer NOT NULL, CONSTRAINT "FK_97ae606a0b2f963671d59b0e4b7" FOREIGN KEY ("sourceId") REFERENCES "media_source" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_source_log"("id", "title", "body", "createdAt", "updatedAt", "sourceId") SELECT "id", "title", "body", "createdAt", "updatedAt", "sourceId" FROM "source_log"`);
        await queryRunner.query(`DROP TABLE "source_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_source_log" RENAME TO "source_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_97ae606a0b2f963671d59b0e4b" ON "source_log" ("sourceId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_97ae606a0b2f963671d59b0e4b"`);
        await queryRunner.query(`ALTER TABLE "source_log" RENAME TO "temporary_source_log"`);
        await queryRunner.query(`CREATE TABLE "source_log" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "title" varchar NOT NULL DEFAULT (''), "body" text NOT NULL DEFAULT (''), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "sourceId" integer NOT NULL)`);
        await queryRunner.query(`INSERT INTO "source_log"("id", "title", "body", "createdAt", "updatedAt", "sourceId") SELECT "id", "title", "body", "createdAt", "updatedAt", "sourceId" FROM "temporary_source_log"`);
        await queryRunner.query(`DROP TABLE "temporary_source_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_97ae606a0b2f963671d59b0e4b" ON "source_log" ("sourceId") `);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_97ae606a0b2f963671d59b0e4b"`);
        await queryRunner.query(`DROP TABLE "source_log"`);
        await queryRunner.query(`DROP INDEX "IDX_ac679ca6a13627fbbc12d37c06"`);
        await queryRunner.query(`DROP TABLE "media_source"`);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
    }

}
