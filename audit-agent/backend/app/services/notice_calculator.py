"""
NoticeCalculator: Calcul mathématique rigoureux des délais de préavis contractuels.

Le vrai problème métier:
  Un contrat signé le 15/03/2023, durée 2 ans, renouvellement tacite avec préavis 3 mois.
  La deadline réelle de résiliation = 15/12/2024 (et non "3 mois avant fin de contrat" vague).
  Si la deadline est déjà passée, calculer le PROCHAIN cycle.

Voir TDD §2.5 pour la description de l'algorithme.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from dateutil.relativedelta import relativedelta


@dataclass(frozen=True)
class NoticeDeadlineResult:
    """Résultat complet du calcul de préavis."""

    # Date d'anniversaire / renouvellement du contrat
    anniversary_date: date

    # Date limite pour envoyer la résiliation (None si pas de renouvellement)
    notice_deadline: date | None

    # Nombre de jours jusqu'à la deadline (négatif si déjà passée)
    days_until_deadline: int | None

    # Niveau d'urgence de l'action requise
    action_required: Literal["OK", "ATTENTION", "WARNING", "CRITICAL", "EXPIRED"]

    # Coût de l'inaction: montant bloqué si on rate la deadline
    locked_amount_eur: float | None = None


def compute_notice_deadline(
    signature_date: date,
    duration_months: int,
    notice_period_months: int,
    renewal_type: Literal["auto", "manual", "none"],
    current_date: date | None = None,
    annual_amount_eur: float | None = None,
) -> NoticeDeadlineResult:
    """
    Calcule la deadline de préavis pour un contrat.

    Args:
        signature_date: Date de signature du contrat
        duration_months: Durée du contrat en mois (ex: 12, 24, 36)
        notice_period_months: Durée du préavis en mois (ex: 1, 2, 3)
        renewal_type: "auto" = renouvellement tacite, "manual" = renouvellement actif,
                      "none" = pas de renouvellement (contrat à terme)
        current_date: Date de référence (défaut: aujourd'hui)
        annual_amount_eur: Montant annuel du contrat (pour calculer le coût de l'inaction)

    Returns:
        NoticeDeadlineResult avec toutes les informations calculées

    Raises:
        ValueError: Si les paramètres sont incohérents (ex: durée=0)

    Examples:
        # Contrat 2 ans signé le 15/03/2023, préavis 3 mois, renouvellement tacite
        # Si current_date = 2026-03-24:
        # - Anniversaires: 15/03/2025, 15/03/2027
        # - Prochain anniversaire: 15/03/2027
        # - Deadline: 15/12/2026
        # - days_until_deadline: (2026-12-15 - 2026-03-24) = 266 jours → OK
        compute_notice_deadline(
            signature_date=date(2023, 3, 15),
            duration_months=24,
            notice_period_months=3,
            renewal_type="auto",
        )
    """
    today = current_date or date.today()

    if duration_months <= 0:
        raise ValueError(f"duration_months must be > 0, got {duration_months}")
    if notice_period_months < 0:
        raise ValueError(
            f"notice_period_months must be >= 0, got {notice_period_months}"
        )
    if notice_period_months > duration_months:
        raise ValueError(
            f"notice_period ({notice_period_months}m) cannot exceed "
            f"contract duration ({duration_months}m)"
        )

    # ── Étape 1: Calculer la PROCHAINE date d'anniversaire ───────────────────
    # On avance par pas de `duration_months` depuis la date de signature
    # jusqu'à trouver une date strictement future.

    anniversary = signature_date + relativedelta(months=duration_months)

    # Avancer jusqu'au prochain anniversaire FUTUR
    # (le contrat peut avoir été renouvelé plusieurs fois déjà)
    while anniversary <= today:
        anniversary += relativedelta(months=duration_months)

    # ── Étape 2: Calcul selon le type de renouvellement ───────────────────────

    if renewal_type == "none":
        # Contrat à durée déterminée: pas de reconduction tacite.
        # L'alerte porte sur l'expiration elle-même.
        days_remaining = (anniversary - today).days

        action = _compute_action_from_days(days_remaining, expiry_mode=True)

        return NoticeDeadlineResult(
            anniversary_date=anniversary,
            notice_deadline=None,
            days_until_deadline=days_remaining,
            action_required=action,
            locked_amount_eur=None,
        )

    # ── Renouvellement tacite ou manuel ──────────────────────────────────────
    # La deadline de résiliation = anniversaire - préavis
    notice_deadline = anniversary - relativedelta(months=notice_period_months)

    # Cas limite: la deadline pour CE cycle est déjà passée.
    # Il faut calculer pour le CYCLE SUIVANT.
    if notice_deadline <= today:
        # On est après la deadline: le contrat vient de se renouveler (ou va se renouveler)
        # → Passer au cycle suivant
        anniversary += relativedelta(months=duration_months)
        notice_deadline = anniversary - relativedelta(months=notice_period_months)

    days_until_deadline = (notice_deadline - today).days
    action = _compute_action_from_days(days_until_deadline, expiry_mode=False)

    # Calcul du coût de l'inaction (montant bloqué si on rate la deadline)
    locked_amount: float | None = None
    if annual_amount_eur and renewal_type == "auto":
        # Si on rate la deadline: on reste bloqué pour une durée supplémentaire
        locked_amount = round(annual_amount_eur * (duration_months / 12), 2)

    return NoticeDeadlineResult(
        anniversary_date=anniversary,
        notice_deadline=notice_deadline,
        days_until_deadline=days_until_deadline,
        action_required=action,
        locked_amount_eur=locked_amount,
    )


def compute_worst_case_year_3(
    current_annual_amount_eur: float,
    escalation_rate_min_pct: float,
    years: int = 3,
) -> float:
    """
    Calcule le coût annuel après N années d'escalation de prix.

    Formule: montant × (1 + taux/100)^N
    Utilisé pour la colonne "worst_case_year_3_eur" du rapport.

    Args:
        current_annual_amount_eur: Montant annuel actuel en €
        escalation_rate_min_pct: Taux d'escalation annuel en % (ex: 3.0 pour 3%)
        years: Horizon de projection (défaut: 3 ans)

    Example:
        compute_worst_case_year_3(48_000, 3.0, years=3)
        → 48000 × 1.03^3 = 52,436.54 €
    """
    if escalation_rate_min_pct <= 0:
        return current_annual_amount_eur

    rate = escalation_rate_min_pct / 100.0
    return round(current_annual_amount_eur * ((1 + rate) ** years), 2)


def _compute_action_from_days(
    days: int,
    expiry_mode: bool = False,
) -> Literal["OK", "ATTENTION", "WARNING", "CRITICAL", "EXPIRED"]:
    """
    Traduit un nombre de jours en niveau d'action requis.

    expiry_mode=True: les seuils sont plus larges (pour les contrats à terme).
    expiry_mode=False: seuils stricts pour les deadlines de résiliation.
    """
    if days < 0:
        return "EXPIRED"

    if expiry_mode:
        # Contrats à terme: alerter plus tôt (90 / 30 / 7 jours)
        if days <= 7:
            return "CRITICAL"
        elif days <= 30:
            return "WARNING"
        elif days <= 90:
            return "ATTENTION"
        return "OK"
    else:
        # Deadlines de résiliation: seuils standards
        if days <= 7:
            return "CRITICAL"
        elif days <= 30:
            return "WARNING"
        elif days <= 90:
            return "ATTENTION"
        return "OK"
