// Builds small but real PDFs, so tests can run the actual text extraction instead of mocking it.

const escape = (line) => line.replace(/[\\()]/g, (m) => `\\${m}`);
const textStream = (lines) => ['BT', '/F1 11 Tf', '50 760 Td', '13 TL', ...lines.map((l) => `(${escape(l)}) Tj T*`), 'ET'].join('\n');

// One page per entry of `streams` (raw content streams). `encrypt` adds a password: the reader
// can't open it without one.
const buildPdf = (streams, { encrypt = false } = {}) => {
    const pageCount = streams.length;
    const firstPage = 4;
    const kids = streams.map((_, i) => `${firstPage + i * 2} 0 R`).join(' ');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    streams.forEach((content, i) => {
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${firstPage + i * 2 + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
        objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    });
    // Standard security handler with a user password that isn't empty: O and U don't match "".
    const encryptRef = encrypt ? objects.push(`<< /Filter /Standard /V 1 /R 2 /O <${'ab'.repeat(32)}> /U <${'cd'.repeat(32)}> /P -44 >>`) : 0;

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((obj, i) => {
        offsets.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    const extra = encrypt ? ` /Encrypt ${encryptRef} 0 R /ID [<${'12'.repeat(16)}> <${'12'.repeat(16)}>]` : '';
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${extra} >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
};

// A one-page PDF with these lines of text.
export const makePdf = (lines) => buildPdf([textStream(lines)]);

// One page per array of lines.
export const makePagedPdf = (pages, options) => buildPdf(pages.map(textStream), options);

// Like a scanned page: something drawn, but no text layer at all.
export const makeImageOnlyPdf = () => buildPdf(['0.2 0.4 0.6 rg 50 400 500 300 re f', '0 0 0 RG 4 w 60 60 m 550 700 l S']);

// About 1,000 characters of study material: enough to pass the minimum.
export const STUDY_LINES = [
    'Photosynthesis converts light energy into chemical energy stored in glucose.',
    'It happens in the chloroplasts of plant cells, mainly in the leaves.',
    'Chlorophyll is the green pigment that absorbs red and blue light.',
    'The light-dependent reactions take place in the thylakoid membranes.',
    'They split water, release oxygen, and produce ATP and NADPH.',
    'The Calvin cycle takes place in the stroma of the chloroplast.',
    'It uses ATP and NADPH to fix carbon dioxide into sugar.',
    'The enzyme RuBisCO captures carbon dioxide in the first step of the Calvin cycle.',
    'Cellular respiration releases the energy stored in glucose.',
    'Glycolysis happens in the cytoplasm and splits glucose into two pyruvate molecules.',
    'The Krebs cycle happens in the mitochondrial matrix.',
    'The electron transport chain makes most of the ATP in aerobic respiration.',
    'Oxygen is the final electron acceptor in the electron transport chain.',
    'Without oxygen, cells use fermentation, which makes far less ATP.',
];
