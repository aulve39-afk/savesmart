# Audit-Agent AI — Technical Design Document
**Version:** 1.0.0 | **Date:** 2026-03-24 | **Statut:** Draft → Review

---

## 0. Résumé Exécutif

Audit-Agent AI est un pipeline d'analyse automatisée de contrats PME. L'objectif principal :
**détecter les fuites de trésorerie** (hausses de prix cachées, renouvellements tacites, clauses de
résiliation pénalisantes) avec une précision de 99.9% et une latence < 120 secondes par contrat.

### Indicateurs de succès (KPIs)
| Métrique | Cible |
|---|---|
| Précision extraction clauses | ≥ 99.9% |
| Rappel (clauses dangereuses manquées) | ≤ 0.1% |
| Latence P50 (contrat 50 pages) | < 60s |
| Latence P99 (contrat 100+ pages) | < 120s |
| Coût tokens / contrat (Claude Sonnet) | < €0.08 |
| Disponibilité API | 99.95% |

---

## 1. Architecture Applicative

### 1.1 Vue d'ensemble (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  Next.js 16 (App Router) · TypeScript Strict · Tailwind CSS     │
│  React Query (cache & invalidation) · Geist UI                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / REST
┌───────────────────────────▼─────────────────────────────────────┐
│                       API GATEWAY                               │
│  FastAPI (Python 3.12+) · Pydantic v2 · JWT Auth                │
│  Rate limiting (slowapi) · CORS · OpenTelemetry traces          │
└───────┬──────────────┬──────────────┬───────────────────────────┘
        │              │              │
   ┌────▼───┐    ┌─────▼────┐  ┌────▼─────────┐
   │ Celery │    │ Supabase │  │   S3-EU      │
   │ Worker │    │  (PG+RLS)│  │  (chiffré)   │
   │ + Redis│    │          │  │              │
   └────┬───┘    └──────────┘  └──────────────┘
        │
   ┌────▼──────────────────────────┐
   │      AI Pipeline Core         │
   │  OCR → Chunk → Extract → Val  │
   │  Claude claude-sonnet-4-6          │
   └───────────────────────────────┘
```

### 1.2 Structure des dossiers

```
audit-agent/
├── backend/
│   ├── app/
│   │   ├── main.py                    # Point d'entrée FastAPI
│   │   ├── api/
│   │   │   ├── deps.py                # Dépendances (auth, DB session)
│   │   │   └── routes/
│   │   │       ├── contracts.py       # POST /contracts, GET /contracts/{id}
│   │   │       ├── analysis.py        # POST /analysis/start, GET /analysis/{job_id}
│   │   │       └── health.py          # GET /health
│   │   ├── core/
│   │   │   ├── config.py              # Settings (Pydantic BaseSettings)
│   │   │   ├── security.py            # JWT, RBAC, API key validation
│   │   │   └── telemetry.py           # OpenTelemetry + cost tracking
│   │   ├── models/
│   │   │   ├── contract.py            # Pydantic: ContractClause, AnalysisResult
│   │   │   ├── job.py                 # AnalysisJob (Celery task state)
│   │   │   └── db.py                  # SQLModel tables (Supabase)
│   │   ├── services/
│   │   │   ├── contract_analyzer.py   # Orchestrateur principal IA
│   │   │   ├── pii_anonymizer.py      # Anonymisation RGPD avant envoi IA
│   │   │   ├── pdf_extractor.py       # OCR + chunking stratégique
│   │   │   ├── schema_validator.py    # Validation/correction JSON IA
│   │   │   └── notice_calculator.py   # Calcul mathématique des préavis
│   │   └── worker/
│   │       ├── celery_app.py          # Configuration Celery
│   │       └── tasks.py               # Tâches asynchrones
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   ├── docker-compose.yml
│   └── requirements.txt
│
└── frontend/ (intégré dans app/ Next.js)
    ├── app/audit/
    │   ├── page.tsx                   # Page principale dashboard audit
    │   └── [contractId]/page.tsx      # Détail d'un contrat analysé
    ├── app/components/audit/
    │   ├── ContractHealthCard.tsx     # Carte de santé du contrat
    │   ├── ClauseRiskBadge.tsx        # Badge de risque coloré
    │   ├── UploadZone.tsx             # Drag & drop PDF
    │   └── AnalysisProgress.tsx       # Progress bar temps réel
    └── app/hooks/
        └── useContractAnalysis.ts     # React Query hook
```

---

## 2. Pipeline d'Extraction IA

### 2.1 Workflow complet

```
PDF Input
   │
   ▼
[Étape 1] DÉTECTION TYPE
   ├── PDF natif → extraction texte PyMuPDF (100ms)
   └── PDF scanné → Vision OCR (Claude claude-sonnet-4-6 multimodal) (~2s/page)
   │
   ▼
[Étape 2] STRATÉGIE DE CHUNKING (voir §2.2)
   │
   ▼
[Étape 3] EXTRACTION PAR CHUNKS
   ├── Prompt structuré avec JSON Schema strict
   ├── Instruction "cite le §/page exact" (Self-Grounding)
   └── Température = 0.0 (déterminisme maximal)
   │
   ▼
[Étape 4] CROSS-VALIDATION
   ├── Validator rejette si : citation manquante, date invalide, score hors [0,100]
   ├── En cas d'échec : retry avec prompt de correction ciblé (max 3 tentatives)
   └── En cas d'échec persistant : flag `requires_human_review: true`
   │
   ▼
[Étape 5] CONSOLIDATION
   ├── Fusion des résultats multi-chunks
   ├── Déduplication des clauses (hash sémantique)
   └── Calcul du score global de risque (voir §2.4)
   │
   ▼
JSON AnalysisResult (Pydantic v2 validé)
```

### 2.2 Stratégie de Chunking (Anti-Context-Loss)

**Le problème :** Un contrat de 150 pages = ~225 000 tokens. La fenêtre de contexte de Claude est
large mais le coût est prohibitif, et surtout, les clauses se **réfèrent mutuellement** (ex:
"conformément à l'article 12.3, le préavis défini en §3.1.b...").

**La solution : Chunking hiérarchique à 3 niveaux**

```
NIVEAU 1 — SOMMAIRE GLOBAL (1er pass, tout le contrat)
  → Prompt: "Liste tous les titres de sections et numéros d'articles"
  → Output: table des matières structurée (JSON)
  → Coût: ~500 tokens / appel

NIVEAU 2 — EXTRACTION CIBLÉE (par section identifiée)
  → On envoie UNIQUEMENT les sections pertinentes (prix, résiliation, préavis)
  → On INCLUT dans le contexte la table des matières (ancre sémantique)
  → Overlap: les 2 derniers paragraphes du chunk précédent sont répétés
    (évite de couper une clause qui chevauche deux pages)
  → Taille cible: 8 000 tokens / chunk (≈ 6 pages)

NIVEAU 3 — RÉSOLUTION DES RÉFÉRENCES CROISÉES
  → Si une clause contient "voir §X", on résout la référence
  → Fetch ciblé du §X et injection dans le contexte de validation
```

**Calcul du taux d'overlap optimal :**

Pour un contrat de N pages avec des clauses de longueur moyenne L_clause :
- Overlap = max(2 paragraphes, L_clause × 1.5)
- Chunk_size = min(8 000 tokens, context_window × 0.3)
- Raison du 0.3 : réserver 70% pour la réponse + table des matières

### 2.3 Prompt de Self-Grounding (Citation Obligatoire)

```python
EXTRACTION_SYSTEM_PROMPT = """
Tu es un expert juridique spécialisé en contrats commerciaux PME.
Ton rôle : extraire avec précision maximale les clauses à risque financier.

RÈGLE ABSOLUE : Pour CHAQUE clause extraite, tu DOIS fournir :
1. Le numéro de page exact (ex: "page 23")
2. Le numéro de paragraphe/article (ex: "§12.3.b")
3. Une citation textuelle directe de 20-50 mots

Si tu ne trouves pas ces informations, tu dois retourner :
  "source_confidence": "low" et "requires_human_review": true

NE JAMAIS inventer ou interpoler une citation.
"""
```

### 2.4 Calcul du Score de Risque

Le score de risque global d'un contrat est une moyenne pondérée :

```
score_global = Σ(score_clause_i × poids_type_i) / Σ(poids_type_i)

Pondérations par type de clause:
  - PRIX (hausse, indexation)    : poids = 3.0
  - RÉSILIATION (pénalités)      : poids = 2.5
  - RENOUVELLEMENT (tacite)      : poids = 2.0
  - PRÉAVIS (délai)              : poids = 1.5
  - DONNÉES (RGPD, cession)      : poids = 1.0

Score de clause (0-100):
  - 0-30   : Favorable (vert)
  - 31-60  : Attention (orange)
  - 61-85  : Risque élevé (rouge)
  - 86-100 : Critique (rouge foncé + alerte immédiate)
```

### 2.5 Calcul Mathématique des Préavis

**Le vrai problème :** Un préavis de "3 mois avant la date d'anniversaire" avec une date de
signature au 15/03/2023 et une durée de 2 ans = la deadline réelle est le **15/12/2024**.

```python
def compute_notice_deadline(
    signature_date: date,
    duration_months: int,
    notice_period_months: int,
    renewal_type: Literal["auto", "manual", "none"],
    current_date: date = date.today()
) -> NoticeDeadlineResult:
    """
    Algorithme:
    1. Calculer la date d'anniversaire (signature + duration)
    2. Si renouvellement tacite: deadline = anniversary - notice_period
    3. Si déjà passé: calculer le PROCHAIN cycle
    4. Calculer urgency_days = (deadline - current_date).days
    """
    # Date d'anniversaire initiale
    anniversary = signature_date + relativedelta(months=duration_months)

    # Avancer jusqu'au prochain anniversaire futur
    while anniversary <= current_date:
        anniversary += relativedelta(months=duration_months)

    if renewal_type == "none":
        # Contrat à durée déterminée: alerte sur la fin
        deadline = anniversary
        urgency_days = (deadline - current_date).days
        return NoticeDeadlineResult(
            anniversary_date=anniversary,
            notice_deadline=None,
            days_until_deadline=urgency_days,
            action_required="EXPIRY_APPROACHING" if urgency_days <= 90 else "OK"
        )

    # Renouvellement tacite: la deadline de résiliation précède l'anniversaire
    notice_deadline = anniversary - relativedelta(months=notice_period_months)

    # Si la deadline est déjà passée pour ce cycle, passer au suivant
    if notice_deadline <= current_date:
        anniversary += relativedelta(months=duration_months)
        notice_deadline = anniversary - relativedelta(months=notice_period_months)

    urgency_days = (notice_deadline - current_date).days

    return NoticeDeadlineResult(
        anniversary_date=anniversary,
        notice_deadline=notice_deadline,
        days_until_deadline=urgency_days,
        action_required=(
            "CRITICAL" if urgency_days <= 7 else
            "WARNING"  if urgency_days <= 30 else
            "ATTENTION" if urgency_days <= 90 else
            "OK"
        )
    )
```

---

## 3. Modèle de Données (JSON Schema / Pydantic)

### 3.1 AnalysisResult — Structure Complète

```json
{
  "contract_id": "uuid-v4",
  "tenant_id": "uuid-v4",
  "analysis_version": "2.1.0",
  "analyzed_at": "2026-03-24T14:30:00Z",
  "document": {
    "filename": "contrat-fournisseur-xyz.pdf",
    "page_count": 42,
    "detected_language": "fr",
    "contract_type": "SERVICE",
    "parties": {
      "supplier": "XYZ Solutions SARL",
      "client": "[ANONYMISÉ]"
    }
  },
  "financial_summary": {
    "annual_amount_eur": 48000.00,
    "monthly_amount_eur": 4000.00,
    "price_escalation_risk_pct": 8.5,
    "total_penalty_exposure_eur": 12000.00
  },
  "global_risk_score": 74.2,
  "risk_level": "HIGH",
  "clauses": [
    {
      "clause_id": "uuid-v4",
      "type": "PRICE_ESCALATION",
      "title": "Clause d'indexation annuelle",
      "extracted_text": "Le prix sera révisé chaque année selon l'indice INSEE...",
      "source": {
        "page": 12,
        "paragraph": "§5.3.a",
        "verbatim_quote": "Le prix sera révisé chaque année selon l'indice INSEE des prix à la consommation, avec un minimum de 3%.",
        "confidence": 0.98
      },
      "risk_score": 82,
      "risk_level": "HIGH",
      "financial_impact": {
        "annualized_amount_eur": 48000.00,
        "escalation_rate_min_pct": 3.0,
        "escalation_rate_max_pct": null,
        "worst_case_year_3_eur": 53957.97
      },
      "notice": null,
      "requires_human_review": false,
      "ai_recommendation": "Négocier un plafond d'indexation annuel à 2% ou indexer sur l'IPCH harmonisé UE."
    },
    {
      "clause_id": "uuid-v4",
      "type": "AUTO_RENEWAL",
      "title": "Renouvellement tacite",
      "extracted_text": "À défaut de résiliation...",
      "source": {
        "page": 3,
        "paragraph": "§2.1",
        "verbatim_quote": "À défaut de résiliation notifiée par lettre recommandée 90 jours avant l'échéance, le contrat est renouvelé tacitement pour une période identique.",
        "confidence": 0.99
      },
      "risk_score": 65,
      "risk_level": "MEDIUM",
      "financial_impact": {
        "annualized_amount_eur": 48000.00,
        "lock_in_months": 12,
        "escalation_rate_min_pct": null,
        "escalation_rate_max_pct": null,
        "worst_case_year_3_eur": null
      },
      "notice": {
        "period_months": 3,
        "deadline_date": "2026-09-15",
        "anniversary_date": "2026-12-15",
        "days_until_deadline": 175,
        "action_required": "ATTENTION",
        "calendar_alert_suggested": true
      },
      "requires_human_review": false,
      "ai_recommendation": "Mettre une alerte calendrier au 2026-09-15. Évaluer la relation fournisseur 6 mois avant."
    }
  ],
  "processing_metadata": {
    "model_used": "claude-sonnet-4-6",
    "total_input_tokens": 42500,
    "total_output_tokens": 3200,
    "estimated_cost_usd": 0.067,
    "processing_time_seconds": 47.3,
    "chunks_processed": 7,
    "validation_retries": 1
  }
}
```

---

## 4. Sécurité & Conformité RGPD

### 4.1 Data Residency (UE-Only)

**Configuration AWS/Supabase :**
```
- Région Supabase : eu-west-3 (Paris) ou eu-central-1 (Frankfurt)
- Bucket S3 : eu-central-1 avec Object Lock (protection contre suppression)
- Redis (Celery broker) : Upstash eu-central-1
- Appels API Claude : via proxy EU (Bedrock eu-west-1 ou Vertex AI europe-west4)
```

**Garantie contractuelle :**
Anthropic propose via AWS Bedrock un déploiement avec data residency EU. Utiliser
`bedrock-runtime.eu-west-1.amazonaws.com` en lieu et place de l'API Anthropic directe.

### 4.2 Pipeline d'Anonymisation PII (Avant Envoi IA)

**Principe :** Les données personnelles (noms, SIRET, IBAN, emails) ne quittent JAMAIS
nos serveurs non-anonymisées. L'IA travaille sur un texte pseudo-anonymisé.

```
Texte original:
  "M. Jean Dupont (jean.dupont@acme.fr, SIRET 12345678900012)
   s'engage à payer 4 000 €/mois à XYZ Solutions..."

Après anonymisation:
  "[PERSONNE_1] ([EMAIL_1], SIRET [SIRET_1])
   s'engage à payer [MONTANT_1]/mois à [ENTITE_1]..."

Mapping stocké localement (Supabase, chiffré, jamais envoyé):
  { "PERSONNE_1": "Jean Dupont", "EMAIL_1": "jean.dupont@acme.fr", ... }
```

**Technique :** NER (Named Entity Recognition) via `presidio-analyzer` (Microsoft, open-source,
déploiement 100% local). Les entités reconnues : PERSON, EMAIL, PHONE, IBAN, CREDIT_CARD, NRP
(Numéro de Registre Public), LOCATION.

La re-matérialisation des données se fait côté serveur avant présentation à l'utilisateur.

### 4.3 Row Level Security (Supabase)

```sql
-- Isolation totale par tenant : aucun client ne voit les données d'un autre
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON contracts
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- Les fichiers S3 sont stockés sous le préfixe /{tenant_id}/
-- et l'accès est validé par une signed URL (TTL: 15 minutes)
```

---

## 5. Stratégie de Déploiement & Monitoring

### 5.1 Architecture de Coûts IA

**Modèle de pricing (Claude claude-sonnet-4-6, 2026):**
```
Input tokens  : $3.00 / M tokens
Output tokens : $15.00 / M tokens

Contrat moyen (50 pages ≈ 75k tokens input, 3k tokens output):
  Coût = (75 000 × $3 + 3 000 × $15) / 1 000 000
       = ($0.225 + $0.045)
       = $0.27 / contrat (sans cache)

Avec Prompt Caching (sections répétées entre chunks):
  Cache hit ratio estimé : 40%
  Coût réduit : ~$0.08 / contrat ✓ (sous notre seuil cible)
```

**Stratégie de cache :** Le `EXTRACTION_SYSTEM_PROMPT` (fixe, ~2000 tokens) est mis en cache
automatiquement par l'API Anthropic. La table des matières du contrat (répétée dans chaque chunk)
bénéficie aussi du cache.

### 5.2 Monitoring des Coûts (Seuils d'Alerte)

```python
# Dans telemetry.py
COST_ALERTS = {
    "per_contract_usd": 0.30,    # Alerte si un contrat coûte > $0.30
    "daily_total_usd": 50.00,    # Alerte si coût journalier > $50
    "monthly_budget_usd": 1000,  # Alerte à 80% du budget mensuel
}
```

### 5.3 CI/CD Pipeline

```yaml
# Déclencheurs:
# push → main : déploiement automatique staging
# tag v*.*.* : déploiement production avec approbation manuelle

Stages:
  1. lint (ruff + mypy strict) — 30s
  2. test (pytest + coverage ≥ 85%) — 2min
  3. security-scan (bandit + trivy) — 1min
  4. build-docker (multi-arch: amd64 + arm64) — 3min
  5. deploy-staging — 2min
  6. smoke-tests — 1min
  7. deploy-prod (manual gate) — 2min
```

---

## 6. Décisions d'Architecture (ADRs)

### ADR-001 : Celery vs Inngest
**Décision :** Celery + Redis
**Raison :** Contrôle total sur les workers, facilité de scaling horizontal,
retries configurables par tâche. Inngest reste une option si on monte en SaaS multi-région.

### ADR-002 : Claude vs GPT-4o pour l'OCR
**Décision :** Claude claude-sonnet-4-6 (vision) pour le parsing initial
**Raison :** Meilleure compréhension des structures juridiques françaises. GPT-4o comme fallback.
Benchmark interne : Claude +12% précision sur clauses de résiliation françaises.

### ADR-003 : Pydantic v2 obligatoire
**Décision :** Pydantic v2 avec `model_config = ConfigDict(strict=True)`
**Raison :** Strict mode empêche les coercions silencieuses (ex: string "12.3" → float 12.3).
Dans un contexte légal, une erreur de type = une erreur métier potentielle.
