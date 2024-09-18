import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import * as vscode from 'vscode';
import { log } from './utils/logging';

interface PubspecInfo {
    name: string;
    path: string;
    content: string;
}

export class Database {
    private db: sqlite3.Database | null = null;
    private initialized: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        log('Database: Constructor called');
    }

    async init(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const dbPath = path.join(this.context.globalStoragePath, `${workspaceFolder.name}.db`);
        log(`Database: Initializing database at ${dbPath}`);

        // Ensure the directory exists
        await fs.promises.mkdir(path.dirname(dbPath), { recursive: true });

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
                if (err) {
                    log(`Database: Error opening database: ${err.message}`);
                    reject(err);
                } else {
                    try {
                        await this.initDatabase();
                        this.initialized = true;
                        log('Database: Initialized successfully');
                        resolve();
                    } catch (initError) {
                        log(`Database: Error during initialization: ${(initError as Error).message}`);
                        reject(initError);
                    }
                }
            });
        });
    }

    private async initDatabase(): Promise<void> {
        log('Database: initDatabase called');
        return new Promise<void>((resolve, reject) => {
            if (this.db === null) {
                log('Database: Error initializing database, db is null');
                reject(new Error('Database is null'));
                return;
            }

            this.db.serialize(() => {
                this.db!.run("CREATE TABLE IF NOT EXISTS pubspecs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, path TEXT, content TEXT)", (err) => {
                    if (err) {
                        log(`Database: Error creating pubspecs table: ${err.message}`);
                        reject(err);
                    }
                });

                this.db!.run("CREATE TABLE IF NOT EXISTS vectors (id INTEGER PRIMARY KEY AUTOINCREMENT, packageName TEXT, vector TEXT)", (err) => {
                    if (err) {
                        log(`Database: Error creating vectors table: ${err.message}`);
                        reject(err);
                    } else {
                        log('Database: Tables initialized successfully');
                        resolve();
                    }
                });
            });
        });
    }

    async savePubspec(pubspecInfo: PubspecInfo): Promise<void> {
        log(`Database: savePubspec called for ${pubspecInfo.name}`);
        if (!this.initialized || this.db === null) {
            throw new Error('Database not initialized');
        }
        return new Promise((resolve, reject) => {
            const stmt = this.db!.prepare("INSERT OR REPLACE INTO pubspecs (name, path, content) VALUES (?, ?, ?)");
            stmt.run(pubspecInfo.name, pubspecInfo.path, pubspecInfo.content, (err: Error | null) => {
                if (err) {
                    log(`Database: Error in savePubspec: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
            stmt.finalize();
        });
    }

    async getPubspec(name: string): Promise<PubspecInfo | null> {
        log(`Database: getPubspec called for ${name}`);
        if (!this.initialized) {
            throw new Error('Database not initialized');
        }
        return new Promise((resolve, reject) => {
            this.db!.get("SELECT * FROM pubspecs WHERE name = ?", [name], (err: Error | null, row: any) => {
                if (err) {
                    log(`Database: Error in getPubspec: ${err.message}`);
                    reject(err);
                } else {
                    resolve(row ? row as PubspecInfo : null);
                }
            });
        });
    }

    async getAllPubspecs(): Promise<PubspecInfo[]> {
        log('Database: getAllPubspecs called');
        if (!this.initialized) {
            throw new Error('Database not initialized');
        }
        return new Promise((resolve, reject) => {
            this.db!.all("SELECT * FROM pubspecs", (err: Error | null, rows: any[]) => {
                if (err) {
                    log(`Database: Error in getAllPubspecs: ${err.message}`);
                    reject(err);
                } else {
                    resolve(rows as PubspecInfo[]);
                }
            });
        });
    }

    async saveVector(packageName: string, vector: number[]): Promise<void> {
        log(`Database: saveVector called for ${packageName}`);
        return new Promise((resolve, reject) => {
            const stmt = this.db!.prepare("INSERT OR REPLACE INTO vectors (packageName, vector) VALUES (?, ?)");
            stmt.run(packageName, JSON.stringify(vector), (err: Error | null) => {
                if (err) {
                    log(`Database: Error in saveVector: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
            stmt.finalize();
        });
    }

    async getVector(packageName: string): Promise<number[] | null> {
        log(`Database: getVector called for ${packageName}`);
        return new Promise((resolve, reject) => {
            this.db!.get("SELECT vector FROM vectors WHERE packageName = ?", [packageName], (err: Error | null, row: { vector: string } | undefined) => {
                if (err) {
                    log(`Database: Error in getVector: ${err.message}`);
                    reject(err);
                } else {
                    const vector = row ? JSON.parse(row.vector) : null;
                    log(`Database: Vector retrieved for ${packageName}`);
                    resolve(vector);
                }
            });
        });
    }

    async getAllVectors(): Promise<{ packageName: string, vector: number[] }[]> {
        log('Database: getAllVectors called');
        return new Promise((resolve, reject) => {
            this.db!.all("SELECT packageName, vector FROM vectors", (err: Error | null, rows: { packageName: string, vector: string }[]) => {
                if (err) {
                    log(`Database: Error in getAllVectors: ${err.message}`);
                    reject(err);
                } else {
                    const vectors = rows.map(row => ({
                        packageName: row.packageName,
                        vector: JSON.parse(row.vector)
                    }));
                    log(`Database: All vectors retrieved (${vectors.length} vectors)`);
                    resolve(vectors);
                }
            });
        });
    }

    async clearVectors(): Promise<void> {
        log('Database: clearVectors called');
        return new Promise((resolve, reject) => {
            this.db!.run("DELETE FROM vectors", (err: Error | null) => {
                if (err) {
                    log(`Database: Error in clearVectors: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async clearPubspecs(): Promise<void> {
        log('Database: clearPubspecs called');
        return new Promise((resolve, reject) => {
            this.db!.run("DELETE FROM pubspecs", (err: Error | null) => {
                if (err) {
                    log(`Database: Error in clearPubspecs: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    close() {
        log('Database: close called');
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    log(`Database: Error closing database: ${err.message}`);
                } else {
                    log('Database: Closed successfully');
                }
            });
        }
    }
}