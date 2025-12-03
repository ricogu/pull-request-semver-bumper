import pomParser from 'pom-parser';

export function parsePom(xml: string): Promise<any> {
    return new Promise((resolve, reject) => {
        pomParser.parse({ xmlContent: xml }, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}
