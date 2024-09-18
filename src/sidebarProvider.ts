import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';

class PubspecItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly pubspecInfo?: any,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
    }
}

export class SidebarProvider implements vscode.TreeDataProvider<PubspecItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PubspecItem | undefined | null | void> = new vscode.EventEmitter<PubspecItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PubspecItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PubspecItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: PubspecItem): Thenable<PubspecItem[]> {
        if (!element) {
            return this.getPubspecFiles();
        }

        if (element.contextValue === 'pubspec') {
            return Promise.resolve(this.getPubspecDetails(element.pubspecInfo));
        }

        if (element.contextValue === 'dependencies' || element.contextValue === 'devDependencies' || element.contextValue === 'flutter' || element.contextValue === 'nestedObject') {
            return Promise.resolve(this.getObjectItems(element.pubspecInfo, element.contextValue));
        }

        return Promise.resolve([]);
    }

    private getObjectItems(obj: any, contextValue: string): PubspecItem[] {
        return Object.entries(obj).map(([key, value]) => {
            if (value !== null && typeof value === 'object') {
                return new PubspecItem(key, vscode.TreeItemCollapsibleState.Collapsed, value, 'nestedObject');
            } else {
                return new PubspecItem(`${key}: ${value}`, vscode.TreeItemCollapsibleState.None);
            }
        });
    }

    private async getPubspecFiles(): Promise<PubspecItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const pubspecItems: PubspecItem[] = [];

        for (const folder of workspaceFolders) {
            const pubspecFiles = this.findPubspecFiles(folder.uri.fsPath);
            for (const pubspecPath of pubspecFiles) {
                const content = fs.readFileSync(pubspecPath, 'utf8');
                const pubspec = yaml.load(content) as any;
                const relativePath = path.relative(folder.uri.fsPath, pubspecPath);
                pubspecItems.push(new PubspecItem(
                    relativePath,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    pubspec,
                    'pubspec'
                ));
            }
        }

        return pubspecItems;
    }

    private findPubspecFiles(dir: string): string[] {
        let results: string[] = [];
        const ignoredDirs = new Set([
            'build', '.dart_tool', 'ios', 'android', 'linux', 'windows', 'macos', 'web',
            'node_modules', '.git', '.idea', '.vscode'
        ]);

        const list = fs.readdirSync(dir);

        for (const file of list) {
            if (ignoredDirs.has(file)) {
                continue;
            }

            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                results = results.concat(this.findPubspecFiles(filePath));
            } else if (file === 'pubspec.yaml') {
                results.push(filePath);
            }
        }

        return results;
    }

    private getPubspecDetails(pubspec: any): PubspecItem[] {
        const details = [];
        details.push(new PubspecItem(`Name: ${pubspec.name}`, vscode.TreeItemCollapsibleState.None));
        details.push(new PubspecItem(`Version: ${pubspec.version}`, vscode.TreeItemCollapsibleState.None));
        details.push(new PubspecItem('Dependencies', vscode.TreeItemCollapsibleState.Collapsed, pubspec.dependencies, 'dependencies'));
        details.push(new PubspecItem('Dev Dependencies', vscode.TreeItemCollapsibleState.Collapsed, pubspec.dev_dependencies, 'devDependencies'));
        if (pubspec.flutter) {
            details.push(new PubspecItem('Flutter', vscode.TreeItemCollapsibleState.Collapsed, pubspec.flutter, 'flutter'));
        }
        return details;
    }
}