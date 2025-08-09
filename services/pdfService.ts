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
    throw new Error("PDF.js library failed to load. Please check your internet connection and try again.");
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const numPages = pdf.numPages;
  const pagesContent: PageText[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    
    pagesContent.push({ pageNumber: i, text: pageText });
  }

  return pagesContent;
};