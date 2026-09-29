import argparse
import math
import random
from collections import Counter, defaultdict
from pathlib import Path

from app.database import classification_jobs_collection, persuasion_results_collection
from exportar_anotacoes import (
    build_validation_tasks,
    export_stratified_validation_workbook,
)


CLASSES = [
    "ataque_a_reputacao",
    "justificativa",
    "simplificacao",
    "distracao",
    "chamada",
    "linguagem_manipulativa",
    "nenhuma",
]


def task_labels(task):
    return {
        value.strip()
        for value in (task.get("categorias_modelo") or "nenhuma").split(",")
        if value.strip()
    } or {"nenhuma"}


def stratify_multilabel_tasks(tasks, minimum_per_class=15, seed=20260923):
    """Select a compact reproducible multilabel sample meeting every class quota."""
    if minimum_per_class < 1:
        raise ValueError("minimum_per_class deve ser positivo")
    available = Counter()
    for task in tasks:
        available.update(task_labels(task))
    shortages = {
        label: minimum_per_class - available[label]
        for label in CLASSES
        if available[label] < minimum_per_class
    }
    if shortages:
        details = ", ".join(
            f"{label}: faltam {missing}" for label, missing in shortages.items()
        )
        raise ValueError(f"Cobertura insuficiente para a amostra: {details}")

    rng = random.Random(seed)
    candidates = list(tasks)
    rng.shuffle(candidates)
    selected = []
    selected_ids = set()
    coverage = Counter()

    while any(coverage[label] < minimum_per_class for label in CLASSES):
        deficits = {
            label: minimum_per_class - coverage[label]
            for label in CLASSES
            if coverage[label] < minimum_per_class
        }
        best = None
        best_score = None
        for task in candidates:
            if task["task_id"] in selected_ids:
                continue
            useful = task_labels(task) & deficits.keys()
            if not useful:
                continue
            # A multilabel paragraph can satisfy more than one quota. Rare classes
            # receive more weight, and larger remaining deficits break later ties.
            score = sum(
                (1 / available[label]) + (deficits[label] / minimum_per_class)
                for label in useful
            )
            tie_break = (score, len(useful), -len(task_labels(task)))
            if best_score is None or tie_break > best_score:
                best, best_score = task, tie_break
        if best is None:
            raise RuntimeError("Não foi possível completar as cotas multilabel.")
        selected.append(dict(best))
        selected_ids.add(best["task_id"])
        coverage.update(task_labels(best))

    for order, task in enumerate(selected, 1):
        labels = sorted(task_labels(task))
        task["estrato_multilabel"] = ", ".join(labels)
        task["anotadores_necessarios"] = 2
        task["ordem_amostra"] = order

    summary = [{
        "classe": label,
        "disponiveis": available[label],
        "selecionados": coverage[label],
        "minimo_solicitado": minimum_per_class,
        "cobertura_atingida": coverage[label] >= minimum_per_class,
    } for label in CLASSES]
    return selected, summary


def optimize_balanced_multilabel_tasks(
    tasks,
    cardinality_targets=None,
    minimum_per_class=15,
    seed=20260923,
    iterations=200_000,
):
    """Balance class coverage while preserving varied multilabel cardinalities."""
    targets = cardinality_targets or {1: 20, 2: 10, 3: 8, 4: 6, 5: 4, 6: 2}
    buckets = defaultdict(list)
    for task in tasks:
        buckets[len(task_labels(task))].append(task)
    for cardinality, target in targets.items():
        if len(buckets[cardinality]) < target:
            raise ValueError(
                f"Existem apenas {len(buckets[cardinality])} tarefas com "
                f"{cardinality} label(s), mas a meta é {target}."
            )

    rng = random.Random(seed)
    selected = {
        cardinality: rng.sample(buckets[cardinality], target)
        for cardinality, target in targets.items()
    }

    def coverage(selection):
        result = Counter()
        for group in selection.values():
            for task in group:
                result.update(task_labels(task))
        return result

    def objective(counts):
        values = [counts[label] for label in CLASSES]
        mean = sum(values) / len(values)
        imbalance = sum((value - mean) ** 2 for value in values)
        shortage = sum(max(0, minimum_per_class - value) ** 2 for value in values)
        return imbalance + 1_000 * shortage

    counts = coverage(selected)
    current_score = objective(counts)
    best_score = current_score
    best_selected = {key: list(value) for key, value in selected.items()}
    cardinalities = list(targets)

    for iteration in range(iterations):
        cardinality = rng.choice(cardinalities)
        position = rng.randrange(len(selected[cardinality]))
        old_task = selected[cardinality][position]
        new_task = rng.choice(buckets[cardinality])
        selected_ids = {task["task_id"] for task in selected[cardinality]}
        if new_task["task_id"] in selected_ids:
            continue
        candidate_counts = counts.copy()
        candidate_counts.subtract(task_labels(old_task))
        candidate_counts.update(task_labels(new_task))
        candidate_score = objective(candidate_counts)
        temperature = max(0.01, 10 * (1 - iteration / iterations))
        accept = candidate_score < current_score or rng.random() < math.exp(
            (current_score - candidate_score) / temperature
        )
        if accept:
            selected[cardinality][position] = new_task
            counts = candidate_counts
            current_score = candidate_score
            if candidate_score < best_score:
                best_score = candidate_score
                best_selected = {key: list(value) for key, value in selected.items()}

    final_tasks = []
    for cardinality in sorted(best_selected):
        final_tasks.extend(best_selected[cardinality])
    final_counts = coverage(best_selected)
    if any(final_counts[label] < minimum_per_class for label in CLASSES):
        raise RuntimeError("A otimização não atingiu a cobertura mínima de todas as classes.")
    rng.shuffle(final_tasks)
    output = []
    for order, source in enumerate(final_tasks, 1):
        task = dict(source)
        task["estrato_multilabel"] = ", ".join(sorted(task_labels(task)))
        task["anotadores_necessarios"] = 2
        task["ordem_amostra"] = order
        output.append(task)

    summary = [{
        "classe": label,
        "disponiveis": sum(label in task_labels(task) for task in tasks),
        "selecionados": final_counts[label],
        "minimo_solicitado": minimum_per_class,
        "cobertura_atingida": final_counts[label] >= minimum_per_class,
    } for label in CLASSES]
    summary.extend({
        "classe": f"tarefas_com_{cardinality}_labels",
        "disponiveis": len(buckets[cardinality]),
        "selecionados": target,
        "minimo_solicitado": target,
        "cobertura_atingida": True,
    } for cardinality, target in sorted(targets.items()))
    return output, summary


def stratify_by_cardinality_and_class(
    tasks,
    quota_per_cardinality=10,
    empty_quota=10,
    seed=20260923,
    iterations=50_000,
):
    """Apply cardinality quotas, then balance positive classes inside each stratum."""
    positive_classes = [label for label in CLASSES if label != "nenhuma"]
    rng = random.Random(seed)
    empty_tasks = [task for task in tasks if task_labels(task) == {"nenhuma"}]
    if len(empty_tasks) < empty_quota:
        raise ValueError(f"Existem apenas {len(empty_tasks)} tarefas vazias.")
    selected_by_stratum = {"vazia": rng.sample(empty_tasks, empty_quota)}

    def stratum_score(selection):
        counts = Counter()
        for task in selection:
            counts.update(task_labels(task))
        mean = sum(counts[label] for label in positive_classes) / len(positive_classes)
        return sum((counts[label] - mean) ** 2 for label in positive_classes)

    for cardinality in range(1, 7):
        candidates = [
            task for task in tasks
            if "nenhuma" not in task_labels(task)
            and len(task_labels(task)) == cardinality
        ]
        target = min(quota_per_cardinality, len(candidates))
        if cardinality < 6 and target < quota_per_cardinality:
            raise ValueError(
                f"Existem apenas {len(candidates)} tarefas positivas com "
                f"{cardinality} label(s)."
            )
        current = rng.sample(candidates, target)
        current_ids = {task["task_id"] for task in current}
        current_score = stratum_score(current)
        best = list(current)
        best_score = current_score
        for iteration in range(iterations):
            if target == len(candidates):
                break
            position = rng.randrange(target)
            replacement = rng.choice(candidates)
            if replacement["task_id"] in current_ids:
                continue
            proposal = list(current)
            removed = proposal[position]
            proposal[position] = replacement
            proposal_score = stratum_score(proposal)
            temperature = max(0.01, 2 * (1 - iteration / iterations))
            accept = proposal_score < current_score or rng.random() < math.exp(
                (current_score - proposal_score) / temperature
            )
            if accept:
                current = proposal
                current_ids.remove(removed["task_id"])
                current_ids.add(replacement["task_id"])
                current_score = proposal_score
                if proposal_score < best_score:
                    best, best_score = list(proposal), proposal_score
        selected_by_stratum[f"{cardinality}_labels"] = best

    selected = []
    summary = []
    overall = Counter()
    order = 1
    for stratum, group in selected_by_stratum.items():
        stratum_counts = Counter()
        for source in group:
            task = dict(source)
            labels = sorted(task_labels(task))
            task["estrato_multilabel"] = stratum
            task["anotadores_necessarios"] = 2
            task["ordem_amostra"] = order
            order += 1
            selected.append(task)
            stratum_counts.update(labels)
            overall.update(labels)
        for label in CLASSES:
            if stratum_counts[label]:
                summary.append({
                    "classe": f"{stratum}:{label}",
                    "disponiveis": sum(
                        label in task_labels(task)
                        for task in tasks
                        if (
                            (stratum == "vazia" and task_labels(task) == {"nenhuma"})
                            or (
                                stratum != "vazia"
                                and "nenhuma" not in task_labels(task)
                                and len(task_labels(task)) == int(stratum.split("_")[0])
                            )
                        )
                    ),
                    "selecionados": stratum_counts[label],
                    "minimo_solicitado": "equilíbrio interno",
                    "cobertura_atingida": True,
                })
    rng.shuffle(selected)
    for order, task in enumerate(selected, 1):
        task["ordem_amostra"] = order
    summary.extend({
        "classe": f"TOTAL:{label}",
        "disponiveis": sum(label in task_labels(task) for task in tasks),
        "selecionados": overall[label],
        "minimo_solicitado": None,
        "cobertura_atingida": True,
    } for label in CLASSES)
    summary.extend({
        "classe": f"COTA:{stratum}",
        "disponiveis": (
            len(empty_tasks) if stratum == "vazia"
            else sum(
                "nenhuma" not in task_labels(task)
                and len(task_labels(task)) == int(stratum.split("_")[0])
                for task in tasks
            )
        ),
        "selecionados": len(group),
        "minimo_solicitado": empty_quota if stratum == "vazia" else quota_per_cardinality,
        "cobertura_atingida": len(group) == (
            empty_quota if stratum == "vazia" else quota_per_cardinality
        ),
    } for stratum, group in selected_by_stratum.items())
    return selected, summary


def load_tasks(job_ids):
    tasks = []
    for job_id in job_ids:
        job = classification_jobs_collection.find_one({"job_id": job_id})
        if not job:
            raise ValueError(f"Job não encontrado: {job_id}")
        documents = list(
            persuasion_results_collection.find({"job_id": job_id}, {"_id": 0})
            .sort("chunk_index", 1)
        )
        tasks.extend(build_validation_tasks(documents, job))
    return tasks


def main():
    parser = argparse.ArgumentParser(
        description="Exporta uma amostra multilabel estratificada para anotação humana."
    )
    parser.add_argument("--job-id", action="append", required=True, dest="job_ids")
    parser.add_argument("--min-per-class", type=int, default=15)
    parser.add_argument(
        "--max-human-annotations", type=int,
        help="Teto de anotações humanas; usa duas anotações por tarefa e balanceia cardinalidades.",
    )
    parser.add_argument(
        "--quota-by-cardinality", action="store_true",
        help="Seleciona 10 vazias, 10 por cardinalidade de 1 a 5 e todos os casos de 6 labels.",
    )
    parser.add_argument("--seed", type=int, default=20260923)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    tasks = load_tasks(args.job_ids)
    if args.quota_by_cardinality:
        selected, summary = stratify_by_cardinality_and_class(
            tasks, quota_per_cardinality=10, empty_quota=10, seed=args.seed
        )
    elif args.max_human_annotations:
        if args.max_human_annotations != 100:
            parser.error("O perfil balanceado atual foi calibrado para exatamente 100 anotações humanas.")
        selected, summary = optimize_balanced_multilabel_tasks(
            tasks, minimum_per_class=args.min_per_class, seed=args.seed
        )
    else:
        selected, summary = stratify_multilabel_tasks(
            tasks, minimum_per_class=args.min_per_class, seed=args.seed
        )
    export_stratified_validation_workbook(selected, summary, args.output)
    print(f"Prompts disponíveis: {len(tasks)}")
    print(f"Tarefas selecionadas: {len(selected)}")
    print(f"Anotações humanas planejadas: {len(selected) * 2}")
    for row in summary:
        print(
            f"{row['classe']}: {row['selecionados']} selecionados "
            f"de {row['disponiveis']} disponíveis"
        )
    print(f"Arquivo criado: {args.output.resolve()}")


if __name__ == "__main__":
    main()
