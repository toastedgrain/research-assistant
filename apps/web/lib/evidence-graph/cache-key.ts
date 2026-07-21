import { evidenceKey } from "../evidence/source";
import type { EvidencePacket } from "./types";

function packetEvidenceIds(packet: EvidencePacket): string[] {
  return [packet.claimEvidence, ...packet.supportingEvidence, ...packet.reportedResults, ...packet.figures, ...packet.tables, ...packet.methods, ...packet.experiments, ...packet.datasetsAndBenchmarks, ...packet.comparators, ...packet.limitations, ...packet.citations].map(evidenceKey);
}

export function evidenceArtifactCacheKey(kind: string, packets: EvidencePacket[], model: string, schemaVersion = 1): string {
  const evidenceIds = packets.flatMap(packetEvidenceIds).sort();
  const input = JSON.stringify({ kind, paperIds: packets.map((packet) => packet.paperId).sort(), evidenceIds, model, schemaVersion });
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 0x01000193);
  return `evidence-v${schemaVersion}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
