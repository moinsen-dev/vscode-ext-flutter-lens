export class TfIdfVectorizer {
    private documents: string[] = [];
    private vocabulary: Map<string, number> = new Map();
    private idf: Map<string, number> = new Map();
    private readonly maxFeatures: number = 384;  // Set this to match your expected dimension

    addDocument(doc: string) {
        this.documents.push(doc);
        const words = this.tokenize(doc);
        for (const word of new Set(words)) {
            this.vocabulary.set(word, (this.vocabulary.get(word) || 0) + 1);
        }
    }

    fit() {
        const N = this.documents.length;
        for (const [word, count] of this.vocabulary.entries()) {
            this.idf.set(word, Math.log(N / count));
        }
    }

    transform(doc: string): number[] {
        const words = this.tokenize(doc);
        const vector: number[] = new Array(this.maxFeatures).fill(0);
        const wordCounts = new Map<string, number>();

        for (const word of words) {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }

        let i = 0;
        for (const word of this.vocabulary.keys()) {
            if (i >= this.maxFeatures) { break; }  // Ensure we don't exceed maxFeatures
            const tf = wordCounts.get(word) || 0;
            const idf = this.idf.get(word) || 0;
            vector[i] = tf * idf;
            i++;
        }

        return vector;
    }

    private tokenize(text: string): string[] {
        return text.toLowerCase().split(/\W+/).filter(word => word.length > 0);
    }
}