import { ExportPayload } from "./exportTypes";

export function exportJson(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}
