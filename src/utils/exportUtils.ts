/**
 * Export table data to PDF using dynamic import to preserve bundle size
 * @param title Document title
 * @param headers Array of column headers
 * @param data Array of arrays containing row data
 * @param filename File name (without extension)
 */
export const exportToPDF = async (
  title: string,
  headers: string[],
  data: any[][],
  filename: string = 'export'
) => {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

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
 * Export table data to Excel (XLSX) using dynamic import to preserve bundle size
 * @param headers Array of column headers
 * @param data Array of objects containing row data (keys must match headers)
 * @param filename File name (without extension)
 */
export const exportToExcel = async (
  headers: string[],
  data: any[],
  filename: string = 'export'
) => {
  const XLSX = await import('xlsx');

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // Save file
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
