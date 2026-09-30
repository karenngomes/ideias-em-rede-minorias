// Tipos das relações entre falas (análise do David), servidas pela API em
// /lds/{id}/conversation-relations.

export type ConversationRelationType =
  | "passar_palavra"
  | "questionar"
  | "responder"
  | "complementar"
  | "concordar"
  | "discordar"
  | "mudar_assunto"
  | "retomada"
  | "retomar"
  | "referencia"
  | "resposta_tardia"
  | "correcao"
  | "citacao"
  | "sem_relacao"
  | "concordar_parcialmente"
  | "discordar_parcialmente"
  | "apoiar"
  | "contestar"
  | "elaborar"
  | "justificar"
  | "exemplificar"
  | "fornecer_evidencia"
  | "desafiar"
  | "esclarecer"
  | "reformular"
  | "sintetizar"
  | "propor"
  | "aceitar_proposta"
  | "rejeitar_proposta"
  | "modificar_proposta"
  | "comprometer_se"
  | "solicitar"
  | "organizar_debate";

export type ConversationRelation = {
  source_chunk_id: string | null;
  target_chunk_id: string;
  scope: "direct" | "indirect";
  type: ConversationRelationType;
  confidence: number;
  reason: string;
};

export type RelationChunk = {
  id: string;
  chunk_index: number;
  speaker_id: string | null;
  text: string;
};

export type RelationInferenceAudit = {
  target_chunk_id: string;
  retrieved_chunks: Array<{ chunk_id: string; text: string; similarity: number }>;
  prompt: Array<{ role: "system" | "user"; content: string }>;
  raw_response: string;
  parsed_response: { relations?: Array<Record<string, unknown>> };
};

export type ConversationRelationRun = {
  record_id: number;
  status: "not_started" | "completed";
  run_id: string | null;
  created_at: string | null;
  candidate_count: number | null;
  min_confidence: number | null;
  approach: "rag_pairwise" | "protocol" | "protocol_rag" | null;
  model: string | null;
  embedding_model: string | null;
  relations: ConversationRelation[];
  audit: RelationInferenceAudit[];
  chunks: RelationChunk[];
};
