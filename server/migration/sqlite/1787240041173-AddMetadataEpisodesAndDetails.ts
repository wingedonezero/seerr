import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMetadataEpisodesAndDetails1787240041173 implements MigrationInterface {
    name = 'AddMetadataEpisodesAndDetails1787240041173'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "user_push_subscription"`);
        await queryRunner.query(`ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`CREATE TABLE "metadata_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "episodeNumber" integer NOT NULL, "absoluteNumber" integer, "dvdSeasonNumber" integer, "dvdEpisodeNumber" integer, "title" varchar NOT NULL DEFAULT (''), "airDate" varchar, "overview" text NOT NULL DEFAULT (''), "runtime" integer, "providerEpisodeId" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "metadataId" integer NOT NULL, CONSTRAINT "UQ_c35d90b1979c4d2d98c5b83411d" UNIQUE ("metadataId", "seasonNumber", "episodeNumber"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fa0d10d42b895ad77b0dfc9df5" ON "metadata_episode" ("metadataId") `);
        await queryRunner.query(`DROP INDEX "IDX_3eadc8455a53911ad7a290a570"`);
        await queryRunner.query(`DROP INDEX "IDX_a08808c619b9fd9ff446e73f82"`);
        await queryRunner.query(`DROP INDEX "IDX_0f0d7a2bd45b0cc4f4f5a5b6a7"`);
        await queryRunner.query(`CREATE TABLE "temporary_media_metadata" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "tvdbId" integer, "imdbId" varchar, "title" varchar NOT NULL DEFAULT (''), "originalTitle" varchar NOT NULL DEFAULT (''), "year" integer, "posterPath" varchar NOT NULL DEFAULT (''), "overview" text NOT NULL DEFAULT (''), "seriesStatus" varchar NOT NULL DEFAULT (''), "lastAirDate" varchar, "releaseDate" varchar, "seasons" text NOT NULL DEFAULT ('[]'), "newSeasons" text NOT NULL DEFAULT ('[]'), "newSeasonsDetectedAt" datetime, "lastRefreshedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "genres" text NOT NULL DEFAULT ('[]'), "runtime" integer, "certification" varchar NOT NULL DEFAULT (''), "backdropPath" varchar NOT NULL DEFAULT (''), "network" varchar NOT NULL DEFAULT (''), CONSTRAINT "UQ_9e93fbbb652672c43217d3b3101" UNIQUE ("tmdbId", "mediaType"))`);
        await queryRunner.query(`INSERT INTO "temporary_media_metadata"("id", "tmdbId", "mediaType", "tvdbId", "imdbId", "title", "originalTitle", "year", "posterPath", "overview", "seriesStatus", "lastAirDate", "releaseDate", "seasons", "newSeasons", "newSeasonsDetectedAt", "lastRefreshedAt", "createdAt", "updatedAt") SELECT "id", "tmdbId", "mediaType", "tvdbId", "imdbId", "title", "originalTitle", "year", "posterPath", "overview", "seriesStatus", "lastAirDate", "releaseDate", "seasons", "newSeasons", "newSeasonsDetectedAt", "lastRefreshedAt", "createdAt", "updatedAt" FROM "media_metadata"`);
        await queryRunner.query(`DROP TABLE "media_metadata"`);
        await queryRunner.query(`ALTER TABLE "temporary_media_metadata" RENAME TO "media_metadata"`);
        await queryRunner.query(`CREATE INDEX "IDX_3eadc8455a53911ad7a290a570" ON "media_metadata" ("lastRefreshedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a08808c619b9fd9ff446e73f82" ON "media_metadata" ("tvdbId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0f0d7a2bd45b0cc4f4f5a5b6a7" ON "media_metadata" ("tmdbId") `);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "user_push_subscription"`);
        await queryRunner.query(`ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_fa0d10d42b895ad77b0dfc9df5"`);
        await queryRunner.query(`CREATE TABLE "temporary_metadata_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "episodeNumber" integer NOT NULL, "absoluteNumber" integer, "dvdSeasonNumber" integer, "dvdEpisodeNumber" integer, "title" varchar NOT NULL DEFAULT (''), "airDate" varchar, "overview" text NOT NULL DEFAULT (''), "runtime" integer, "providerEpisodeId" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "metadataId" integer NOT NULL, CONSTRAINT "UQ_c35d90b1979c4d2d98c5b83411d" UNIQUE ("metadataId", "seasonNumber", "episodeNumber"), CONSTRAINT "FK_fa0d10d42b895ad77b0dfc9df52" FOREIGN KEY ("metadataId") REFERENCES "media_metadata" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_metadata_episode"("id", "seasonNumber", "episodeNumber", "absoluteNumber", "dvdSeasonNumber", "dvdEpisodeNumber", "title", "airDate", "overview", "runtime", "providerEpisodeId", "createdAt", "updatedAt", "metadataId") SELECT "id", "seasonNumber", "episodeNumber", "absoluteNumber", "dvdSeasonNumber", "dvdEpisodeNumber", "title", "airDate", "overview", "runtime", "providerEpisodeId", "createdAt", "updatedAt", "metadataId" FROM "metadata_episode"`);
        await queryRunner.query(`DROP TABLE "metadata_episode"`);
        await queryRunner.query(`ALTER TABLE "temporary_metadata_episode" RENAME TO "metadata_episode"`);
        await queryRunner.query(`CREATE INDEX "IDX_fa0d10d42b895ad77b0dfc9df5" ON "metadata_episode" ("metadataId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_fa0d10d42b895ad77b0dfc9df5"`);
        await queryRunner.query(`ALTER TABLE "metadata_episode" RENAME TO "temporary_metadata_episode"`);
        await queryRunner.query(`CREATE TABLE "metadata_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "episodeNumber" integer NOT NULL, "absoluteNumber" integer, "dvdSeasonNumber" integer, "dvdEpisodeNumber" integer, "title" varchar NOT NULL DEFAULT (''), "airDate" varchar, "overview" text NOT NULL DEFAULT (''), "runtime" integer, "providerEpisodeId" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "metadataId" integer NOT NULL, CONSTRAINT "UQ_c35d90b1979c4d2d98c5b83411d" UNIQUE ("metadataId", "seasonNumber", "episodeNumber"))`);
        await queryRunner.query(`INSERT INTO "metadata_episode"("id", "seasonNumber", "episodeNumber", "absoluteNumber", "dvdSeasonNumber", "dvdEpisodeNumber", "title", "airDate", "overview", "runtime", "providerEpisodeId", "createdAt", "updatedAt", "metadataId") SELECT "id", "seasonNumber", "episodeNumber", "absoluteNumber", "dvdSeasonNumber", "dvdEpisodeNumber", "title", "airDate", "overview", "runtime", "providerEpisodeId", "createdAt", "updatedAt", "metadataId" FROM "temporary_metadata_episode"`);
        await queryRunner.query(`DROP TABLE "temporary_metadata_episode"`);
        await queryRunner.query(`CREATE INDEX "IDX_fa0d10d42b895ad77b0dfc9df5" ON "metadata_episode" ("metadataId") `);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_0f0d7a2bd45b0cc4f4f5a5b6a7"`);
        await queryRunner.query(`DROP INDEX "IDX_a08808c619b9fd9ff446e73f82"`);
        await queryRunner.query(`DROP INDEX "IDX_3eadc8455a53911ad7a290a570"`);
        await queryRunner.query(`ALTER TABLE "media_metadata" RENAME TO "temporary_media_metadata"`);
        await queryRunner.query(`CREATE TABLE "media_metadata" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "tvdbId" integer, "imdbId" varchar, "title" varchar NOT NULL DEFAULT (''), "originalTitle" varchar NOT NULL DEFAULT (''), "year" integer, "posterPath" varchar NOT NULL DEFAULT (''), "overview" text NOT NULL DEFAULT (''), "seriesStatus" varchar NOT NULL DEFAULT (''), "lastAirDate" varchar, "releaseDate" varchar, "seasons" text NOT NULL DEFAULT ('[]'), "newSeasons" text NOT NULL DEFAULT ('[]'), "newSeasonsDetectedAt" datetime, "lastRefreshedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_9e93fbbb652672c43217d3b3101" UNIQUE ("tmdbId", "mediaType"))`);
        await queryRunner.query(`INSERT INTO "media_metadata"("id", "tmdbId", "mediaType", "tvdbId", "imdbId", "title", "originalTitle", "year", "posterPath", "overview", "seriesStatus", "lastAirDate", "releaseDate", "seasons", "newSeasons", "newSeasonsDetectedAt", "lastRefreshedAt", "createdAt", "updatedAt") SELECT "id", "tmdbId", "mediaType", "tvdbId", "imdbId", "title", "originalTitle", "year", "posterPath", "overview", "seriesStatus", "lastAirDate", "releaseDate", "seasons", "newSeasons", "newSeasonsDetectedAt", "lastRefreshedAt", "createdAt", "updatedAt" FROM "temporary_media_metadata"`);
        await queryRunner.query(`DROP TABLE "temporary_media_metadata"`);
        await queryRunner.query(`CREATE INDEX "IDX_0f0d7a2bd45b0cc4f4f5a5b6a7" ON "media_metadata" ("tmdbId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a08808c619b9fd9ff446e73f82" ON "media_metadata" ("tvdbId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3eadc8455a53911ad7a290a570" ON "media_metadata" ("lastRefreshedAt") `);
        await queryRunner.query(`DROP INDEX "IDX_fa0d10d42b895ad77b0dfc9df5"`);
        await queryRunner.query(`DROP TABLE "metadata_episode"`);
        await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
        await queryRunner.query(`ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`);
        await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
        await queryRunner.query(`CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `);
    }

}
