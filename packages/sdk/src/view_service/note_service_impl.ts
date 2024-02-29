import { BaseResponse } from '@anomix/types';
import { NoteViewService } from './note_service';
import { DetectionKey } from '@anomix/fmd';
import { Note } from '../note/note';

export class NoteViewServiceImpl implements NoteViewService {
  constructor(private host: string) {}

  private async makeRequest<T>(
    url: string,
    init?: RequestInit
  ): Promise<BaseResponse<T>> {
    let timeouts: NodeJS.Timeout[] = [];
    const clearTimeouts = () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts = [];
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    timeouts.push(timer);
    try {
      if (init) {
        init.signal = controller.signal;
      }
      let resp = await fetch(url, init);
      if (resp.ok) {
        let jsonResp = (await resp.json()) as BaseResponse<T>;

        this.log.debug({ url, jsonResp });
        return jsonResp;
      }

      this.log.warn({
        url,
        requestInit: init,
        status: resp.status,
        statusText: resp.statusText,
      });
      throw new Error(
        `Failed to make request to ${url}, status: ${resp.status}, statusText: ${resp.statusText}`
      );
    } catch (err) {
      this.log.error({ url, err });
      throw err;
    } finally {
      clearTimeouts();
    }
  }

  publishDetectKey(detectKey: DetectionKey) {
    const url = `${this.host}/view/publishDetectKey`;
    this.log.info(`publish detectkey at ${url}`);

    const body = JSON.stringify({
      detectKey: detectKey,
    });
    const res = await this.makeRequest<{ [block: string]: number }>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.code === 0) {
      return res.data!;
    }

    throw new Error(res.msg);
  }
  public async findNotes(detectKey: DetectionKey): Promise<Note[]> {
    const url = `${this.host}/view/find_notes`;
    this.log.info(`Find notes at ${url}`);

    const body = JSON.stringify({
      detectKey: detectKey,
    });
    const res = await this.makeRequest<{ [block: string]: number }>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.code === 0) {
      return res.data!;
    }

    throw new Error(res.msg);
  }
}
