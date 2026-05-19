import ExcelJS from 'exceljs';

class Workbook {
    wb: ExcelJS.Workbook;
    SheetNames: string[];
    Sheets: Record<string, ExcelJS.Worksheet>;
    
    constructor() {
        this.wb = new ExcelJS.Workbook();
        this.SheetNames = [];
        this.Sheets = {};
    }
}

export const utils = {
    aoa_to_sheet: (aoa: any[][]) => {
        const ws = { _aoa: aoa } as any;
        return ws;
    },
    json_to_sheet: (json: any[]) => {
        if (!json || json.length === 0) return { _aoa: [] } as any;
        const headers = Object.keys(json[0]);
        const aoa = [headers];
        for (const item of json) {
            aoa.push(headers.map(h => item[h]));
        }
        return { _aoa: aoa } as any;
    },
    book_new: () => {
        return new Workbook();
    },
    book_append_sheet: (wb: Workbook, ws: any, name: string) => {
        const sheetName = name && name.length > 0 ? name : `Sheet${wb.SheetNames.length + 1}`;
        wb.SheetNames.push(sheetName);
        const actualSheet = wb.wb.addWorksheet(sheetName);
        if (ws._aoa) {
            actualSheet.addRows(ws._aoa);
            // Optionally make first row bold
            if (ws._aoa.length > 0) {
               actualSheet.getRow(1).font = { bold: true };
            }
        }
        wb.Sheets[sheetName] = actualSheet;
    },
    sheet_to_json: (ws: ExcelJS.Worksheet, options?: any): any[] => {
        const data: any[] = [];
        if (!ws.rowCount) return data;
        
        const headerRow = ws.getRow(1);
        const headers: string[] = [];
        let maxCol = 1;
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value ? String(cell.value) : `Column${colNumber}`;
            if (colNumber > maxCol) maxCol = colNumber;
        });
        
        if (options?.header === 1) {
            ws.eachRow((row, rowNumber) => {
                const rowData: any[] = [];
                for (let i = 1; i <= maxCol; i++) {
                    const cell = row.getCell(i);
                    rowData.push(cell.value !== null ? cell.value : (options?.defval !== undefined ? options.defval : undefined));
                }
                data.push(rowData);
            });
            return data;
        }

        // If there's no header row? Assume 1-indexed.
        if (headers.length === 0) return data;

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            const rowData: any = {};
            for (let i = 1; i < headers.length; i++) {
                if (headers[i]) {
                    const cell = row.getCell(i);
                    rowData[headers[i]] = cell.value !== null ? cell.value : (options?.defval !== undefined ? options.defval : undefined);
                }
            }
            data.push(rowData);
        });
        return data;
    }
};

export const writeFile = async (wb: Workbook, filename: string) => {
    try {
        const { saveAs } = await import('file-saver');
        const buffer = await wb.wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), filename);
    } catch(err) { 
        console.error(err); 
    }
};

export const read = async (data: any, options?: any): Promise<Workbook> => {
    const wb = new Workbook();
    
    // Convert binary string to ArrayBuffer if needed
    let buffer = data;
    if (typeof data === 'string' && options?.type === 'binary') {
        buffer = new ArrayBuffer(data.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < data.length; ++i) {
            view[i] = data.charCodeAt(i) & 0xFF;
        }
    }
    
    await wb.wb.xlsx.load(buffer);
    
    wb.wb.eachSheet((worksheet, id) => {
        wb.SheetNames.push(worksheet.name);
        wb.Sheets[worksheet.name] = worksheet;
    });
    
    return wb;
};
