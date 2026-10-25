import { describe, expect, it } from 'vitest';
import {
  alignPDFCoverElements,
  centerPDFCoverElements,
  coverPreviewFontSizePx,
  coverPreviewText,
  DEFAULT_PDF_COVER_DESIGN,
  movePDFCoverElement,
  movePDFCoverElements,
  normalizePDFCoverDesign,
  parsePDFCoverDesign,
  pdfCoverMarginGuideLayout,
  PDF_COVER_GLOBAL_FOOTER_KEY,
  resetPDFCoverDesign,
  serializePDFCoverDesign,
  updatePDFCoverElement,
} from './coverDesign';
import { defaultNoteInfoFields } from './noteInfo';

describe('PDF cover design', () => {
  it('converts the requested cover margins into A4 preview percentages', () => {
    const guide = pdfCoverMarginGuideLayout();
    expect(guide.topPercent).toBeCloseTo(8.552, 3);
    expect(guide.leftPercent).toBeCloseTo(9.048, 3);
    expect(guide.widthPercent).toBeCloseTo(81.905, 3);
    expect(guide.heightPercent).toBeCloseTo(87.239, 3);
  });

  it('provides twelve note elements plus the copyright variable by default', () => {
    expect(DEFAULT_PDF_COVER_DESIGN.enabled).toBe(false);
    expect(DEFAULT_PDF_COVER_DESIGN.includeWatermark).toBe(false);
    expect(DEFAULT_PDF_COVER_DESIGN.version).toBe(2);
    expect(DEFAULT_PDF_COVER_DESIGN.elements).toHaveLength(13);
    expect(DEFAULT_PDF_COVER_DESIGN.elements.at(-1)?.key).toBe(PDF_COVER_GLOBAL_FOOTER_KEY);
  });

  it('normalizes partial and invalid settings while clamping coordinates', () => {
    const design = normalizePDFCoverDesign({
      enabled: true,
      includeWatermark: true,
      elements: [
        { key: 'companyName', xMm: -10, yMm: 400, fontSize: 100, alignment: 'invalid' },
      ],
    });
    expect(design.enabled).toBe(true);
    expect(design.includeWatermark).toBe(true);
    expect(design.elements).toHaveLength(13);
    expect(design.elements[0].xMm).toBe(0);
    expect(design.elements[0].yMm).toBe(297);
    expect(design.elements[0].fontSize).toBe(48);
    expect(design.elements[0].alignment).toBe('left');
  });

  it('round-trips settings and updates a single element', () => {
    const design = updatePDFCoverElement(DEFAULT_PDF_COVER_DESIGN, 'companyName', {
      showLabel: true,
      alignment: 'center',
    });
    const parsed = parsePDFCoverDesign(serializePDFCoverDesign(design));
    expect(parsed.elements[0].showLabel).toBe(true);
    expect(parsed.elements[0].alignment).toBe('center');
  });

  it('preserves per-variable enabled state in version 2 settings', () => {
    const disabled = updatePDFCoverElement(
      DEFAULT_PDF_COVER_DESIGN,
      PDF_COVER_GLOBAL_FOOTER_KEY,
      { enabled: false },
    );
    const parsed = parsePDFCoverDesign(serializePDFCoverDesign(disabled));
    expect(parsed.elements.at(-1)?.enabled).toBe(false);
  });

  it('moves elements within the A4 page and resets defaults', () => {
    const moved = movePDFCoverElement(DEFAULT_PDF_COVER_DESIGN, 'companyName', -4, 301);
    expect(moved.elements[0].xMm).toBe(0);
    expect(moved.elements[0].yMm).toBe(297);
    expect(resetPDFCoverDesign(true).enabled).toBe(true);
  });

  it('moves multiple selected elements together and clamps to the page', () => {
    const moved = movePDFCoverElements(
      DEFAULT_PDF_COVER_DESIGN,
      {
        companyName: { xMm: 205, yMm: 20 },
        documentNumber: { xMm: 180, yMm: 41 },
      },
      20,
      10,
    );
    expect(moved.elements[0].xMm).toBe(210);
    expect(moved.elements[0].yMm).toBe(30);
    expect(moved.elements[1].xMm).toBe(200);
    expect(moved.elements[1].yMm).toBe(51);
  });

  it('aligns selected elements with measured block spacing', () => {
    const aligned = alignPDFCoverElements(
      DEFAULT_PDF_COVER_DESIGN,
      ['companyName', 'documentNumber', 'version'],
      'left',
      8,
      { companyName: 4, documentNumber: 4, version: 4 },
    );
    const company = aligned.elements.find((element) => element.key === 'companyName')!;
    const documentNumber = aligned.elements.find((element) => element.key === 'documentNumber')!;
    const version = aligned.elements.find((element) => element.key === 'version')!;
    expect(company.xMm).toBe(25);
    expect(company.alignment).toBe('left');
    expect(documentNumber.yMm).toBe(company.yMm + 12);
    expect(version.yMm).toBe(documentNumber.yMm + 12);

    const centered = alignPDFCoverElements(
      DEFAULT_PDF_COVER_DESIGN,
      ['companyName', 'subtitle'],
      'center',
      5,
    );
    expect(centered.elements[0].xMm).toBe(105);
    expect(centered.elements[0].alignment).toBe('center');
  });

  it('centers the selected group by its rendered bounds', () => {
    const horizontal = centerPDFCoverElements(
      DEFAULT_PDF_COVER_DESIGN,
      ['companyName', 'subtitle'],
      { left: 20, top: 20, width: 100, height: 40 },
      'horizontal',
    );
    const company = horizontal.elements.find((element) => element.key === 'companyName')!;
    const subtitle = horizontal.elements.find((element) => element.key === 'subtitle')!;
    expect(company.xMm - 25).toBeCloseTo(35, 1);
    expect(subtitle.xMm - 105).toBeCloseTo(35, 1);
    expect(company.yMm).toBe(25.6);
    expect(subtitle.yMm).toBe(121);

    const vertical = centerPDFCoverElements(
      DEFAULT_PDF_COVER_DESIGN,
      ['companyName', 'subtitle'],
      { left: 20, top: 100, width: 100, height: 40 },
      'vertical',
    );
    const verticalCompany = vertical.elements.find((element) => element.key === 'companyName')!;
    const verticalSubtitle = vertical.elements.find((element) => element.key === 'subtitle')!;
    expect(verticalCompany.yMm - 25.6).toBeCloseTo(28.5, 1);
    expect(verticalSubtitle.yMm - 121).toBeCloseTo(28.5, 1);
    expect(verticalCompany.xMm).toBe(25);
    expect(verticalSubtitle.xMm).toBe(105);
  });

  it('builds preview text with title fallback and placeholders', () => {
    const fields = defaultNoteInfoFields();
    fields[0].value = 'Puff 公司';
    const company = DEFAULT_PDF_COVER_DESIGN.elements[0];
    const title = DEFAULT_PDF_COVER_DESIGN.elements[4];
    const documentNumber = DEFAULT_PDF_COVER_DESIGN.elements[1];
    expect(coverPreviewText({ ...company, showLabel: true }, fields, '', '')).toBe('公司名稱：Puff 公司');
    expect(coverPreviewText(title, fields, '年度報告', '')).toBe('年度報告');
    expect(coverPreviewText(documentNumber, fields, '', '')).toBe('文件編號：（尚未填寫）');
  });

  it('scales preview font sizes into valid CSS pixels', () => {
    expect(coverPreviewFontSizePx(30, 0.8)).toBe(24);
    expect(coverPreviewFontSizePx(8, 0.8)).toBe(6.4);
    expect(coverPreviewFontSizePx(Number.NaN, 0.8)).toBe(0);
  });
});
