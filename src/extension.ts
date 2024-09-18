import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as https from 'https';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { DocumentationPanel } from './documentationPanel';
import { SidebarProvider } from './sidebarProvider';
import { TfIdfVectorizer } from './tfIdfVectorizer';
import { VectorDatabase } from './vectorDatabase';

let vectorDb: VectorDatabase;
let vectorizer: TfIdfVectorizer;

export function activate(context: vscode.ExtensionContext) {
	console.log('Flutter Lens is now active!');

	vectorDb = new VectorDatabase(context);
	vectorizer = new TfIdfVectorizer();

	// Create and register the sidebar provider
	const sidebarProvider = new SidebarProvider(context);
	vscode.window.registerTreeDataProvider('flutterLensExplorer', sidebarProvider);

	// Remove this duplicate command registration
	// context.subscriptions.push(
	// 	vscode.commands.registerCommand('flutterLensExplorer.refreshEntry', () => sidebarProvider.refresh())
	// );

	let analyzeDisposable = vscode.commands.registerCommand('flutter-lens.analyzePubspec', async () => {
		await analyzePubspec();
		updateSidebarPubspecInfo();
	});

	let askDisposable = vscode.commands.registerCommand('flutter-lens.askQuestion', () => {
		// We'll update this to open the documentation panel for a specific package
		// For now, let's open it with a placeholder package name
		DocumentationPanel.createOrShow(context.extensionUri, 'placeholder_package');
	});

	let updateDisposable = vscode.commands.registerCommand('flutter-lens.updateDocumentation', async () => {
		await updateDocumentation(context);
		updateSidebarPubspecInfo();
	});

	context.subscriptions.push(analyzeDisposable, askDisposable, updateDisposable);

	// Start the regular documentation update
	scheduleDocumentationUpdate(context);

	// Initial update of sidebar pubspec info
	updateSidebarPubspecInfo();
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
				// Instead of calling analyzePubspec with a path, we'll read the file and analyze its content
				const content = fs.readFileSync(pubspecPath, 'utf8');
				await analyzePubspecContent(content);
			}
		}
	}
}

// Rename the existing analyzePubspec function to analyzePubspecContent and modify it to accept content
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

// Keep the original analyzePubspec function for the command, but modify it to use analyzePubspecContent
async function analyzePubspec() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor found');
		return;
	}

	const document = editor.document;
	if (path.basename(document.fileName) !== 'pubspec.yaml') {
		vscode.window.showErrorMessage('This is not a pubspec.yaml file');
		return;
	}

	const content = document.getText();
	await analyzePubspecContent(content);
}

async function extractDocumentation(packageName: string) {
	try {
		const html = await fetchHtml(`https://pub.dev/packages/${packageName}`);

		const $ = cheerio.load(html);

		const description = $('.package-description').text().trim();
		const version = $('.package-header__version').text().trim();
		const readme = $('.markdown-body').html() || '';

		// Extract the most important sections from the README
		const sections = extractSections(readme);

		vscode.window.showInformationMessage(`Extracted documentation for ${packageName}`);

		// Combine all text for vectorization
		const fullText = `${packageName} ${description} ${Object.values(sections).join(' ')}`;

		// Add document to vectorizer
		vectorizer.addDocument(fullText);

		// Fit the vectorizer after adding all documents
		vectorizer.fit();

		// Transform the document to a vector
		const vector = vectorizer.transform(fullText);

		// Check if the vector dimension matches the expected dimension
		if (vector.length !== 384) {
			console.warn(`Warning: Vector dimension mismatch for ${packageName}. Expected 384, got ${vector.length}.`);
			// You might want to implement a dimension reduction or padding strategy here
			// For now, we'll skip adding this document to the database
			return;
		}

		// Add the vector to the database
		await vectorDb.addDocument(fullText, vector);

		// Save the index after adding new documents
		vectorDb.saveIndex();

	} catch (error) {
		console.error(`Error extracting documentation for ${packageName}:`, error);
		vscode.window.showErrorMessage(`Error extracting documentation for ${packageName}: ${(error as Error).message}`);
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

async function updateSidebarPubspecInfo() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders) {
		const pubspecInfos = [];
		for (const folder of workspaceFolders) {
			const pubspecPath = path.join(folder.uri.fsPath, 'pubspec.yaml');
			if (fs.existsSync(pubspecPath)) {
				const content = fs.readFileSync(pubspecPath, 'utf8');
				const pubspec = yaml.load(content) as any;
				pubspecInfos.push({
					name: pubspec.name,
					version: pubspec.version,
					dependencies: pubspec.dependencies || {},
					devDependencies: pubspec.dev_dependencies || {},
					flutter: pubspec.flutter || {}
				});
			}
		}
		// Remove this line as it's no longer needed:
		// sidebarProvider.updatePubspecInfo(pubspecInfos);
	}
}

export function deactivate() {
	vectorDb.saveIndex();
}
