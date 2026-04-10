// src/lib/googleSheets.ts
import { google, sheets_v4 } from 'googleapis';

// =====================================================
// CONFIGURATION
// =====================================================
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// =====================================================
// TYPES
// =====================================================
type OrderData = {
  customerName: string;
  phone: string;
  address: string;
  city: string;
  productName?: string;
  productPrice?: number;
  source: string;
  status: string;
};

type OrderRow = {
  date: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  product: string;
  price: string;
  source: string;
};

// =====================================================
// AUTHENTICATION - الطريقة الصحيحة لـ JWT
// =====================================================
const getAuthClient = () => {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error('❌ Google Sheets credentials missing');
    return null;
  }

  // ✅ الطريقة الصحيحة لإنشاء JWT client
  return new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

// =====================================================
// ENSURE SHEET EXISTS
// =====================================================
async function ensureSheetExists(
  sheets: sheets_v4.Sheets, 
  sheetName: string
): Promise<void> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetExists = response.data.sheets?.some(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (!sheetExists) {
      // Add new sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // Add headers to new sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:H1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['التاريخ', 'العميل', 'رقم الموبايل', 'العنوان', 'المدينة', 'المنتج', 'السعر', 'المصدر']],
        },
      });
      console.log(`✅ Created sheet: ${sheetName}`);
    }
  } catch (error) {
    console.error('❌ Error ensuring sheet exists:', error);
  }
}

// =====================================================
// APPEND ORDER TO SHEET
// =====================================================
export async function appendOrderToSheet(orderData: OrderData): Promise<boolean> {
  try {
    if (!SPREADSHEET_ID) {
      console.error('❌ GOOGLE_SHEETS_ID not set');
      return false;
    }

    const auth = getAuthClient();
    if (!auth) return false;

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = `مدينة_${orderData.city}`;
    
    await ensureSheetExists(sheets, sheetName);
    await ensureSheetExists(sheets, 'جميع_الطلبات');

    const row = [
      new Date().toLocaleString('ar-EG'),
      orderData.customerName,
      orderData.phone,
      orderData.address,
      orderData.city,
      orderData.productName || '-',
      orderData.productPrice?.toString() || '-',
      orderData.source,
    ];

    // Append to city-specific sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    // Append to master sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'جميع_الطلبات!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    console.log(`✅ Order appended to Google Sheets: ${sheetName}`);
    return true;
  } catch (error) {
    console.error('❌ Error appending to Google Sheets:', error);
    return false;
  }
}

// =====================================================
// GET ORDERS FROM SHEET
// =====================================================
export async function getOrdersFromSheet(sheetName?: string): Promise<OrderRow[]> {
  try {
    if (!SPREADSHEET_ID) return [];

    const auth = getAuthClient();
    if (!auth) return [];

    const sheets = google.sheets({ version: 'v4', auth });
    const targetSheet = sheetName || 'جميع_الطلبات';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${targetSheet}!A:H`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return [];

    return rows.slice(1).map((row: string[]) => ({
      date: row[0] || '',
      customerName: row[1] || '',
      phone: row[2] || '',
      address: row[3] || '',
      city: row[4] || '',
      product: row[5] || '',
      price: row[6] || '',
      source: row[7] || '',
    }));
  } catch (error) {
    console.error('❌ Error getting orders from sheet:', error);
    return [];
  }
}