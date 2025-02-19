import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as https from 'https';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { Database } from './database';
import { DocumentationPanel } from './documentationPanel';
import { SidebarProvider } from './sidebarProvider';
import { TfIdfVectorizer } from './tfIdfVectorizer';
import { initializeLogging, log } from './utils/logging';

let database: Database;
let vectorizer: TfIdfVectorizer;

export function activate(context: vscode.ExtensionContext) {
	initializeLogging(context);
	log('Flutter Lens: Extension is now active!');

	const sidebarProvider = new SidebarProvider(context);
	vscode.window.registerTreeDataProvider('flutterLensExplorer', sidebarProvider);

	vectorizer = new TfIdfVectorizer();

	let analyzeDisposable = vscode.commands.registerCommand('flutter-lens.analyzePubspec', async () => {
		await analyzePubspec();
		sidebarProvider.refresh();
	});

	let askDisposable = vscode.commands.registerCommand('flutter-lens.askQuestion', () => {
		DocumentationPanel.createOrShow(context.extensionUri, 'placeholder_package');
	});

	let updateDisposable = vscode.commands.registerCommand('flutter-lens.updateDocumentation', async () => {
		await updateDocumentation(context);
		sidebarProvider.refresh();
	});

	context.subscriptions.push(analyzeDisposable, askDisposable, updateDisposable);

	// Start the regular documentation update
	scheduleDocumentationUpdate(context);

	// Initial update of sidebar pubspec info
	console.log('Flutter Lens: Initiating initial refresh');
	sidebarProvider.refresh();

	// Listen for workspace folder changes
	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		console.log('Flutter Lens: Workspace folders changed, refreshing');
		sidebarProvider.refresh();
	});
}

function scheduleDocumentationUpdate(context: vscode.ExtensionContext) {
	const updateInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

	setInterval(async () => {
		try {
			await updateDocumentation(context);
			vscode.window.showInformationMessage('Flutter documentation has been successfully updated.');
		} catch (error) {
			vscode.window.showErrorMessage(`Error updating documentation: ${(error as Error).message}`);
		}
	}, updateInterval);
}

async function updateDocumentation(context: vscode.ExtensionContext) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders) {
		for (const folder of workspaceFolders) {
			const pubspecPath = path.join(folder.uri.fsPath, 'pubspec.yaml');
			if (fs.existsSync(pubspecPath)) {
				const content = fs.readFileSync(pubspecPath, 'utf8');
				await analyzePubspecContent(content);
			}
		}
	}
}

async function analyzePubspecContent(content: string) {
	try {
		const pubspec = yaml.load(content) as any;

		if (pubspec && pubspec.dependencies && typeof pubspec.dependencies === 'object') {
			const dependencies = Object.keys(pubspec.dependencies);
			vscode.window.showInformationMessage(`Found ${dependencies.length} dependencies in pubspec.yaml`);

			for (const dep of dependencies) {
				await extractDocumentation(dep);
			}
		} else {
			vscode.window.showWarningMessage('No dependencies found in pubspec.yaml');
		}
	} catch (error) {
		vscode.window.showErrorMessage('Error parsing pubspec.yaml: ' + (error as Error).message);
	}
}

async function analyzePubspec() {
	if (!vectorizer) {
		console.error('Vectorizer is not initialized');
		return;
	}

	const pubspecs = await database.getAllPubspecs();
	for (const pubspec of pubspecs) {
		const content = JSON.parse(pubspec.content);
		if (content.dependencies) {
			for (const [packageName, version] of Object.entries(content.dependencies)) {
				try {
					const documentation = await extractDocumentation(packageName);
					vectorizer.addDocument(documentation);
					await database.saveVector(packageName, vectorizer.transform(documentation));
				} catch (error) {
					console.error(`Error extracting documentation for ${packageName}:`, error);
				}
			}
		}
	}
	vectorizer.fit();
}

async function extractDocumentation(packageName: string): Promise<string> {
	try {
		const html = await fetchHtml(`https://pub.dev/packages/${packageName}`);
		const $ = cheerio.load(html);

		const description = $('.package-description').text().trim();
		const version = $('.package-header__version').text().trim();
		const readme = $('.markdown-body').html() || '';

		const sections = extractSections(readme);

		vscode.window.showInformationMessage(`Extracted documentation for ${packageName}`);

		return `${packageName} ${version} ${description} ${Object.values(sections).join(' ')}`;
	} catch (error) {
		console.error(`Error extracting documentation for ${packageName}:`, error);
		vscode.window.showErrorMessage(`Error extracting documentation for ${packageName}: ${(error as Error).message}`);
		throw error;
	}
}

function fetchHtml(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		https.get(url, (res) => {
			if (res.statusCode !== 200) {
				reject(new Error(`HTTP error! status: ${res.statusCode}`));
				return;
			}

			let data = '';
			res.on('data', (chunk) => data += chunk);
			res.on('end', () => resolve(data));
		}).on('error', reject);
	});
}

function extractSections(html: string): { [key: string]: string } {
	const $ = cheerio.load(html);
	const sections: { [key: string]: string } = {};

	$('h1, h2').each((_: number, elem: any) => {
		const title = $(elem).text().trim();
		let content = '';
		let next = $(elem).next();
		while (next.length && !['H1', 'H2'].includes(next.prop('tagName') || '')) {
			content += next.html() || '';
			next = next.next();
		}
		sections[title] = content.trim();
	});

	return sections;
}

export function deactivate() {
	database.close();
}
