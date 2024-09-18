import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { Database } from './database';
import { DocumentationPanel } from './documentationPanel';

interface PubspecData {
    name: string;
    path: string;
    [key: string]: any;
}

class PubspecItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly pubspecInfo?: any,
        public readonly contextValue?: string,
        public readonly resourceUri?: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.resourceUri = resourceUri;
    }
}

export class SidebarProvider implements vscode.TreeDataProvider<PubspecItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PubspecItem | undefined | null | void> = new vscode.EventEmitter<PubspecItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PubspecItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private searchQuery: string = '';
    private database: Database;

    constructor(private context: vscode.ExtensionContext) {
        this.database = new Database(context);
        this.context.subscriptions.push(
            vscode.commands.registerCommand('flutterLensExplorer.openPubspecFile', (filePath) => this.openPubspecFile(filePath)),
            vscode.commands.registerCommand('flutterLensExplorer.showPackageDocumentation', (packageName) => this.showPackageDocumentation(packageName)),
            vscode.commands.registerCommand('flutterLensExplorer.refreshEntry', () => this.refresh()),
            vscode.commands.registerCommand('flutterLensExplorer.searchDependencies', () => this.searchDependencies()),
            vscode.commands.registerCommand('flutterLensExplorer.clearSearch', () => this.clearSearch())
        );
    }

    async refresh(): Promise<void> {
        try {
            await this.updateDatabase();
            this._onDidChangeTreeData.fire();
        } catch (error) {
            vscode.window.showErrorMessage(`Error refreshing: ${(error as Error).message}`);
        }
    }

    getTreeItem(element: PubspecItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PubspecItem): Promise<PubspecItem[]> {
        try {
            if (!element) {
                return [
                    new PubspecItem('Search', vscode.TreeItemCollapsibleState.None, undefined, 'search'),
                    new PubspecItem('Pubspec', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'pubspecRoot')
                ];
            }

            if (element.contextValue === 'pubspecRoot') {
                return await this.getPubspecFiles();
            }

            if (element.contextValue === 'pubspec') {
                return this.getPubspecDetails(element.pubspecInfo);
            }

            if (element.contextValue === 'dependencies' || element.contextValue === 'devDependencies' || element.contextValue === 'nestedObject') {
                let items = this.getObjectItems(element.pubspecInfo, element.contextValue);
                if (this.searchQuery) {
                    items = items.filter(item => item.label.toLowerCase().includes(this.searchQuery.toLowerCase()));
                }
                return items;
            }

            return [];
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting children: ${(error as Error).message}`);
            return [];
        }
    }

    private getObjectItems(obj: any, contextValue: string): PubspecItem[] {
        return Object.entries(obj).map(([key, value]) => {
            if (value !== null && typeof value === 'object') {
                return new PubspecItem(
                    key,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    value,
                    'nestedObject'
                );
            } else {
                return new PubspecItem(
                    `${key}: ${value}`,
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    'dependency'
                );
            }
        });
    }

    private async getPubspecFiles(): Promise<PubspecItem[]> {
        try {
            const pubspecs = await this.database.getPubspecs();
            return pubspecs.map((pubspec: PubspecData) => new PubspecItem(
                pubspec.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                pubspec,
                'pubspec',
                vscode.Uri.file(pubspec.path)
            ));
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting pubspec files: ${(error as Error).message}`);
            return [];
        }
    }

    private getPubspecDetails(pubspec: any): PubspecItem[] {
        const details = [];
        for (const [key, value] of Object.entries(pubspec)) {
            if (typeof value === 'object' && value !== null && key !== '_id') {
                details.push(new PubspecItem(key, vscode.TreeItemCollapsibleState.Collapsed, value, key));
            } else if (key !== '_id' && key !== 'path') {
                details.push(new PubspecItem(`${key}: ${value}`, vscode.TreeItemCollapsibleState.None));
            }
        }
        return details;
    }

    private openPubspecFile(fileUri: vscode.Uri) {
        vscode.workspace.openTextDocument(fileUri).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }

    private showPackageDocumentation(packageName: string) {
        DocumentationPanel.createOrShow(this.context.extensionUri, packageName);
    }

    private async updateDatabase() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        await this.database.clearPubspecs();

        for (const folder of workspaceFolders) {
            const pubspecFiles = await this.findPubspecFiles(folder.uri.fsPath);
            for (const pubspecPath of pubspecFiles) {
                const content = await fs.promises.readFile(pubspecPath, 'utf8');
                const pubspec = yaml.load(content) as any;
                pubspec.path = pubspecPath;
                pubspec.name = path.basename(path.dirname(pubspecPath)); // Use directory name as pubspec name
                await this.database.savePubspec(pubspec);
            }
        }
    }

    private async findPubspecFiles(dir: string): Promise<string[]> {
        let results: string[] = [];
        const ignoredDirs = new Set([
            'build', '.dart_tool', 'ios', 'android', 'linux', 'windows', 'macos', 'web',
            'node_modules', '.git', '.idea', '.vscode'
        ]);

        const list = await fs.promises.readdir(dir);

        for (const file of list) {
            if (ignoredDirs.has(file)) {
                continue;
            }

            const filePath = path.join(dir, file);
            const stat = await fs.promises.stat(filePath);

            if (stat.isDirectory()) {
                results = results.concat(await this.findPubspecFiles(filePath));
            } else if (file === 'pubspec.yaml') {
                results.push(filePath);
            }
        }

        return results;
    }

    private async searchDependencies() {
        const query = await vscode.window.showInputBox({
            placeHolder: "Search dependencies...",
            prompt: "Enter a search term"
        });
        if (query !== undefined) {
            this.searchQuery = query;
            this.refresh();
        }
    }

    private clearSearch() {
        this.searchQuery = '';
        this.refresh();
    }
}