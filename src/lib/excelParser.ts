import * as XLSX from 'xlsx';
import { Rider } from '../types';

const HEADER_KEYWORDS = new Set([
  'name',
  'rider',
  'rider name',
  'riders',
  'delivery rider',
  'delivery boy',
  'phone',
  'phone number',
  'mobile',
  'contact',
  'vehicle',
  'vehicle number',
  'vehicle no',
  'bike no',
  'sl no',
  'sl.no',
  's.no',
  's.no.',
  'sr no',
  'sr.no',
  'id',
  'status',
  'no',
  '#',
]);

function isHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) return true;
  const matchCount = cells.filter((c) => HEADER_KEYWORDS.has(c.toLowerCase().trim())).length;
  return matchCount > 0;
}

function isJunkString(str: string): boolean {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim();
  if (s.length < 2) return true;
  if (
    s.startsWith('PK') ||
    s.includes('xml') ||
    s.includes('schemas.openxmlformats') ||
    s.includes('worksheets/') ||
    s.includes('[Content_Types]')
  ) {
    return true;
  }
  // Check if string contains only unprintable/control characters or XML tags
  if (/^[^\w\s\u00C0-\u024F\u0900-\u097F]+$/.test(s)) {
    return true;
  }
  return false;
}

export function parseRidersFromBuffer(
  buffer: ArrayBuffer | Buffer,
  existingRiders: Rider[] = []
): { count: number; newRiders: Rider[]; riders: Rider[] } {
  let workbook: XLSX.WorkBook;
  try {
    const dataArr = buffer instanceof Buffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
    workbook = XLSX.read(dataArr, { type: 'array' });
  } catch (err: any) {
    throw new Error('Invalid or corrupted Excel file format. Please upload a valid .xlsx or .xls file.');
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Excel file contains no readable sheets.');
  }

  // Find first visible worksheet
  let targetSheetName = workbook.SheetNames[0];
  if (workbook.Workbook && workbook.Workbook.Sheets) {
    for (let i = 0; i < workbook.SheetNames.length; i++) {
      const sName = workbook.SheetNames[i];
      const sheetMeta = workbook.Workbook.Sheets[i];
      if (!sheetMeta || sheetMeta.Hidden !== 1) {
        targetSheetName = sName;
        break;
      }
    }
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error('Could not read sheet data from the Excel file.');
  }

  // Convert worksheet to 2D array of raw values
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('The uploaded Excel sheet is empty.');
  }

  const existingMap = new Set(existingRiders.map((r) => r.name.toLowerCase().trim()));
  const newRiderList: Rider[] = [];
  const updatedRiders = [...existingRiders];
  let addedCount = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Convert row cells to trimmed strings
    const cellStrings = row.map((c) => String(c ?? '').trim());
    const nonEmp = cellStrings.filter(Boolean);
    if (nonEmp.length === 0) continue;

    // Check header
    if (isHeaderRow(cellStrings)) {
      continue;
    }

    let rawName = '';
    let rawPhone = '';
    let rawVehicle = '';

    // If cell 0 is numeric index (1, 2, 3...) and cell 1 is string, shift columns
    if (/^\d+$/.test(cellStrings[0]) && cellStrings.length > 1 && isNaN(Number(cellStrings[1]))) {
      rawName = cellStrings[1];
      rawPhone = cellStrings[2] || '';
      rawVehicle = cellStrings[3] || '';
    } else {
      rawName = cellStrings[0];
      rawPhone = cellStrings[1] || '';
      rawVehicle = cellStrings[2] || '';
    }

    // Clean name
    const cleanedName = rawName.replace(/^["']|["']$/g, '').trim();

    if (!cleanedName || isJunkString(cleanedName) || HEADER_KEYWORDS.has(cleanedName.toLowerCase())) {
      continue;
    }

    // Validate phone if present
    let cleanedPhone = rawPhone.replace(/[^\d+]/g, '').trim();
    if (cleanedPhone.length < 5 || cleanedPhone.length > 15) {
      cleanedPhone = rawPhone.length <= 15 ? rawPhone : '';
    }

    // Validate vehicle
    const cleanedVehicle = rawVehicle.length <= 30 ? rawVehicle : '';

    const lowerName = cleanedName.toLowerCase();
    if (!existingMap.has(lowerName)) {
      existingMap.add(lowerName);
      const newRider: Rider = {
        id: `rider_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${Math.random().toString(36).substring(2, 4)}`,
        name: cleanedName,
        phone: cleanedPhone,
        vehicleNumber: cleanedVehicle,
        status: 'Active',
        totalDeliveries: 0,
      };
      newRiderList.push(newRider);
      updatedRiders.push(newRider);
      addedCount++;
    }
  }

  if (addedCount === 0 && newRiderList.length === 0) {
    if (existingRiders.length > 0) {
      throw new Error('All riders in the uploaded file already exist in the directory.');
    }
    throw new Error('No valid rider records found in the uploaded file. Please check file formatting.');
  }

  return {
    count: addedCount,
    newRiders: newRiderList,
    riders: updatedRiders,
  };
}
