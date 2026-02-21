import type { Response } from "express";

type TreeEventPayload = {
  type: "partition_updated";
  partition_root_id: string;
  new_subtree_hash: string;
  fetched_at: number;
};

const KEEP_ALIVE_MS = 20000;

export class TreeEventBus {
  private clients = new Set<Response>();
  private keepAliveTimer: NodeJS.Timeout | null = null;

  addClient(res: Response): void {
    this.clients.add(res);
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    if (!this.keepAliveTimer) {
      this.keepAliveTimer = setInterval(() => this.broadcastComment(), KEEP_ALIVE_MS);
    }

    res.on("close", () => {
      this.clients.delete(res);
      if (this.clients.size === 0 && this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
    });
  }

  emitPartitionUpdated(payload: Omit<TreeEventPayload, "type">): void {
    const event: TreeEventPayload = {
      type: "partition_updated",
      ...payload,
    };
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      client.write(`event: partition_updated\n`);
      client.write(`data: ${data}\n\n`);
    }
  }

  private broadcastComment(): void {
    for (const client of this.clients) {
      client.write(`: keep-alive\n\n`);
    }
  }
}
