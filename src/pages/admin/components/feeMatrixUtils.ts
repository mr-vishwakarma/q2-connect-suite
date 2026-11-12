// Smart floor extractor
export function extractFloor(roomNo: string | null | undefined, explicitFloor?: string | null): string {
  if (explicitFloor && explicitFloor.trim()) {
    return explicitFloor.trim();
  }
  if (!roomNo) return 'Unassigned';

  const clean = roomNo.trim().toUpperCase();
  if (clean.startsWith('G') || clean.startsWith('0') || clean.includes('GROUND')) {
    return 'Ground Floor';
  }
  if (clean.startsWith('F') || clean.startsWith('1') || clean.includes('1ST') || clean.includes('FIRST')) {
    return 'First Floor';
  }
  if (clean.startsWith('S') || clean.startsWith('2') || clean.includes('2ND') || clean.includes('SECOND')) {
    return 'Second Floor';
  }
  if (clean.startsWith('T') || clean.startsWith('3') || clean.includes('3RD') || clean.includes('THIRD')) {
    return 'Third Floor';
  }
  if (clean.startsWith('4') || clean.includes('4TH') || clean.includes('FOURTH')) {
    return 'Fourth Floor';
  }
  if (clean.startsWith('5') || clean.includes('5TH') || clean.includes('FIFTH')) {
    return 'Fifth Floor';
  }
  if (clean.startsWith('6') || clean.includes('6TH') || clean.includes('SIXTH')) {
    return 'Sixth Floor';
  }

  // Extract first digit if room is like "104", "204", "305"
  const digitMatch = clean.match(/\d/);
  if (digitMatch) {
    const digit = digitMatch[0];
    if (digit === '0') return 'Ground Floor';
    if (digit === '1') return 'First Floor';
    if (digit === '2') return 'Second Floor';
    if (digit === '3') return 'Third Floor';
    if (digit === '4') return 'Fourth Floor';
    if (digit === '5') return 'Fifth Floor';
  }

  return 'General Floor';
}

