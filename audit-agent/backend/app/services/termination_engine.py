"""
TerminationEngine: Moteur de calcul des plans de résiliation.

Entrée : AIExtractionResult (JSON validé de l'IA)
Sortie : TerminationPlan (dates, étapes, finance, base légale)

Ce service est PURE PYTHON — aucune dépendance I/O (pas de DB, pas de HTTP).
Il peut être testé unitairement sans mock.

Logiques complexes gérées:
  1. Préavis dégressif  → résolution du préavis selon ancienneté
  2. Reconductions multiples → calcul du prochain cycle futur
  3. ETF (Early Termination Fees) → estimation si hors fenêtre légale
  4. Coût de l'inaction → montant bloqué si deadline ratée
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import date, datetime
from typing import Annotated

import structlog
from dateutil.relativedelta import relativedelta

from app.domain.termination_plan import (
    LEGAL_BASIS_ARTICLES,
    AIExtractionResult,
    DegressiveNotice,
    LegalBasis,
    StepActionType,
    TerminationPlan,
    TerminationStep,
    UrgencyLevel,
    WorkflowStatus,
)
from app.services.notice_calculator import (
    NoticeDeadlineResult,
    compute_notice_deadline,
)

logger = structlog.get_logger(__name__)


class TerminationEngineError(Exception):
    """Erreur métier non récupérable du moteur de résiliation."""


class TerminationEngine:
    """
    Orchestrateur pur du calcul de résiliation.

    Usage:
        engine = TerminationEngine()
        plan = engine.compute(extraction, contract_id=uuid4(), tenant_id=uuid4())

    Thread-safe: aucun état mutable partagé.
    """

    def compute(
        self,
        extraction: AIExtractionResult,
        contract_id: uuid.UUID,
        tenant_id: uuid.UUID,
        reference_date: date | None = None,
    ) -> TerminationPlan:
        """
        Calcule le plan de résiliation complet depuis les données d'extraction IA.

        Args:
            extraction:      Données extraites et validées par l'IA
            contract_id:     UUID du contrat (pour traçabilité)
            tenant_id:       UUID du tenant (pour isolation RGPD)
            reference_date:  Date de référence (défaut: aujourd'hui). Utile pour les tests.

        Returns:
            TerminationPlan complet avec dates, étapes, finance et base légale.

        Raises:
            TerminationEngineError: Si les données sont incohérentes et non récupérables.
        """
        today = reference_date or date.today()
        log = logger.bind(
            contract_id=str(contract_id),
            tenant_id=str(tenant_id),
            supplier=extraction.parties.supplier_name,
        )

        # ── Étape 1: Résolution du préavis effectif ────────────────────────────
        applied_notice_months = self._resolve_notice_months(
            extraction=extraction,
            today=today,
        )
        log.debug("notice.resolved", applied_months=applied_notice_months)

        # ── Étape 2: Calcul mathématique de la deadline ────────────────────────
        try:
            notice_result = compute_notice_deadline(
                signature_date=extraction.signature_date,
                duration_months=extraction.duration_months,
                notice_period_months=applied_notice_months,
                renewal_type=extraction.renewal_type,
                current_date=today,
                annual_amount_eur=extraction.annual_amount_eur,
            )
        except ValueError as exc:
            raise TerminationEngineError(
                f"Paramètres de notice incohérents pour contrat {contract_id}: {exc}"
            ) from exc

        urgency = self._map_urgency(notice_result.action_required)

        # ── Étape 3: Analyse financière ────────────────────────────────────────
        savings, locked_amount, etf_eur = self._compute_financial_impact(
            extraction=extraction,
            notice_result=notice_result,
            today=today,
        )

        # ── Étape 4: Vérification de la fenêtre légale ─────────────────────────
        is_in_legal_window = self._is_within_legal_window(
            extraction=extraction,
            notice_result=notice_result,
            today=today,
        )

        # ── Étape 5: Construction des étapes actionnables ─────────────────────
        steps = self._build_steps(
            extraction=extraction,
            notice_result=notice_result,
            today=today,
            is_in_legal_window=is_in_legal_window,
            etf_eur=etf_eur,
        )

        # ── Étape 6: Résolution de la base légale ─────────────────────────────
        legal_article = self._resolve_legal_article(extraction)

        plan = TerminationPlan(
            plan_id=uuid.uuid4(),
            contract_id=contract_id,
            tenant_id=tenant_id,
            extraction=extraction,
            notice_deadline=notice_result.notice_deadline,
            anniversary_date=notice_result.anniversary_date,
            days_until_deadline=notice_result.days_until_deadline,
            urgency_level=urgency,
            applied_notice_months=applied_notice_months,
            estimated_annual_savings_eur=savings,
            locked_amount_if_missed_eur=locked_amount,
            early_termination_fee_eur=etf_eur,
            legal_basis=extraction.legal_basis,
            legal_article=legal_article,
            is_within_legal_window=is_in_legal_window,
            steps=steps,
            workflow_status=WorkflowStatus.DRAFT,
        )

        log.info(
            "termination_plan.computed",
            urgency=urgency,
            days_remaining=notice_result.days_until_deadline,
            savings_eur=savings,
            steps_count=len(steps),
            legal_basis=extraction.legal_basis.value,
        )

        return plan

    # ─────────────────────────────────────────────────────────────────────────
    # Logique interne
    # ─────────────────────────────────────────────────────────────────────────

    def _resolve_notice_months(
        self,
        extraction: AIExtractionResult,
        today: date,
    ) -> int:
        """
        Résout le préavis effectif pour un préavis dégressif.

        Cas complexe: préavis dégressif (ex: télécom B2B)
            Année 1 (< 12 mois depuis signature)  → 3 mois
            Années 2+ (≥ 12 mois depuis signature) → 1 mois

        La logique:
            1. Calculer les années écoulées depuis la date de signature
            2. Appliquer le barème dégressif
            3. Logguer le préavis retenu (auditabilité)

        Si pas de préavis dégressif → retour direct du notice_period_months.
        """
        if extraction.degressive_notice is None:
            return extraction.notice_period_months

        degressive: DegressiveNotice = extraction.degressive_notice

        # Années complètes écoulées depuis la signature
        delta = relativedelta(today, extraction.signature_date)
        years_elapsed = delta.years

        if years_elapsed < 1:
            applied = degressive.year_1_months
            logger.debug(
                "degressive_notice.year1_applies",
                years_elapsed=years_elapsed,
                applied_months=applied,
            )
        else:
            applied = degressive.year_2_plus_months
            logger.debug(
                "degressive_notice.year2_plus_applies",
                years_elapsed=years_elapsed,
                applied_months=applied,
            )

        return applied

    def _compute_financial_impact(
        self,
        extraction: AIExtractionResult,
        notice_result: NoticeDeadlineResult,
        today: date,
    ) -> tuple[float | None, float | None, float | None]:
        """
        Calcule: (savings_eur, locked_amount_eur, etf_eur).

        - savings_eur: montant annuel économisé si résiliation réussie
        - locked_amount_eur: montant bloqué si deadline ratée (coût inaction)
        - etf_eur: pénalités de résiliation anticipée si hors fenêtre

        Returns: tuple (savings, locked, etf) — chaque valeur peut être None.
        """
        annual_amount = extraction.annual_amount_eur

        # Économies = montant annuel actuel (si on résilie, on ne paye plus)
        savings = annual_amount

        # Coût de l'inaction (déjà calculé par notice_calculator)
        locked_amount = notice_result.locked_amount_eur

        # ETF: applicable uniquement si résiliation HORS fenêtre légale
        etf_eur: float | None = None
        if extraction.early_termination_fee:
            etf = extraction.early_termination_fee
            # Si la clause n'est pas légalement applicable, on la neutralise
            if etf.is_legally_enforceable:
                etf_eur = etf.amount_eur
            else:
                logger.info(
                    "etf.not_enforceable",
                    amount=etf.amount_eur,
                    reason="Clause jugée non-exécutoire par l'IA",
                )

        return savings, locked_amount, etf_eur

    def _is_within_legal_window(
        self,
        extraction: AIExtractionResult,
        notice_result: NoticeDeadlineResult,
        today: date,
    ) -> bool:
        """
        Détermine si nous sommes dans la fenêtre légale de résiliation.

        Fenêtre légale = entre la date d'aujourd'hui et la deadline de préavis,
        ET que le contrat autorise la résiliation à cette date (pas hors cycle).

        Règle: si notice_deadline est dans le futur → on est dans la fenêtre.
        Si deadline déjà passée → on a raté le cycle, on est hors fenêtre
        (mais le moteur calcule AUTOMATIQUEMENT le prochain cycle → toujours "dans la fenêtre" pour le cycle suivant).
        """
        if notice_result.notice_deadline is None:
            # Contrat CDD sans reconduction → la fenêtre est la fin du contrat
            return (notice_result.anniversary_date - today).days > 0

        # La deadline calculée par notice_calculator est TOUJOURS future
        # (le calculateur avance au cycle suivant si la deadline courante est passée)
        return notice_result.notice_deadline > today

    def _build_steps(
        self,
        extraction: AIExtractionResult,
        notice_result: NoticeDeadlineResult,
        today: date,
        is_in_legal_window: bool,
        etf_eur: float | None,
    ) -> list[TerminationStep]:
        """
        Construit la liste des étapes actionnables selon le contexte.

        Stratégie: les étapes varient selon:
        - L'urgence (CRITICAL → LRE obligatoire, pas d'email)
        - La présence d'ETF (étape de négociation si frais élevés)
        - Le type de renouvellement (auto vs manual)
        """
        steps: list[TerminationStep] = []

        urgency = self._map_urgency(notice_result.action_required)

        # ── Étape 1: Préparer la lettre ────────────────────────────────────────
        steps.append(TerminationStep(
            step_number=1,
            title="Générer la lettre de résiliation",
            description=(
                f"Lettre basée sur {extraction.legal_article_cited}. "
                "L'IA injecte votre N° client et les clauses contractuelles."
            ),
            due_date=today,
            action_type=StepActionType.PREPARE_DOC,
            is_critical=True,
            estimated_duration_minutes=2,
        ))

        # ── Étape 2: Signature (si engagement > 12 mois) ─────────────────────
        if extraction.duration_months >= 12:
            steps.append(TerminationStep(
                step_number=2,
                title="Signer la lettre électroniquement",
                description=(
                    "Signature électronique eIDAS Niveau 1 (DocuSign/Dropbox Sign). "
                    "Valeur probante équivalente à la signature manuscrite."
                ),
                due_date=today,
                action_type=StepActionType.SIGN_DOCUMENT,
                is_critical=False,
                estimated_duration_minutes=5,
            ))

        # ── Étape 3: Envoi LRE (ou email si faible enjeu) ────────────────────
        send_step_num = len(steps) + 1

        if urgency in (UrgencyLevel.CRITICAL, UrgencyLevel.WARNING) or (
            extraction.annual_amount_eur and extraction.annual_amount_eur >= 1000
        ):
            # Lettre Recommandée Électronique (valeur légale AR24/Maileva)
            steps.append(TerminationStep(
                step_number=send_step_num,
                title="Envoyer par LRE (Lettre Recommandée Électronique)",
                description=(
                    "Envoi AR24 ou Maileva — preuve de dépôt eIDAS opposable en justice. "
                    f"Deadline impérative: {notice_result.notice_deadline.strftime('%d/%m/%Y') if notice_result.notice_deadline else 'N/A'}."
                ),
                due_date=notice_result.notice_deadline,
                action_type=StepActionType.SEND_LRE,
                is_critical=True,
                estimated_duration_minutes=5,
            ))
        else:
            # Email avec accusé de lecture pour les petits contrats
            steps.append(TerminationStep(
                step_number=send_step_num,
                title="Envoyer par email avec accusé de lecture",
                description=(
                    "Pour les contrats < 1000€/an: email suffisant. "
                    "Conservez une copie de l'accusé de lecture comme preuve."
                ),
                due_date=notice_result.notice_deadline,
                action_type=StepActionType.SEND_EMAIL,
                is_critical=False,
                estimated_duration_minutes=3,
            ))

        # ── Étape 4: Vérification de la réception ─────────────────────────────
        steps.append(TerminationStep(
            step_number=len(steps) + 1,
            title="Vérifier l'accusé de réception",
            description=(
                "Dans les 48h suivant l'envoi: vérifier que le fournisseur a bien reçu. "
                "En cas de silence: relancer par LRAR physique."
            ),
            due_date=(
                notice_result.notice_deadline.__class__.fromordinal(
                    notice_result.notice_deadline.toordinal() + 3
                ) if notice_result.notice_deadline else None
            ),
            action_type=StepActionType.VERIFY_RECEIPT,
            is_critical=False,
            estimated_duration_minutes=10,
        ))

        # ── Étape optionnelle: Négociation ETF ────────────────────────────────
        if etf_eur and etf_eur > 500:
            steps.append(TerminationStep(
                step_number=len(steps) + 1,
                title=f"Négocier les frais de résiliation ({etf_eur:,.0f} €)",
                description=(
                    "Avant de payer: vérifier si la clause est abusive (Art. L.132-1 Code Conso). "
                    "Les ETF > 25% du montant restant dû sont souvent non-exécutoires."
                ),
                due_date=None,
                action_type=StepActionType.NEGOTIATE,
                is_critical=False,
                estimated_duration_minutes=60,
            ))

        return steps

    @staticmethod
    def _resolve_legal_article(extraction: AIExtractionResult) -> str:
        """
        Construit l'article légal complet à citer dans la lettre.

        Priorité:
        1. L'IA a cité un article contractuel spécifique → on l'utilise
        2. Sinon: on utilise l'article standard mappé depuis la LegalBasis
        """
        basis = extraction.legal_basis

        if basis == LegalBasis.CONVENTION_PARTI:
            # Article contractuel spécifique → priorité à la citation IA
            return extraction.legal_article_cited

        # Article légal standard + complément de l'IA si pertinent
        standard_article = LEGAL_BASIS_ARTICLES.get(basis, extraction.legal_article_cited)
        return standard_article

    @staticmethod
    def _map_urgency(action_required: str) -> UrgencyLevel:
        """Mappe le niveau d'action du notice_calculator vers UrgencyLevel."""
        mapping: dict[str, UrgencyLevel] = {
            "OK": UrgencyLevel.OK,
            "ATTENTION": UrgencyLevel.ATTENTION,
            "WARNING": UrgencyLevel.WARNING,
            "CRITICAL": UrgencyLevel.CRITICAL,
            "EXPIRED": UrgencyLevel.EXPIRED,
        }
        return mapping.get(action_required, UrgencyLevel.OK)
