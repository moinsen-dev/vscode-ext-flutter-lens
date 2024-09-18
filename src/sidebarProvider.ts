import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { Database } from './database';
import { DocumentationPanel } from './documentationPanel';
import { log } from './utils/logging';

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
        log('SidebarProvider: Constructor called');
        this.database = new Database(context);
        this.context.subscriptions.push(
            vscode.commands.registerCommand('flutterLensExplorer.openPubspecFile', (filePath) => this.openPubspecFile(filePath)),
            vscode.commands.registerCommand('flutterLensExplorer.showPackageDocumentation', (packageName) => this.showPackageDocumentation(packageName)),
            vscode.commands.registerCommand('flutterLensExplorer.refreshEntry', () => this.refresh()),
            vscode.commands.registerCommand('flutterLensExplorer.showPubspecOverview', (pubspecInfo) => this.showPubspecOverview(pubspecInfo)),
            vscode.commands.registerCommand('flutterLensExplorer.showDependencyOverview', (dep, isDev, versions) => this.showDependencyOverview(dep, isDev, versions)),
            vscode.commands.registerCommand('flutterLensExplorer.setSearchQuery', () => this.setSearchQuery())
        );
    }

    async refresh(): Promise<void> {
        log('SidebarProvider: Refresh called');
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                log('SidebarProvider: No workspace folders found');
                return;
            }

            for (const folder of workspaceFolders) {
                await this.database.init(folder);
                await this.database.clearPubspecs(); // Clear existing pubspecs for this workspace
                await this.updateDatabaseForFolder(folder);
            }

            this._onDidChangeTreeData.fire();
        } catch (error) {
            log(`SidebarProvider: Error in refresh ${(error as Error).message}`);
            vscode.window.showErrorMessage(`Error refreshing: ${(error as Error).message}`);
        }
    }

    getTreeItem(element: PubspecItem): vscode.TreeItem {
        if (element.contextValue === 'search') {
            element.command = {
                command: 'flutterLensExplorer.setSearchQuery',
                title: 'Set Search Query'
            };
        }
        return element;
    }

    async getChildren(element?: PubspecItem): Promise<PubspecItem[]> {
        console.log('SidebarProvider: getChildren called', element);
        try {
            if (!element) {
                return [
                    new PubspecItem('Search', vscode.TreeItemCollapsibleState.None, undefined, 'search'),
                    new PubspecItem('All Dependencies', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'allDependencies'),
                    new PubspecItem('All Dev Dependencies', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'allDevDependencies'),
                    new PubspecItem('Pubspec', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'pubspecRoot')
                ];
            }

            // Apply search filter to all items
            const filterItems = (items: PubspecItem[]) => {
                if (this.searchQuery) {
                    return items.filter(item => item.label.toLowerCase().includes(this.searchQuery.toLowerCase()));
                }
                return items;
            };

            if (element.contextValue === 'pubspecRoot') {
                return filterItems(await this.getPubspecFiles());
            }

            if (element.contextValue === 'pubspec') {
                return filterItems(this.getPubspecDetails(element.pubspecInfo));
            }

            if (element.contextValue === 'allDependencies') {
                return filterItems(await this.getAllDependencies());
            }

            if (element.contextValue === 'allDevDependencies') {
                return filterItems(await this.getAllDevDependencies());
            }

            if (element.contextValue === 'dependencies' || element.contextValue === 'devDependencies' || element.contextValue === 'nestedObject') {
                return filterItems(this.getObjectItems(element.pubspecInfo, element.contextValue));
            }

            return [];
        } catch (error) {
            console.error('SidebarProvider: Error in getChildren', error);
            vscode.window.showErrorMessage(`Error getting children: ${(error as Error).message}`);
            return [];
        }
    }

    private getObjectItems(obj: any, contextValue: string): PubspecItem[] {
        console.log('SidebarProvider: getObjectItems called', obj, contextValue);
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
        console.log('SidebarProvider: getPubspecFiles called');
        try {
            const pubspecs = await this.database.getAllPubspecs();
            console.log('SidebarProvider: Pubspecs retrieved', pubspecs);
            return pubspecs.map((pubspec: PubspecData) => {
                const pubspecItem = new PubspecItem(
                    pubspec.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    JSON.parse(pubspec.content),
                    'pubspec',
                    vscode.Uri.file(pubspec.path)
                );
                pubspecItem.command = {
                    command: 'flutterLensExplorer.openPubspecFile',
                    title: 'Open Pubspec File',
                    arguments: [vscode.Uri.file(pubspec.path)]
                };
                return pubspecItem;
            });
        } catch (error) {
            console.error('SidebarProvider: Error in getPubspecFiles', error);
            vscode.window.showErrorMessage(`Error getting pubspec files: ${(error as Error).message}`);
            return [];
        }
    }

    private getPubspecDetails(pubspec: any): PubspecItem[] {
        console.log('SidebarProvider: getPubspecDetails called', pubspec);
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
        console.log('SidebarProvider: openPubspecFile called', fileUri);
        vscode.workspace.openTextDocument(fileUri).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }

    private showPackageDocumentation(packageName: string) {
        log(`SidebarProvider: showPackageDocumentation called for ${packageName}`);
        DocumentationPanel.createOrShow(this.context.extensionUri, packageName);
    }

    private showPubspecOverview(pubspecInfo: any) {
        log(`SidebarProvider: showPubspecOverview called for ${pubspecInfo.name}`);
        const overviewContent = this.generatePubspecOverview(pubspecInfo);
        DocumentationPanel.createOrShow(this.context.extensionUri, pubspecInfo.name, overviewContent);
    }

    private generatePubspecOverview(pubspecInfo: any): string {
        let overview = `<h1>${pubspecInfo.name}</h1>`;

        if (pubspecInfo.description) {
            overview += `<p><strong>Description:</strong> ${pubspecInfo.description}</p>`;
        }

        if (pubspecInfo.version) {
            overview += `<p><strong>Version:</strong> ${pubspecInfo.version}</p>`;
        }

        if (pubspecInfo.dependencies) {
            overview += '<h2>Dependencies</h2><ul>';
            for (const [dep, version] of Object.entries(pubspecInfo.dependencies)) {
                overview += `<li>${dep}: ${version}</li>`;
            }
            overview += '</ul>';
        }

        if (pubspecInfo.dev_dependencies) {
            overview += '<h2>Dev Dependencies</h2><ul>';
            for (const [dep, version] of Object.entries(pubspecInfo.dev_dependencies)) {
                overview += `<li>${dep}: ${version}</li>`;
            }
            overview += '</ul>';
        }

        return overview;
    }

    private async updateDatabaseForFolder(folder: vscode.WorkspaceFolder) {
        const pubspecFiles = await this.findPubspecFiles(folder.uri.fsPath);
        log(`SidebarProvider: Pubspec files found: ${pubspecFiles.length}`);
        for (const pubspecPath of pubspecFiles) {
            const content = await fs.promises.readFile(pubspecPath, 'utf8');
            const pubspec = yaml.load(content) as any;
            const name = path.basename(path.dirname(pubspecPath));
            await this.database.savePubspec({
                name,
                path: pubspecPath,
                content: JSON.stringify(pubspec)
            });
        }
    }

    private async updateDatabase() {
        log('SidebarProvider: updateDatabase called');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            log('SidebarProvider: No workspace folders found');
            return;
        }

        for (const folder of workspaceFolders) {
            try {
                await this.database.init(folder);
                await this.updateDatabaseForFolder(folder);
            } catch (error) {
                log(`SidebarProvider: Error updating database for folder ${folder.name}: ${(error as Error).message}`);
                throw error; // Re-throw the error to be caught in the refresh method
            }
        }
    }

    private async findPubspecFiles(dir: string): Promise<string[]> {
        console.log('SidebarProvider: findPubspecFiles called', dir);
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

    private async setSearchQuery() {
        const query = await vscode.window.showInputBox({
            placeHolder: "Filter dependencies...",
            prompt: "Enter a search term",
            value: this.searchQuery
        });
        if (query !== undefined) {
            this.searchQuery = query;
            this._onDidChangeTreeData.fire();
        }
    }

    private async getAllDependencies(): Promise<PubspecItem[]> {
        const dependencies = await this.getDependenciesWithCount('dependencies');
        return this.createDependencyItems(dependencies, 'dependency');
    }

    private async getAllDevDependencies(): Promise<PubspecItem[]> {
        const devDependencies = await this.getDependenciesWithCount('dev_dependencies');
        return this.createDependencyItems(devDependencies, 'devDependency');
    }

    private async getDependenciesWithCount(dependencyType: 'dependencies' | 'dev_dependencies'): Promise<Map<string, Set<string>>> {
        const pubspecs = await this.database.getAllPubspecs();
        const dependenciesInfo = new Map<string, Set<string>>();

        pubspecs.forEach(pubspec => {
            const content = JSON.parse(pubspec.content);
            const dependencies = content[dependencyType] || {};
            Object.entries(dependencies).forEach(([dep, version]) => {
                if (!dependenciesInfo.has(dep)) {
                    dependenciesInfo.set(dep, new Set());
                }
                dependenciesInfo.get(dep)!.add(version as string);
            });
        });

        return dependenciesInfo;
    }

    private createDependencyItems(dependencies: Map<string, Set<string>>, contextValue: string): PubspecItem[] {
        return Array.from(dependencies.entries())
            .sort((a, b) => b[1].size - a[1].size) // Sort by count in descending order
            .map(([dep, versions]) => {
                const item = new PubspecItem(
                    `${dep} (${versions.size})`,
                    vscode.TreeItemCollapsibleState.None,
                    { name: dep, versions: Array.from(versions) },
                    contextValue
                );
                item.command = {
                    command: 'flutterLensExplorer.showDependencyOverview',
                    title: 'Show Dependency Overview',
                    arguments: [dep, contextValue === 'devDependency', Array.from(versions)]
                };
                return item;
            });
    }

    private async showDependencyOverview(dependencyName: string, isDevDependency: boolean, versions: string[]) {
        const pubspecs = await this.database.getAllPubspecs();
        const occurrences = pubspecs.filter(pubspec => {
            const content = JSON.parse(pubspec.content);
            const dependencies = isDevDependency ? content.dev_dependencies : content.dependencies;
            return dependencies && dependencies[dependencyName];
        });

        const overviewContent = this.generateDependencyOverview(dependencyName, isDevDependency, versions, occurrences);
        DocumentationPanel.createOrShow(this.context.extensionUri, dependencyName, overviewContent);
    }

    private generateDependencyOverview(dependencyName: string, isDevDependency: boolean, versions: string[], occurrences: any[]): string {
        let overview = `<h1>${dependencyName}</h1>`;
        overview += `<p><strong>Type:</strong> ${isDevDependency ? 'Dev Dependency' : 'Dependency'}</p>`;
        overview += `<p><strong>Total Occurrences:</strong> ${occurrences.length}</p>`;

        overview += '<h2>Versions</h2><ul>';
        versions.forEach(version => {
            overview += `<li>${version}</li>`;
        });
        overview += '</ul>';

        overview += '<h2>Occurrences</h2><ul>';
        occurrences.forEach(pubspec => {
            const content = JSON.parse(pubspec.content);
            const dependencies = isDevDependency ? content.dev_dependencies : content.dependencies;
            const version = dependencies[dependencyName];
            overview += `<li>${pubspec.name}: ${version}</li>`;
        });
        overview += '</ul>';

        return overview;
    }
}