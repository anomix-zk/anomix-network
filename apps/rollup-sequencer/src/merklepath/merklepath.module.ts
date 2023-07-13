import { Module } from '@nestjs/common';
import { MerklePathController } from './merklepath.controller';
import { MerklePathService } from './merklepath.service';

@Module({
    controllers: [MerklePathController],
    providers: [MerklePathService],
    exports: [MerklePathService],
})
export class MerklePathModule {}
