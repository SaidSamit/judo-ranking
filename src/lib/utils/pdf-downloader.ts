// ==============================================================================
// UTILIDAD: DESCARGA DIRECTA DE DOCUMENTOS PDF (HTML2CANVAS + JSPDF)
// ==============================================================================
//
// CARACTERÍSTICAS:
// - Genera y descarga directamente archivos .pdf en el navegador sin abrir
//   el diálogo de impresión del sistema operativo (window.print).
// - Renderizado de alta fidelidad (scale: 2) para textos y líneas nítidos.
// - Soporte para páginas individuales y multipágina con saltos limpios en formato A4.
// - Orientación configurable: Portrait (vertical) o Landscape (apaisado).
//
// ==============================================================================

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface DownloadPdfOptions {
  filename: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4';
  backgroundColor?: string;
  fitToPage?: boolean;
}

/**
 * Convierte un elemento HTML o lista de elementos en un documento PDF y lo descarga de inmediato.
 * Por defecto (fitToPage: true), escala el contenido para que entre completo y centrado en 1 página A4 sin cortes.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  options: DownloadPdfOptions
): Promise<void> {
  const orientation = options.orientation || 'portrait';
  const filename = options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`;

  // Capturar el elemento HTML en un canvas de alta resolución
  const canvas = await html2canvas(element, {
    scale: 2, // 2x para nitidez vectorial en textos
    useCORS: true,
    logging: false,
    backgroundColor: options.backgroundColor || '#ffffff',
    windowWidth: element.scrollWidth || 1200,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
  });

  const imgData = canvas.toDataURL('image/png');

  // Dimensiones en milímetros según orientación A4
  const pdfWidth = orientation === 'landscape' ? 297 : 210;
  const pdfHeight = orientation === 'landscape' ? 210 : 297;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Ajuste perfecto a una sola página (evita cualquier corte transversal o línea divisoria)
  if (options.fitToPage !== false) {
    const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
    const finalW = canvas.width * ratio;
    const finalH = canvas.height * ratio;
    const offsetX = Math.max(0, (pdfWidth - finalW) / 2);
    const offsetY = Math.max(0, (pdfHeight - finalH) / 2);

    pdf.addImage(imgData, 'PNG', offsetX, offsetY, finalW, finalH, undefined, 'FAST');
    pdf.save(filename);
    return;
  }

  // Modo multipágina continuo tradicional (solo si fitToPage: false)
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  // Primera página
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pdfHeight;

  // Páginas subsecuentes si el contenido es más alto que una página A4
  while (heightLeft > 2) {
    position -= pdfHeight;
    pdf.addPage('a4', orientation);
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;
  }

  // Descarga directa del archivo en el navegador
  pdf.save(filename);
}

/**
 * Convierte múltiples elementos (hojas individuales) en páginas separadas de un mismo archivo PDF.
 */
export async function downloadMultiplePagesAsPdf(
  elements: HTMLElement[],
  options: DownloadPdfOptions
): Promise<void> {
  if (elements.length === 0) return;

  const orientation = options.orientation || 'portrait';
  const filename = options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`;

  const pdfWidth = orientation === 'landscape' ? 297 : 210;
  const pdfHeight = orientation === 'landscape' ? 210 : 297;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: options.backgroundColor || '#ffffff',
      windowWidth: el.scrollWidth || 1200,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    const imgData = canvas.toDataURL('image/png');

    // Escalar para que quepa exactamente centrado en su página A4
    const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
    const finalW = canvas.width * ratio;
    const finalH = canvas.height * ratio;
    const offsetX = Math.max(0, (pdfWidth - finalW) / 2);
    const offsetY = Math.max(0, (pdfHeight - finalH) / 2);

    if (i > 0) {
      pdf.addPage('a4', orientation);
    }

    pdf.addImage(imgData, 'PNG', offsetX, offsetY, finalW, finalH, undefined, 'FAST');
  }

  pdf.save(filename);
}
