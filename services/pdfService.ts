
import { PageText } from '../types';

declare const pdfjsLib: any;

// Set the workerSrc as soon as the module is loaded.
// A check ensures that this doesn't crash if pdf.js fails to load from the CDN.
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const extractTextPerPage = async (file: File): Promise<PageText[]> => {
  if (typeof pdfjsLib === 'undefined') {
    console.error("PDF.js library failed to load.");
    throw new Error("فشلت مكتبة قراءة ملفات PDF في التحميل. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.");
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const numPages = pdf.numPages;
  const pagesContent: PageText[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    let lastY = -1;
    const lines: string[] = [];
    let currentLine = '';

    // A simple heuristic to detect lines based on vertical position
    for (const item of textContent.items) {
        const currentY = item.transform[5];
        if (lastY !== -1 && Math.abs(currentY - lastY) > 2) { // Use a small threshold for new line
            lines.push(currentLine.trim());
            currentLine = '';
        }
        currentLine += item.str + ' ';
        lastY = currentY;
    }
    lines.push(currentLine.trim()); // Add the last line
    
    const pageText = lines.filter(line => line).join('\n'); // Join non-empty lines with a newline
    
    pagesContent.push({ pageNumber: i, text: pageText });
  }

  return pagesContent;
};
