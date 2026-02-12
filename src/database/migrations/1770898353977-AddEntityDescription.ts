import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEntityDescription1770898353977 implements MigrationInterface {
    name = 'AddEntityDescription1770898353977'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entities" ADD "description" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entities" DROP COLUMN "description"`);
    }

}
