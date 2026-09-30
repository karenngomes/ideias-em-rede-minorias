// Tipos das respostas da API de persuasão (FastAPI).

export type SpeakerMetadata = {
  raw_label: string | null;
  honorific: string | null;
  role: string | null;
  affiliation: string | null;
  party: string | null;
  state: string | null;
};

export type TranscriptionChunk = {
  record_id: number;
  chunk_index: number;
  speaker_name: string;
  speaker_metadata: SpeakerMetadata;
  text: string;
  char_start: number;
  char_end: number;
  selected_classification?: ApproachClassification | null;
  selected_classification_error?: {
    type: string;
    message: string;
    occurred_at: string;
  } | null;
  selected_classification_audit?: ClassificationAudit | null;
};

export type ApproachClassification = {
  no_classification_explanation?: string | null;
  segmentation?: {
    strategy?: string;
    min_chars?: number;
    max_chars?: number;
    segment_count: number;
    segments: Array<{ index: number; start: number; end: number }>;
  };
  superclass_classifications?: Array<{
    superclass: string;
    text_spans: string[];
    span_offsets: Array<{ start: number | null; end: number | null }>;
    explanation: string;
    evidence_reliable?: boolean;
    evidence_warnings?: string[];
    paragraph_index?: number;
    prompt?: ExecutedPrompt;
  }>;
  classifications?: Array<{
    superclass: string;
    explanation: string;
    paragraph_index?: number;
    prompt?: ExecutedPrompt;
  }>;
};

export type ExecutedPrompt = {
  system: string;
  user: string;
};

export type ClassificationAudit = {
  model: string;
  strategy?: string;
  min_chars?: number;
  max_chars?: number;
  prompt?: ExecutedPrompt;
  response?: unknown;
  validation_warnings?: string[];
  executions?: Array<{
    paragraph_index: number;
    start: number;
    end: number;
    target_text: string;
    prompt: ExecutedPrompt;
    response: unknown;
    validation_warnings?: string[];
    captured_at: string;
  }>;
  captured_at: string;
};

export type ClassifiedRecord = {
  id: number;
  assunto: string | null;
  runs: Array<{ job_id: string; experiments_tag: string; result_count: number }>;
};

export type GroupSummary = {
  chunks: number;
  classified: number;
  failed: number;
  none: number;
  classes: Record<string, number>;
};

export type ClassificationSummary = {
  job_id: string;
  record_id: number;
  experiments_tag: string;
  total_chunks: number;
  parlamentares: string[];
  groups: Record<"total" | "parlamentar" | "convidado", GroupSummary>;
};

export type ChunkPage = {
  record_id: number;
  page: number;
  page_size: number;
  total: number;
  items: TranscriptionChunk[];
};
