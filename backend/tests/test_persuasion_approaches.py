import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from pydantic import ValidationError

from app.main import PersuasionClassificationRequest
from app.persuasion_approaches import (
    FewShotAnnotation,
    FewShotSevenClassesClassification,
    available_approaches,
    approach_capabilities,
    classify_few_shot_seven_classes,
    classify_few_shot_seven_classes_by_paragraph,
    normalize_result,
    run_approach_job,
    split_paragraphs_merging_short,
)


class PersuasionApproachTests(unittest.TestCase):
    def test_only_the_seven_class_few_shot_approach_is_available(self):
        self.assertEqual(available_approaches(), ["persuationclassifcona_7_class_few_shot"])
        self.assertFalse(approach_capabilities(
            "persuationclassifcona_7_class_few_shot"
        )["has_subclasses"])

    @patch("app.persuasion_approaches._client")
    def test_few_shot_approach_sends_neighboring_context_and_normalizes_multilabel(
        self, client_factory
    ):
        parsed = FewShotSevenClassesClassification(anotacoes=[
            FewShotAnnotation(
                categoria="Call",
                trecho="Precisamos agir agora",
                explicacao="Convoca os participantes a agir.",
            ),
            FewShotAnnotation(
                categoria="Manipulative wording",
                trecho="ameaça terrível",
                explicacao="Emprega expressão emocionalmente carregada.",
            ),
        ])
        parse = Mock(return_value=SimpleNamespace(output_parsed=parsed))
        client_factory.return_value.responses.parse = parse
        text = "Precisamos agir agora contra essa ameaça terrível."

        result = classify_few_shot_seven_classes(text, "Antes.", "Depois.")
        normalized = normalize_result(result, text)

        user_input = parse.call_args.kwargs["input"][1]["content"]
        self.assertIn("CONTEXTO_ANTERIOR:\nAntes.", user_input)
        self.assertIn(f"TEXTO_ALVO:\n{text}", user_input)
        self.assertIn("CONTEXTO_POSTERIOR:\nDepois.", user_input)
        self.assertEqual(len(normalized["classifications"]), 2)
        self.assertEqual(normalized["classifications"][0]["superclass"], "chamada")
        self.assertEqual(
            normalized["classifications"][1]["superclass"],
            "linguagem_manipulativa",
        )

    @patch("app.persuasion_approaches._client")
    def test_few_shot_approach_returns_exact_prompt_and_original_response_for_audit(
        self, client_factory
    ):
        parsed = FewShotSevenClassesClassification(anotacoes=[FewShotAnnotation(
            categoria="Nenhuma",
            trecho="Bom dia.",
            explicacao="Saudação sem técnica persuasiva.",
        )])
        client_factory.return_value.responses.parse.return_value = SimpleNamespace(
            output_parsed=parsed
        )

        result, audit = classify_few_shot_seven_classes(
            "Bom dia.", "Antes.", "Depois.", include_audit=True
        )

        self.assertEqual(result.anotacoes[0].categoria, "Nenhuma")
        self.assertEqual(audit["response"], parsed.model_dump(mode="json"))
        self.assertIn("CONTEXTO_ANTERIOR:\nAntes.", audit["prompt"]["user"])
        self.assertIn("TEXTO_ALVO:\nBom dia.", audit["prompt"]["user"])
        self.assertIn("CONTEXTO_POSTERIOR:\nDepois.", audit["prompt"]["user"])

    @patch("app.persuasion_approaches._client")
    def test_few_shot_approach_enforces_none_exclusivity(self, client_factory):
        client_factory.return_value.responses.parse.return_value = SimpleNamespace(
            output_parsed=FewShotSevenClassesClassification(anotacoes=[
                FewShotAnnotation(
                    categoria="Nenhuma", trecho="Texto.", explicacao="Sem persuasão."
                ),
                FewShotAnnotation(
                    categoria="Call", trecho="Texto", explicacao="Convoca uma ação."
                ),
            ])
        )

        result = classify_few_shot_seven_classes("Texto.")

        self.assertEqual([item.categoria for item in result.anotacoes], ["Call"])

    @patch("app.persuasion_approaches._client")
    def test_few_shot_approach_audits_and_keeps_non_verbatim_evidence(
        self, client_factory
    ):
        client_factory.return_value.responses.parse.return_value = SimpleNamespace(
            output_parsed=FewShotSevenClassesClassification(anotacoes=[FewShotAnnotation(
                categoria="Call",
                trecho="trecho que não existe",
                explicacao="Convoca uma ação.",
            )])
        )

        result, audit = classify_few_shot_seven_classes("Texto real.", include_audit=True)

        self.assertEqual(result.anotacoes[0].categoria, "Call")
        self.assertEqual(result.anotacoes[0].trecho, "trecho que não existe")
        self.assertTrue(audit["validation_warnings"])
        self.assertEqual(audit["response"]["anotacoes"][0]["trecho"], "trecho que não existe")

    @patch("app.persuasion_approaches.classify_few_shot_seven_classes")
    def test_few_shot_paragraph_approach_marks_non_verbatim_evidence(self, classify):
        text = "Texto real com conteúdo suficiente para formar um único parágrafo. " * 5
        result = FewShotSevenClassesClassification(anotacoes=[FewShotAnnotation(
            categoria="Call",
            trecho="trecho parcialmente inventado",
            explicacao="Convoca uma ação.",
        )])
        classify.return_value = (
            result,
            {"prompt": {"system": "s", "user": "u"}, "response": result.model_dump()},
        )

        classified, _audit = classify_few_shot_seven_classes_by_paragraph(
            text, include_audit=True
        )
        normalized = normalize_result(classified, text)
        item = normalized["superclass_classifications"][0]

        self.assertFalse(item["evidence_reliable"])
        self.assertEqual(item["text_spans"], ["trecho parcialmente inventado"])
        self.assertEqual(item["span_offsets"], [{"start": None, "end": None}])
        self.assertIn("não foi encontrado integralmente", item["evidence_warnings"][0])

    def test_line_break_segmenter_attaches_short_paragraphs_and_preserves_offsets(self):
        first = "A" * 260
        short = "trecho curto"
        last = "B" * 260
        text = f"{first}\n{short}\n\n{last}"

        paragraphs = split_paragraphs_merging_short(text)

        self.assertEqual(len(paragraphs), 2)
        self.assertEqual(paragraphs[0][2], first)
        self.assertEqual(paragraphs[1][2], f"{short}\n\n{last}")
        for start, end, paragraph in paragraphs:
            self.assertEqual(text[start:end], paragraph)

    def test_line_break_segmenter_caps_oversized_paragraphs(self):
        text = "Uma frase curta. " * 400

        paragraphs = split_paragraphs_merging_short(text, min_chars=250, max_chars=4_000)

        self.assertGreater(len(paragraphs), 1)
        self.assertTrue(all(len(paragraph) <= 4_000 for _, _, paragraph in paragraphs))
        for start, end, paragraph in paragraphs:
            self.assertEqual(text[start:end], paragraph)

    @patch("app.persuasion_approaches.time.sleep")
    @patch("app.persuasion_approaches.classify_few_shot_seven_classes")
    def test_few_shot_paragraph_approach_calls_each_segment_with_neighbors_and_offsets(
        self, classify, _sleep
    ):
        first = "A" * 260
        short = "contexto curto"
        last = "Precisamos agir agora. " + "B" * 260
        text = f"{first}\n{short}\n{last}"
        none = FewShotSevenClassesClassification(anotacoes=[FewShotAnnotation(
            categoria="Nenhuma", trecho=first, explicacao="Sem técnica."
        )])
        call = FewShotSevenClassesClassification(anotacoes=[FewShotAnnotation(
            categoria="Call", trecho="Precisamos agir agora", explicacao="Convoca ação."
        )])
        classify.side_effect = [
            (none, {"prompt": {"system": "s1", "user": "u1"}, "response": {"r": 1}}),
            (call, {"prompt": {"system": "s2", "user": "u2"}, "response": {"r": 2}}),
        ]

        result, audit = classify_few_shot_seven_classes_by_paragraph(text, include_audit=True)
        normalized = normalize_result(result, text)

        self.assertEqual(classify.call_count, 2)
        self.assertEqual(classify.call_args_list[0].kwargs["previous_context"], "")
        self.assertEqual(
            classify.call_args_list[0].kwargs["next_context"],
            f"{short}\n{last}",
        )
        self.assertEqual(classify.call_args_list[1].kwargs["previous_context"], first)
        self.assertEqual(classify.call_args_list[1].kwargs["next_context"], "")
        evidence = normalized["classifications"][0]["evidence"][0]
        self.assertEqual(text[evidence["start"]:evidence["end"]], "Precisamos agir agora")
        self.assertEqual(normalized["segmentation"]["segment_count"], 2)
        self.assertEqual(len(audit["executions"]), 2)

    @patch("app.persuasion_approaches.time.sleep")
    @patch("app.persuasion_approaches.classification_jobs_collection")
    @patch("app.persuasion_approaches.persuasion_results_collection")
    @patch("app.persuasion_approaches.transcript_chunks_collection")
    def test_job_persists_detailed_error_for_failed_chunk(
        self, chunks_collection, results_collection, jobs_collection, _sleep
    ):
        cursor = Mock()
        cursor.sort.return_value = [{
            "chunk_index": 4,
            "speaker_name": "Maria",
            "text": "Texto com problema.",
        }]
        chunks_collection.find.return_value = cursor

        def failing_classifier(_text, include_audit=False):
            raise ValueError("A evidência não é um trecho literal")

        with patch.dict(
            "app.persuasion_approaches.APPROACHES",
            {"persuationclassifcona_7_class_few_shot": failing_classifier},
        ):
            run_approach_job(
                "job-erro", 12, "persuationclassifcona_7_class_few_shot", "teste-erro"
            )

        stored = results_collection.replace_one.call_args.args[1]
        self.assertIsNone(stored["classification"])
        self.assertEqual(stored["classification_error"]["type"], "ValueError")
        self.assertEqual(
            stored["classification_error"]["message"],
            "A evidência não é um trecho literal",
        )
        self.assertEqual(jobs_collection.update_one.call_args.args[1]["$set"]["status"],
                         "completed_with_errors")

    def test_request_trims_strings(self):
        request = PersuasionClassificationRequest(
            id=12, approach=" persuationclassifcona_7_class_few_shot ", experiments_tag=" baseline-001 "
        )
        self.assertEqual(request.approach, "persuationclassifcona_7_class_few_shot")
        self.assertEqual(request.experiments_tag, "baseline-001")

    def test_request_rejects_blank_tag(self):
        with self.assertRaises(ValidationError):
            PersuasionClassificationRequest(
                id=12, approach="persuationclassifcona_7_class_few_shot", experiments_tag="   "
            )


if __name__ == "__main__":
    unittest.main()
