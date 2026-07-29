import * as XLSX from 'xlsx';
import { Rider } from '../types';

// Header keywords for column detection
const NAME_HEADERS = [
  'name',
  'rider name',
  'rider',
  'riders',
  'delivery rider',
  'delivery boy',
  'driver',
  'driver name',
  'employee name',
  'staff name',
  'person name',
  'full name',
  'person',
];

const PHONE_HEADERS = [
  'phone',
  'phone number',
  'phone no',
  'mobile',
  'mobile number',
  'mobile no',
  'contact',
  'contact number',
  'contact no',
  'tel',
  'telephone',
];

const VEHICLE_HEADERS = [
  'vehicle',
  'vehicle number',
  'vehicle no',
  'bike',
  'bike number',
  'bike no',
  'reg no',
  'registration no',
  'vehicle reg',
];

const SERIAL_HEADERS = [
  's.no',
  's.no.',
  'sl.no',
  'sl.no.',
  'sr.no',
  'sr.no.',
  'sl no',
  'sr no',
  'no',
  'id',
  '#',
  'serial no',
];

const IGNORE_WORDS = new Set([
  'total',
  'subtotal',
  'summary',
  'count',
  'date',
  'signature',
  'page',
  'status',
  'active',
  'inactive',
  'sl.no',
  'sr.no',
  's.no',
  'serial',
  'remark',
  'remarks',
]);

/**
 * Validates if a string is a valid human rider name (not XML/ZIP junk, not title headers, not metadata).
 */
export function isValidRiderName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const s = name.trim();
  if (s.length < 2 || s.length > 70) return false;

  // Reject ZIP/XML file headers and internal path junk
  if (
    s.startsWith('PK') ||
    s.includes('xml') ||
    s.includes('schemas.openxmlformats') ||
    s.includes('worksheets/') ||
    s.includes('[Content_Types]') ||
    s.includes('docProps/') ||
    s.includes('_rels/') ||
    s.includes('theme/') ||
    s.includes('xl/') ||
    s.includes('calcChain') ||
    s.startsWith('<?xml') ||
    s.startsWith('<')
  ) {
    return false;
  }

  const lower = s.toLowerCase();

  // Reject header titles/metadata
  if (
    NAME_HEADERS.includes(lower) ||
    PHONE_HEADERS.includes(lower) ||
    VEHICLE_HEADERS.includes(lower) ||
    SERIAL_HEADERS.includes(lower) ||
    IGNORE_WORDS.has(lower)
  ) {
    return false;
  }

  // Reject strings containing document title keywords if it looks like a header banner
  if (
    (lower.includes('rider list') ||
      lower.includes('delivery list') ||
      lower.includes('sheet') ||
      lower.includes('directory') ||
      lower.includes('report') ||
      lower.includes('company') ||
      lower.includes('confidential')) &&
    s.length > 20
  ) {
    return false;
  }

  // Must contain at least one letter or word character
  if (!/[\p{L}\p{N}]/u.test(s)) {
    return false;
  }

  // Cannot be purely numbers
  if (/^\d+$/.test(s)) {
    return false;
  }

  return true;
}

export function parseRidersFromBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  existingRiders: Rider[] = []
): { count: number; newRiders: Rider[]; riders: Rider[] } {
  let workbook: XLSX.WorkBook;
  try {
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } else {
      const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
      workbook = XLSX.read(uint8, { type: 'array' });
    }
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

  // Filter out any invalid existing riders
  const cleanExistingRiders = existingRiders.filter((r) => r && isValidRiderName(r.name));
  const existingMap = new Set(cleanExistingRiders.map((r) => r.name.toLowerCase().trim()));

  // Step 1: Detect Header Row and Column Indices
  let headerRowIndex = -1;
  let nameColIdx = -1;
  let phoneColIdx = -1;
  let vehicleColIdx = -1;

  for (let rIdx = 0; rIdx < Math.min(rows.length, 20); rIdx++) {
    const row = rows[rIdx];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? '').trim().toLowerCase());

    let foundName = -1;
    let foundPhone = -1;
    let foundVehicle = -1;

    cells.forEach((cell, cIdx) => {
      if (!cell) return;
      if (NAME_HEADERS.some((h) => cell === h || cell.includes('rider name'))) {
        foundName = cIdx;
      } else if (PHONE_HEADERS.some((h) => cell === h || cell.includes('phone') || cell.includes('mobile'))) {
        foundPhone = cIdx;
      } else if (VEHICLE_HEADERS.some((h) => cell === h || cell.includes('vehicle') || cell.includes('bike'))) {
        foundVehicle = cIdx;
      }
    });

    if (foundName !== -1 || (foundPhone !== -1 && cells.length > 1)) {
      headerRowIndex = rIdx;
      nameColIdx = foundName;
      phoneColIdx = foundPhone;
      vehicleColIdx = foundVehicle;
      break;
    }
  }

  const newRiderList: Rider[] = [];
  const updatedRiders = [...cleanExistingRiders];
  let addedCount = 0;

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

  for (let rIdx = startRow; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!Array.isArray(row) || row.length === 0) continue;

    const cellStrings = row.map((c) => String(c ?? '').trim());
    const nonEmp = cellStrings.filter(Boolean);
    if (nonEmp.length === 0) continue;

    let rawName = '';
    let rawPhone = '';
    let rawVehicle = '';

    if (nameColIdx !== -1) {
      // Use detected column mapping
      rawName = cellStrings[nameColIdx] || '';
      rawPhone = phoneColIdx !== -1 ? cellStrings[phoneColIdx] || '' : '';
      rawVehicle = vehicleColIdx !== -1 ? cellStrings[vehicleColIdx] || '' : '';
    } else {
      // Fallback: Default positional mapping
      // If cell 0 is numeric index (1, 2, 3...) and cell 1 is string, shift
      if (/^\d+$/.test(cellStrings[0]) && cellStrings.length > 1 && !/^\d+$/.test(cellStrings[1])) {
        rawName = cellStrings[1];
        rawPhone = cellStrings[2] || '';
        rawVehicle = cellStrings[3] || '';
      } else {
        rawName = cellStrings[0];
        rawPhone = cellStrings[1] || '';
        rawVehicle = cellStrings[2] || '';
      }
    }

    const cleanedName = rawName.replace(/^["']|["']$/g, '').trim();

    if (!isValidRiderName(cleanedName)) {
      continue;
    }

    // Clean Phone
    let cleanedPhone = rawPhone.replace(/[^\d+]/g, '').trim();
    if (cleanedPhone.length < 5 || cleanedPhone.length > 15) {
      cleanedPhone = rawPhone.length <= 15 ? rawPhone : '';
    }

    // Clean Vehicle
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
    if (cleanExistingRiders.length > 0) {
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
