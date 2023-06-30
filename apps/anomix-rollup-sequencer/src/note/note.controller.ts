import { Controller, Get } from '@nestjs/common';
import { NoteService } from './note.service';

@Controller('notes')
export class NoteController {
    constructor(private readonly noteService: NoteService) {}

    @Get(':note_hash')
    async getCurrent1() {
        return new Number(1);
    }

    @Get(':note_hash')
    async getCurrent() {
        return new Number(1);
    }
}
