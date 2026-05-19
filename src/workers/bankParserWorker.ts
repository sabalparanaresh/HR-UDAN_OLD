import * as XLSX from '../utils/xlsx';

type ParseMessage = {
  type: 'PARSE';
  buffer: ArrayBuffer;
};

self.onmessage = async (e: MessageEvent<ParseMessage>) => {
  if (e.data.type !== 'PARSE') return;

  try {
    const wb = await XLSX.read(e.data.buffer, { type: 'binary' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];

    if (rawData.length === 0) {
      self.postMessage({ type: 'ERROR', message: 'File is empty' });
      return;
    }

    // Column normalisation
    const mappedData = rawData.map((row) => {
      const m: Record<string, unknown> = {};
      Object.keys(row).forEach((key) => {
        const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
        if (cleanKey.includes('ifsc'))                                        m.ifsc      = row[key];
        else if (cleanKey.includes('bank_name') || cleanKey.includes('bankname') || cleanKey === 'bank' || cleanKey === 'name') m.bank_name = row[key];
        else if (cleanKey.includes('branch'))                                  m.branch    = row[key];
        else                                                                   m[cleanKey] = row[key];
      });
      return m;
    });

    self.postMessage({ type: 'DONE', data: mappedData });
  } catch (err: unknown) {
    self.postMessage({ type: 'ERROR', message: (err as Error).message });
  }
};
