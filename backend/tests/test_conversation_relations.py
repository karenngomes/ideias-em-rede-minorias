import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.conversation_relations import (
    ConversationRelation,
    IndirectRelationDecision,
    ConversationChunk,
    EmbeddingServiceError,
    RelationDecision,
    RelationInferenceRequest,
    ProtocolChunkDecision,
    ProtocolRelationDecision,
    ProtocolRagClassification,
    infer_conversation_relations,
)
from app.main import infer_relations


def chunk(identifier, text, position, speaker=None):
    return ConversationChunk(
        id=identifier,
        text=text,
        position=position,
        speaker_id=speaker,
    )


def no_relation_classifier(source, target, scope, source_unit, target_unit):
    return RelationDecision(
        type="sem_relacao",
        confidence=0.95,
        reason="Não há vínculo discursivo explícito.",
    )


class ConversationRelationTests(unittest.TestCase):
    def request(self, chunks, **options):
        return RelationInferenceRequest(chunks=chunks, **options)

    def test_consecutive_question_and_answer(self):
        def classifier(source, target, scope, source_unit, target_unit):
            return RelationDecision(
                type="questionar",
                confidence=0.94,
                reason="A origem pergunta e a fala seguinte apresenta a resposta.",
            )

        result = infer_conversation_relations(
            self.request([
                chunk("q", "Qual é o prazo?", 1, "deputado"),
                chunk("a", "O prazo é de trinta dias.", 2, "ministro"),
            ]),
            embedder=lambda texts: [],
            classifier=classifier,
        )

        self.assertEqual(len(result.relations), 1)
        relation = result.relations[0]
        self.assertEqual((relation.source_chunk_id, relation.target_chunk_id), ("q", "a"))
        self.assertEqual(relation.scope, "direct")
        self.assertEqual(relation.type, "questionar")

    def test_passage_of_speaking_turn(self):
        def classifier(source, target, scope, source_unit, target_unit):
            return RelationDecision(
                type="passar_palavra",
                confidence=0.99,
                reason="O presidente concede a palavra ao próximo participante.",
            )

        result = infer_conversation_relations(
            self.request([
                chunk("c1", "Concedo a palavra à Ministra Ana.", 1),
                chunk("c2", "Obrigada, Presidente.", 2),
            ]),
            embedder=lambda texts: [],
            classifier=classifier,
        )

        self.assertEqual(result.relations[0].type, "passar_palavra")

    def test_agreement_and_disagreement_are_both_classified(self):
        def classifier(source, target, scope, source_unit, target_unit):
            if scope == "indirect":
                return no_relation_classifier(source, target, scope, source_unit, target_unit)
            relation_type = "concordar" if target.id == "b" else "discordar"
            return RelationDecision(
                type=relation_type,
                confidence=0.91,
                reason="A fala reage explicitamente à posição anterior.",
            )

        result = infer_conversation_relations(
            self.request([
                chunk("a", "A proposta deve ser aprovada.", 1),
                chunk("b", "Concordo integralmente.", 2),
                chunk("c", "Discordo dessa conclusão.", 3),
            ]),
            embedder=lambda texts: [[1.0, 0.0] for _ in texts],
            classifier=classifier,
        )

        direct = [relation.type for relation in result.relations if relation.scope == "direct"]
        self.assertEqual(direct, ["concordar", "discordar"])

    def test_distant_relation_is_retrieved_and_validated(self):
        def embedder(texts):
            return [[1.0, 0.0] if "energia" in text.lower() else [0.0, 1.0] for text in texts]

        def classifier(source, target, scope, source_unit, target_unit):
            if scope == "indirect" and source.id == "a" and target.id == "c":
                return RelationDecision(
                    type="retomada",
                    confidence=0.88,
                    reason="A fala posterior retoma explicitamente a proposta de energia.",
                )
            return no_relation_classifier(source, target, scope, source_unit, target_unit)

        result = infer_conversation_relations(
            self.request([
                chunk("a", "Proponho ampliar a energia solar.", 1),
                chunk("b", "Passo agora aos informes administrativos.", 2),
                chunk("c", "Retomando a proposta de energia solar apresentada antes.", 3),
            ], candidate_count=1),
            embedder=embedder,
            classifier=classifier,
        )

        indirect = [relation for relation in result.relations if relation.scope == "indirect"]
        self.assertEqual(len(indirect), 1)
        self.assertEqual((indirect[0].source_chunk_id, indirect[0].target_chunk_id), ("a", "c"))
        self.assertEqual(indirect[0].type, "retomada")

    def test_thematic_similarity_without_real_relation_is_discarded(self):
        result = infer_conversation_relations(
            self.request([
                chunk("a", "Dados gerais sobre saúde pública.", 1),
                chunk("b", "Uma fala intermediária.", 2),
                chunk("c", "Outros dados independentes sobre saúde pública.", 3),
            ]),
            embedder=lambda texts: [[1.0, 0.0] for _ in texts],
            classifier=no_relation_classifier,
        )

        self.assertFalse(any(relation.scope == "indirect" for relation in result.relations))

    def test_multiple_similar_units_do_not_duplicate_chunk_relation(self):
        indirect_calls = []

        def classifier(source, target, scope, source_unit, target_unit):
            if scope == "indirect":
                indirect_calls.append((source.id, target.id))
                return RelationDecision(
                    type="referencia",
                    confidence=0.90,
                    reason="A fala posterior referencia a anterior.",
                )
            return no_relation_classifier(source, target, scope, source_unit, target_unit)

        result = infer_conversation_relations(
            self.request([
                chunk("a", "Tema comum.\n\nOutra menção ao tema comum.", 1),
                chunk("b", "Interlúdio.", 2),
                chunk("c", "Tema comum retomado.\n\nTema comum novamente.", 3),
            ], candidate_count=5),
            embedder=lambda texts: [[1.0, 0.0] for _ in texts],
            classifier=classifier,
        )

        indirect = [relation for relation in result.relations if relation.scope == "indirect"]
        self.assertEqual(indirect_calls, [("a", "c")])
        self.assertEqual(len(indirect), 1)

    def test_empty_conversation_is_rejected(self):
        with self.assertRaises(ValidationError):
            RelationInferenceRequest(chunks=[])

    def test_blank_chunk_text_is_rejected(self):
        with self.assertRaises(ValidationError):
            ConversationChunk(id="a", text="   ", position=1)

    def test_rag_failure_is_propagated_as_embedding_error(self):
        def broken_embedder(texts):
            raise EmbeddingServiceError("unavailable")

        with self.assertRaises(EmbeddingServiceError):
            infer_conversation_relations(
                self.request([
                    chunk("a", "Primeira fala.", 1),
                    chunk("b", "Segunda fala.", 2),
                    chunk("c", "Terceira fala.", 3),
                ]),
                embedder=broken_embedder,
                classifier=no_relation_classifier,
            )

    def test_chunks_are_sorted_before_direct_evaluation(self):
        evaluated = []

        def classifier(source, target, scope, source_unit, target_unit):
            if scope == "direct":
                evaluated.append((source.id, target.id))
            return no_relation_classifier(source, target, scope, source_unit, target_unit)

        infer_conversation_relations(
            self.request([
                chunk("c", "Terceira.", 3),
                chunk("a", "Primeira.", 1),
                chunk("b", "Segunda.", 2),
            ]),
            embedder=lambda texts: [[1.0, 0.0] for _ in texts],
            classifier=classifier,
        )

        self.assertEqual(evaluated, [("a", "b"), ("b", "c")])

    def test_protocol_supports_multiple_relations_to_the_same_previous_chunk(self):
        def protocol_classifier(target, previous):
            if not previous:
                return ProtocolChunkDecision(relations=[ProtocolRelationDecision(
                    source_chunk_id=None,
                    type="sem_relacao",
                    confidence=0.99,
                    reason="Maria apresenta a questão inicial.",
                )])
            return ProtocolChunkDecision(relations=[
                ProtocolRelationDecision(
                    source_chunk_id="a",
                    type="concordar",
                    confidence=0.96,
                    reason="João concorda com Maria sobre ampliar o atendimento.",
                ),
                ProtocolRelationDecision(
                    source_chunk_id="a",
                    type="fornecer_evidencia",
                    confidence=0.93,
                    reason="João sustenta a fala de Maria com o número de alunos.",
                ),
            ])

        result = infer_conversation_relations(
            self.request([
                chunk("a", "Precisamos ampliar o atendimento.", 1, "Maria"),
                chunk("b", "Concordo; há oitenta alunos esperando.", 2, "João"),
            ], approach="protocol"),
            protocol_classifier=protocol_classifier,
        )

        self.assertEqual(result.approach, "protocol")
        self.assertEqual([item.type for item in result.relations], [
            "sem_relacao", "concordar", "fornecer_evidencia",
        ])
        self.assertIsNone(result.relations[0].source_chunk_id)

    def test_protocol_discards_invalid_or_low_confidence_sources(self):
        def protocol_classifier(target, previous):
            return ProtocolChunkDecision(relations=[ProtocolRelationDecision(
                source_chunk_id="future-or-unknown",
                type="apoiar",
                confidence=0.95,
                reason="Relação inválida.",
            )])

        result = infer_conversation_relations(
            self.request([chunk("a", "Fala inicial.", 1)], approach="protocol"),
            protocol_classifier=protocol_classifier,
        )

        self.assertEqual(len(result.relations), 1)
        self.assertEqual(result.relations[0].type, "sem_relacao")

    def test_protocol_rag_recovers_candidates_and_records_complete_audit(self):
        def embedder(texts):
            return [[1.0, 0.0] if "saúde" in text.lower() else [0.0, 1.0]
                    for text in texts]

        def protocol_rag_classifier(target, candidates):
            source = candidates[0]
            prompt = [
                {"role": "system", "content": "protocolo de teste"},
                {"role": "user", "content": f"{source.id} -> {target.id}"},
            ]
            return ProtocolRagClassification(
                decision=ProtocolChunkDecision(relations=[ProtocolRelationDecision(
                    source_chunk_id=source.id,
                    type="complementar",
                    confidence=0.92,
                    reason="A fala atual complementa a fala recuperada.",
                )]),
                prompt=prompt,
                raw_response='{"relations":[{"type":"complementar"}]}',
            )

        result = infer_conversation_relations(
            self.request([
                chunk("a", "Investimento em saúde pública.", 1),
                chunk("b", "Questão administrativa.", 2),
                chunk("c", "Retomo o investimento em saúde.", 3),
            ], approach="protocol_rag", candidate_count=1),
            embedder=embedder,
            protocol_rag_classifier=protocol_rag_classifier,
        )

        self.assertEqual(result.approach, "protocol_rag")
        self.assertEqual(len(result.audit), 2)
        self.assertEqual(result.audit[1].retrieved_chunks[0].chunk_id, "a")
        self.assertEqual(result.audit[1].prompt[1].content, "a -> c")
        self.assertIn("complementar", result.audit[1].raw_response)
        self.assertTrue(any(item.type == "complementar" for item in result.relations))

    @patch("app.main.infer_conversation_relations", side_effect=EmbeddingServiceError("down"))
    @patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"})
    def test_endpoint_maps_rag_failure_to_bad_gateway(self, _infer):
        request = self.request([
            chunk("a", "Primeira.", 1),
            chunk("b", "Segunda.", 2),
            chunk("c", "Terceira.", 3),
        ])
        with self.assertRaises(HTTPException) as raised:
            infer_relations(request)
        self.assertEqual(raised.exception.status_code, 502)
        self.assertEqual(raised.exception.detail, "Embedding service unavailable")


if __name__ == "__main__":
    unittest.main()


class RelationTypeAliasTests(unittest.TestCase):
    def test_retomar_and_corrigir_are_normalized(self):
        self.assertEqual(RelationDecision(type="retomar", confidence=0.9, reason="ok").type, "retomada")
        self.assertEqual(RelationDecision(type="corrigir", confidence=0.9, reason="ok").type, "correcao")
        self.assertEqual(IndirectRelationDecision(type="retomar", confidence=0.9, reason="ok").type, "retomada")
        relation = ConversationRelation(source_chunk_id="chunk-1", target_chunk_id="chunk-2", scope="indirect",
                                        type="retomar", confidence=0.8, reason="ok")
        self.assertEqual(relation.type, "retomada")

