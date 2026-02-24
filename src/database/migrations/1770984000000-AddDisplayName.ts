import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisplayName1770984000000 implements MigrationInterface {
    name = 'AddDisplayName1770984000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entities" ADD "display_name" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entities" DROP COLUMN "display_name"`);
    }

}
