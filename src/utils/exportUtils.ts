import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Export table data to PDF
 * @param title Document title
 * @param headers Array of column headers
 * @param data Array of arrays containing row data
 * @param filename File name (without extension)
 */
export const exportToPDF = (
  title: string,
  headers: string[],
  data: any[][],
  filename: string = 'export'
) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(11);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

  (doc as any).autoTable({
    startY: 36,
    head: [headers],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22] }, // Primary color
    styles: { fontSize: 10, cellPadding: 3 },
  });

  doc.save(`${filename}.pdf`);
};

/**
 * Export table data to Excel (XLSX)
 * @param headers Array of column headers
 * @param data Array of objects containing row data (keys must match headers)
 * @param filename File name (without extension)
 */
export const exportToExcel = (
  headers: string[],
  data: any[],
  filename: string = 'export'
) => {
  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // Save file
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
