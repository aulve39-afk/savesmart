"""
PdfExtractor: Extraction de texte et d'images depuis les PDFs.

Stratégie:
  - PDF natif (texte sélectionnable): PyMuPDF → extraction directe en ~100ms
  - PDF scanné (images): conversion page → PNG, envoi à Claude Vision
  - Chunking stratégique: basé sur la table des matières pour préserver le contexte
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import structlog

logger = structlog.get_logger(__name__)

try:
    import fitz  # PyMuPDF

    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    logger.warning("pymupdf.not_available", message="Install pymupdf for PDF extraction")


@dataclass
class PdfExtractionResult:
    full_text: str
    page_count: int
    is_scanned: bool
    detected_language: str = "fr"
    # Images des pages (uniquement pour les PDFs scannés, au format PNG)
    page_images: list[bytes] = field(default_factory=list)
    # Texte par page (index 0-based) pour le chunking précis
    pages_text: list[str] = field(default_factory=list)


@dataclass
class TextChunk:
    text: str
    start_page: int
    end_page: int
    # Sections de la table des matières couvertes par ce chunk
    covered_sections: list[str] = field(default_factory=list)
    # Nombre de tokens estimés (approximation: 1 token ≈ 4 caractères)
    estimated_tokens: int = 0


class PdfExtractor:
    """
    Extracteur PDF modulaire.
    Détecte automatiquement si le PDF est natif ou scanné.
    """

    # Seuil de décision: si moins de N chars par page → considéré scanné
    SCANNED_THRESHOLD_CHARS_PER_PAGE = 100

    async def extract(self, pdf_bytes: bytes) -> PdfExtractionResult:
        """
        Point d'entrée principal.
        Détecte le type de PDF et applique la stratégie d'extraction appropriée.
        """
        if not PYMUPDF_AVAILABLE:
            raise RuntimeError(
                "PyMuPDF (fitz) is required for PDF extraction. "
                "Install with: pip install pymupdf"
            )

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)

        try:
            pages_text = self._extract_text_pages(doc)
            total_chars = sum(len(p) for p in pages_text)
            chars_per_page = total_chars / max(page_count, 1)

            # Décision: PDF natif vs scanné
            is_scanned = chars_per_page < self.SCANNED_THRESHOLD_CHARS_PER_PAGE

            if is_scanned:
                logger.info(
                    "pdf_extractor.scanned_detected",
                    chars_per_page=chars_per_page,
                    strategy="vision_ocr",
                )
                # Convertir chaque page en image PNG pour Vision OCR
                page_images = self._extract_page_images(doc)
                # Le texte sera extrait par Claude Vision dans ContractAnalyzer
                full_text = "\n\n".join(
                    f"[PAGE {i+1}]" for i in range(page_count)
                )
            else:
                logger.info(
                    "pdf_extractor.native_detected",
                    chars_per_page=chars_per_page,
                    strategy="text_extraction",
                )
                page_images = []
                full_text = self._build_full_text(pages_text)

            return PdfExtractionResult(
                full_text=full_text,
                page_count=page_count,
                is_scanned=is_scanned,
                detected_language=self._detect_language(full_text),
                page_images=page_images,
                pages_text=pages_text,
            )
        finally:
            doc.close()

    def create_strategic_chunks(
        self,
        text: str,
        table_of_contents: dict,
        chunk_target_tokens: int = 8_000,
        overlap_tokens: int = 400,
    ) -> list[TextChunk]:
        """
        Découpe le texte en chunks intelligents basés sur la structure du contrat.

        Stratégie:
        1. Extraire uniquement les sections "relevant_for_risk" de la table des matières
        2. Créer des chunks qui respectent les frontières de sections (pas de coupure au milieu)
        3. Ajouter un overlap (400 tokens) entre chunks pour préserver le contexte cross-pages

        Voir TDD §2.2 pour la justification complète de l'algorithme.
        """
        sections = table_of_contents.get("sections", [])

        # Si pas de table des matières: chunking linéaire simple
        if not sections:
            return self._linear_chunks(text, chunk_target_tokens, overlap_tokens)

        # Filtrer les sections pertinentes pour l'analyse de risque
        relevant_sections = [s for s in sections if s.get("relevant_for_risk", True)]

        if not relevant_sections:
            return self._linear_chunks(text, chunk_target_tokens, overlap_tokens)

        return self._toc_based_chunks(
            text, relevant_sections, chunk_target_tokens, overlap_tokens
        )

    # ── Méthodes privées ───────────────────────────────────────────────────────

    def _extract_text_pages(self, doc: "fitz.Document") -> list[str]:
        """Extrait le texte page par page avec PyMuPDF."""
        pages = []
        for page in doc:
            # get_text("text") → texte brut avec retours à la ligne
            # get_text("markdown") via pymupdf4llm → meilleur pour les tableaux
            page_text = page.get_text("text")
            pages.append(page_text or "")
        return pages

    def _extract_page_images(self, doc: "fitz.Document") -> list[bytes]:
        """Convertit chaque page en PNG pour l'OCR Vision."""
        images = []
        for page in doc:
            # Résolution 150 DPI: bon compromis qualité/taille pour l'OCR
            # 300 DPI serait trop lourd pour envoyer à l'API
            mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            images.append(pix.tobytes("png"))
        return images

    def _build_full_text(self, pages_text: list[str]) -> str:
        """Construit le texte complet avec marqueurs de page."""
        parts = []
        for i, text in enumerate(pages_text):
            parts.append(f"[PAGE {i+1}]\n{text.strip()}")
        return "\n\n".join(parts)

    def _linear_chunks(
        self,
        text: str,
        chunk_target_tokens: int,
        overlap_tokens: int,
    ) -> list[TextChunk]:
        """
        Chunking linéaire simple (fallback sans table des matières).
        Respecte les fins de paragraphes pour éviter de couper une clause.
        """
        # Approximation: 1 token ≈ 4 caractères (français, texte dense)
        chars_per_chunk = chunk_target_tokens * 4
        overlap_chars = overlap_tokens * 4

        chunks: list[TextChunk] = []
        pos = 0
        page_estimate = 1

        while pos < len(text):
            end = min(pos + chars_per_chunk, len(text))

            # Chercher le dernier saut de paragraphe avant la limite
            # pour ne pas couper au milieu d'une clause
            if end < len(text):
                last_paragraph = text.rfind("\n\n", pos, end)
                if last_paragraph > pos + (chars_per_chunk // 2):
                    end = last_paragraph

            chunk_text = text[pos:end]
            estimated_tokens = len(chunk_text) // 4

            chunks.append(
                TextChunk(
                    text=chunk_text,
                    start_page=page_estimate,
                    end_page=page_estimate + (estimated_tokens // 300),
                    estimated_tokens=estimated_tokens,
                )
            )

            # Avancer avec overlap
            pos = end - overlap_chars
            page_estimate += estimated_tokens // 300

        return chunks

    def _toc_based_chunks(
        self,
        text: str,
        relevant_sections: list[dict],
        chunk_target_tokens: int,
        overlap_tokens: int,
    ) -> list[TextChunk]:
        """
        Chunking basé sur la table des matières: extrait uniquement les sections
        pertinentes et les groupe en chunks ne dépassant pas chunk_target_tokens.
        """
        chunks: list[TextChunk] = []
        current_chunk_parts: list[str] = []
        current_tokens = 0
        current_start_page = relevant_sections[0].get("page_start", 1) if relevant_sections else 1

        # Texte de la précédente section (overlap)
        overlap_text = ""

        for section in relevant_sections:
            section_start_page = section.get("page_start", 1)
            section_end_page = section.get("page_end", section_start_page)

            # Extraction du texte de la section via les marqueurs [PAGE N]
            section_text = self._extract_section_text(
                text, section_start_page, section_end_page
            )

            section_tokens = len(section_text) // 4

            # Si ajouter cette section dépasse la taille cible → flush du chunk actuel
            if current_tokens + section_tokens > chunk_target_tokens and current_chunk_parts:
                combined = overlap_text + "\n\n".join(current_chunk_parts)
                chunks.append(
                    TextChunk(
                        text=combined,
                        start_page=current_start_page,
                        end_page=section_start_page - 1,
                        covered_sections=[s.get("title", "") for s in relevant_sections],
                        estimated_tokens=len(combined) // 4,
                    )
                )
                # Préparer l'overlap: derniers 400 tokens du chunk précédent
                overlap_text = combined[-(overlap_tokens * 4) :] + "\n\n[...]\n\n"
                current_chunk_parts = []
                current_tokens = len(overlap_text) // 4
                current_start_page = section_start_page

            current_chunk_parts.append(section_text)
            current_tokens += section_tokens

        # Flush du dernier chunk
        if current_chunk_parts:
            combined = overlap_text + "\n\n".join(current_chunk_parts)
            last_section = relevant_sections[-1] if relevant_sections else {}
            chunks.append(
                TextChunk(
                    text=combined,
                    start_page=current_start_page,
                    end_page=last_section.get("page_end", current_start_page),
                    estimated_tokens=len(combined) // 4,
                )
            )

        return chunks or self._linear_chunks(text, chunk_target_tokens, overlap_tokens)

    def _extract_section_text(
        self, full_text: str, start_page: int, end_page: int
    ) -> str:
        """Extrait le texte entre les marqueurs [PAGE N] et [PAGE M]."""
        lines = full_text.split("\n")
        result_lines: list[str] = []
        in_range = False

        for line in lines:
            if line.strip() == f"[PAGE {start_page}]":
                in_range = True
            elif in_range and line.strip() == f"[PAGE {end_page + 1}]":
                break

            if in_range:
                result_lines.append(line)

        return "\n".join(result_lines) if result_lines else ""

    @staticmethod
    def _detect_language(text: str) -> str:
        """
        Détection simplifiée de la langue contractuelle.
        Évite une dépendance lourde (langdetect) pour un gain marginal.
        """
        # Indicateurs lexicaux français
        french_indicators = [
            "article", "contrat", "résiliation", "préavis",
            "clause", "partie", "prestataire", "client",
        ]
        text_lower = text[:5000].lower()
        french_count = sum(1 for w in french_indicators if w in text_lower)

        return "fr" if french_count >= 3 else "en"
