import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import * as vscode from 'vscode';

interface PubspecInfo {
    name: string;
    path: string;
    [key: string]: any;
}

export class Database {
    private db: sqlite3.Database;

    constructor(context: vscode.ExtensionContext) {
        const dbPath = path.join(context.globalStoragePath, 'flutterlens.db');
        this.db = new sqlite3.Database(dbPath);
        this.initDatabase();
    }

    private initDatabase() {
        this.db.serialize(() => {
            this.db.run("CREATE TABLE IF NOT EXISTS pubspecs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, path TEXT, content TEXT)");
            this.db.run("CREATE TABLE IF NOT EXISTS vectors (id INTEGER PRIMARY KEY AUTOINCREMENT, packageName TEXT, vector TEXT)");
        });
    }

    async savePubspec(pubspecInfo: PubspecInfo): Promise<void> {
        return new Promise((resolve, reject) => {
            const { name, path, ...content } = pubspecInfo;
            const stmt = this.db.prepare("INSERT OR REPLACE INTO pubspecs (name, path, content) VALUES (?, ?, ?)");
            stmt.run(name, path, JSON.stringify(content), (err: Error | null) => {
                if (err) { reject(err); }
                else { resolve(); }
            });
            stmt.finalize();
        });
    }

    async getPubspecs(): Promise<PubspecInfo[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM pubspecs", (err: Error | null, rows: any[]) => {
                if (err) { reject(err); }
                else {
                    resolve(rows.map(row => ({
                        ...row,
                        ...JSON.parse(row.content as string)
                    })));
                }
            });
        });
    }

    async clearPubspecs(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM pubspecs", (err: Error | null) => {
                if (err) { reject(err); }
                else { resolve(); }
            });
        });
    }

    async saveVector(packageName: string, vector: number[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare("INSERT OR REPLACE INTO vectors (packageName, vector) VALUES (?, ?)");
            stmt.run(packageName, JSON.stringify(vector), (err: Error | null) => {
                if (err) { reject(err); }
                else { resolve(); }
            });
            stmt.finalize();
        });
    }

    async getVector(packageName: string): Promise<number[] | null> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT vector FROM vectors WHERE packageName = ?", [packageName], (err: Error | null, row: { vector: string } | undefined) => {
                if (err) { reject(err); }
                else { resolve(row ? JSON.parse(row.vector) : null); }
            });
        });
    }

    async getAllVectors(): Promise<{ packageName: string, vector: number[] }[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT packageName, vector FROM vectors", (err: Error | null, rows: { packageName: string, vector: string }[]) => {
                if (err) { reject(err); }
                else {
                    resolve(rows.map(row => ({
                        packageName: row.packageName,
                        vector: JSON.parse(row.vector)
                    })));
                }
            });
        });
    }

    async clearVectors(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM vectors", (err: Error | null) => {
                if (err) { reject(err); }
                else { resolve(); }
            });
        });
    }

    close() {
        this.db.close();
    }
}