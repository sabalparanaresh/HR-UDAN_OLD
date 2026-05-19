import { ReportResult } from '../../../../types';
import { IBaseExporter, ExportConfig } from '../../../../exporters/types';
import { BaseExporter } from '../../../../exporters/BaseExporter';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs;

export class AadharConsentPDFExporter extends BaseExporter {
  protected applyFormatting(layout: any) {
    if (!layout || !layout.data || layout.data.length === 0) {
      return null;
    }
    const record = layout.data[0];

    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11,
        lineHeight: 1.5,
      },
      content: [
        {
          columns: [
            { width: '*', text: '' }, // Spacer
            {
              width: 'auto',
              stack: [
                { text: 'AADHAR HOLDER CONSENT FORM', bold: true, fontSize: 12, decoration: 'underline', alignment: 'center', margin: [0, 0, 0, 5] },
                { text: 'Consent for Authentication', bold: true, fontSize: 11, alignment: 'center' }
              ]
            },
            { width: '*', text: record.ref_number, alignment: 'right', bold: true, fontSize: 10 }
          ],
          margin: [0, 0, 0, 30]
        },
        {
          text: `I hereby consent to provide my Aadhaar Number, Biometric and/or One Time Pin (OTP) data for Aadhaar based authentication for the purpose of establishing my identity in the company as well as to EPFO or ESIC or any other organisation which is required for my employment to the ${record.company_name} through my Aadhaar number information.`,
          alignment: 'justify',
          margin: [0, 0, 0, 15]
        },
        {
          text: `I have no objection in authenticating myself and fully understand that information provided by me shall be used for authenticating my identity through Aadhaar Authentication System for the purpose stated above and no other purpose.`,
          alignment: 'justify',
          margin: [0, 0, 0, 15]
        },
        {
          text: `I also understand that ${record.company_name} shall ensure security / confidentiality of my personal identity data provided for the purpose of Aadhaar based authentication.`,
          alignment: 'justify',
          margin: [0, 0, 0, 60] // Extra space before signature block
        },
        {
          columns: [
            { width: '*', text: '' }, // Spacer to push signature block to the right
            {
              width: 300,
              table: {
                widths: [120, '*'],
                body: [
                  [{ text: 'Signature/Thumb Impression', bold: true, border: [false, false, false, false] }, { text: '', border: [false, false, false, true] }],
                  [{ text: 'Name', bold: true, margin: [0, 10, 0, 0], border: [false, false, false, false] }, { text: record.employee_name, margin: [0, 10, 0, 0], border: [false, false, false, true] }],
                  [{ text: 'Employee Code', bold: true, margin: [0, 10, 0, 0], border: [false, false, false, false] }, { text: record.employee_code, margin: [0, 10, 0, 0], border: [false, false, false, true] }],
                  [{ text: 'Department', bold: true, margin: [0, 10, 0, 0], border: [false, false, false, false] }, { text: record.department_name, margin: [0, 10, 0, 0], border: [false, false, false, true] }],
                  [{ text: 'Designation', bold: true, margin: [0, 10, 0, 0], border: [false, false, false, false] }, { text: record.designation_name, margin: [0, 10, 0, 0], border: [false, false, false, true] }],
                  [{ text: 'Date', bold: true, margin: [0, 10, 0, 0], border: [false, false, false, false] }, { text: record.current_date, margin: [0, 10, 0, 0], border: [false, false, false, true] }],
                ]
              },
              layout: 'lightHorizontalLines'
            }
          ]
        }
      ]
    };
  }

  public async export(fileName: string): Promise<Blob> {
    if (!this.formattedData) {
      throw new Error('Data not formatted for export');
    }

    const docDefinition: TDocumentDefinitions = this.formattedData as TDocumentDefinitions;
    
    return new Promise((resolve, reject) => {
      try {
        const pdfDocGenerator = pdfMake.createPdf(docDefinition);
        pdfDocGenerator.getBlob().then((blob) => {
          resolve(blob);
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}
