import * as fs from 'fs';
import * as hnswlib from 'hnswlib-node';
import * as path from 'path';
import * as vscode from 'vscode';

export class VectorDatabase {
    private index: hnswlib.HierarchicalNSW;
    private documents: string[] = [];
    private readonly dimension = 384; // Dimension für den Sentence Transformer
    private readonly maxElements = 10000;
    private readonly efConstruction = 200;
    private readonly M = 16;

    constructor(private context: vscode.ExtensionContext) {
        this.index = new hnswlib.HierarchicalNSW('cosine', this.dimension);
        this.loadOrCreateIndex();
    }

    private loadOrCreateIndex() {
        const indexPath = path.join(this.context.globalStorageUri.fsPath, 'vector_index.bin');
        if (fs.existsSync(indexPath)) {
            this.index.readIndex(indexPath);
            // TODO: Laden Sie auch die Dokumente
        } else {
            this.index.initIndex(this.maxElements, this.M, this.efConstruction);
        }
    }

    async addDocument(text: string, vector: number[]) {
        const currentCount = this.index.getCurrentCount();
        this.index.addPoint(vector, currentCount);
        this.documents.push(text);
    }

    async search(query: number[], k: number = 5): Promise<string[]> {
        const result = this.index.searchKnn(query, k);
        return result.neighbors.map((idx: number) => this.documents[idx]);
    }

    async getSimilarQuestions(query: number[], k: number = 5): Promise<string[]> {
        const result = this.index.searchKnn(query, k);
        return result.neighbors.map((idx: number) => {
            const doc = this.documents[idx];
            // Extrahieren Sie den ersten Satz oder die ersten 10 Wörter als "Frage"
            return doc.split('.')[0] || doc.split(' ').slice(0, 10).join(' ') + '...';
        });
    }

    saveIndex() {
        const indexPath = path.join(this.context.globalStorageUri.fsPath, 'vector_index.bin');
        this.index.writeIndex(indexPath);
        // TODO: Speichern Sie auch die Dokumente
    }
}