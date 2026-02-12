import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWikiUrl1770893562466 implements MigrationInterface {
    name = 'AddWikiUrl1770893562466'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entities" ADD "wiki_url" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entities" DROP COLUMN "wiki_url"`);
    }

}
