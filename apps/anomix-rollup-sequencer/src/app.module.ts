import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { config } from './common';
import { DatabaseModule } from './db/database.module';
import { CliModule } from './cli/cli.module';
import { CronModule } from './cron/cron.module';
import { AuthModule } from './auth/auth.module';
import { NoteModule } from './note/note.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [config.yaml],
            isGlobal: true,
        }),

        DatabaseModule,
        CliModule,
        CronModule,
        AuthModule,
        NoteModule,
    ],

    controllers: [],
})
export class AppModule {}
