import { Note } from '../note/note';
import { DetectionKey } from '@anomix/fmd';

export interface NoteViewService {
  publishDetectKey(detectKey: DetectionKey);
  findNotes(detectKey: DetectionKey): Promise<Note[]>;
}
