// Builds a small but real one-page PDF with the given lines of text, so tests can run the
// actual text extraction instead of mocking it.
export const makePdf = (lines) => {
    const escape = (line) => line.replace(/[\\()]/g, (m) => `\\${m}`);
    const content = ['BT', '/F1 11 Tf', '50 760 Td', '13 TL', ...lines.map((l) => `(${escape(l)}) Tj T*`), 'ET'].join('\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((obj, i) => {
        offsets.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
};

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
