import { Controller, Get } from '@nestjs/common';
import { BlockService } from './block.service';

@Controller('block')
export class BlockController {
    constructor(private readonly blockService: BlockService) {}

    @Get('hash/:hash')
    async getCurrent1() {
        return new Number(1);
    }

    @Get('height/:height')
    async getCurrent() {
        return new Number(1);
    }

    @Get('')
    async queryBlocks() {
        return new Number(1);
    }
}
