import * as fs from 'fs';
import * as vscode from 'vscode';
import { TfIdfVectorizer } from './tfIdfVectorizer.js';
import { VectorDatabase } from './vectorDatabase.js';

export class DocumentationPanel {
    public static currentPanel: DocumentationPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly vectorDb: VectorDatabase,
        private readonly vectorizer: TfIdfVectorizer
    ) {
        this._panel = panel;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri, vectorDb: VectorDatabase, vectorizer: TfIdfVectorizer) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DocumentationPanel.currentPanel) {
            DocumentationPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'flutterLensDocumentation',
            'Flutter Lens Documentation',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        DocumentationPanel.currentPanel = new DocumentationPanel(panel, vectorDb, vectorizer);
    }

    private _update() {
        const webviewContent = this._getHtmlForWebview();
        this._panel.webview.html = webviewContent;
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'search':
                        await this._handleSearch(message.text, message.count);
                        break;
                    case 'exportResults':
                        await this._exportResults(message.results);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _handleSearch(query: string, count: number) {
        try {
            this._panel.webview.postMessage({ command: 'startLoading' });
            const questionVector = this.vectorizer.transform(query);
            const results = await this.vectorDb.search(questionVector, count);
            const similarQuestions = await this._getSimilarQuestions(query);

            if (results.length === 0) {
                this._panel.webview.postMessage({
                    command: 'showError',
                    message: 'Keine Ergebnisse gefunden. Versuchen Sie, Ihre Frage umzuformulieren.'
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'showResults',
                    results,
                    similarQuestions
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'showError',
                message: `Fehler bei der Suche: ${(error as Error).message}`
            });
        }
    }

    private async _getSimilarQuestions(query: string): Promise<string[]> {
        const questionVector = this.vectorizer.transform(query);
        const similarDocs = await this.vectorDb.search(questionVector, 5);
        return similarDocs.map(doc => doc.split(' ').slice(0, 10).join(' ') + '...');
    }

    private _getHtmlForWebview() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Flutter Lens Documentation</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    h1 {
                        color: #0175C2;
                    }
                    input[type="text"] {
                        width: 70%;
                        padding: 10px;
                        margin-right: 10px;
                    }
                    button {
                        padding: 10px 20px;
                        background-color: #0175C2;
                        color: white;
                        border: none;
                        cursor: pointer;
                    }
                    button:hover {
                        background-color: #025a9a;
                    }
                    #results {
                        margin-top: 20px;
                    }
                    .result {
                        background-color: #f4f4f4;
                        padding: 15px;
                        margin-bottom: 15px;
                        border-radius: 5px;
                    }
                    .result h2 {
                        margin-top: 0;
                        color: #0175C2;
                    }
                    .loader {
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #0175C2;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        display: none;
                        margin: 20px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .copy-button {
                        background-color: #4CAF50;
                        border: none;
                        color: white;
                        padding: 5px 10px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 12px;
                        margin: 4px 2px;
                        cursor: pointer;
                    }
                    select {
                        padding: 5px 10px;
                        margin-right: 10px;
                    }
                    .error-message {
                        color: #D32F2F;
                        background-color: #FFCDD2;
                        padding: 10px;
                        border-radius: 5px;
                        margin-top: 20px;
                    }
                    .result-content {
                        max-height: 200px;
                        overflow-y: auto;
                        border: 1px solid #ddd;
                        padding: 10px;
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <h1>Flutter Lens Documentation</h1>
                <input type="text" id="searchInput" placeholder="Stellen Sie eine Frage...">
                <button id="searchButton">Suchen</button>
                <select id="resultCount">
                    <option value="3">3 Ergebnisse</option>
                    <option value="5" selected>5 Ergebnisse</option>
                    <option value="10">10 Ergebnisse</option>
                </select>
                <button id="exportButton" style="display: none;">Ergebnisse exportieren</button>
                <div class="loader" id="loader"></div>
                <div id="errorMessage" class="error-message" style="display: none;"></div>
                <div id="similarQuestions" style="display: none;">
                    <h3>Ähnliche Fragen:</h3>
                    <ul id="similarQuestionsList"></ul>
                </div>
                <div id="results"></div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const searchButton = document.getElementById('searchButton');
                    const searchInput = document.getElementById('searchInput');
                    const resultsDiv = document.getElementById('results');
                    const loader = document.getElementById('loader');
                    const resultCount = document.getElementById('resultCount');
                    const errorMessage = document.getElementById('errorMessage');
                    const exportButton = document.getElementById('exportButton');
                    const similarQuestions = document.getElementById('similarQuestions');
                    const similarQuestionsList = document.getElementById('similarQuestionsList');

                    function search() {
                        vscode.postMessage({ 
                            command: 'search', 
                            text: searchInput.value,
                            count: parseInt(resultCount.value)
                        });
                    }

                    searchButton.addEventListener('click', search);
                    searchInput.addEventListener('keypress', (event) => {
                        if (event.key === 'Enter') {
                            search();
                        }
                    });

                    exportButton.addEventListener('click', () => {
                        vscode.postMessage({ command: 'exportResults' });
                    });

                    function copyToClipboard(text) {
                        navigator.clipboard.writeText(text).then(() => {
                            vscode.postMessage({ command: 'showInfo', text: 'In die Zwischenablage kopiert!' });
                        }, (err) => {
                            console.error('Konnte Text nicht kopieren: ', err);
                        });
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'startLoading':
                                loader.style.display = 'block';
                                resultsDiv.innerHTML = '';
                                errorMessage.style.display = 'none';
                                similarQuestions.style.display = 'none';
                                exportButton.style.display = 'none';
                                break;
                            case 'showResults':
                                loader.style.display = 'none';
                                resultsDiv.innerHTML = message.results.map(
                                    (result, index) => \`
                                        <div class="result">
                                            <h2>Ergebnis \${index + 1}</h2>
                                            <div class="result-content">\${result}</div>
                                            <button class="copy-button" onclick="copyToClipboard('\${result.replace(/'/g, "\\'")}')">Kopieren</button>
                                        </div>
                                    \`
                                ).join('');
                                exportButton.style.display = 'inline-block';
                                similarQuestionsList.innerHTML = message.similarQuestions.map(
                                    question => \`<li>\${question}</li>\`
                                ).join('');
                                similarQuestions.style.display = 'block';
                                break;
                            case 'showError':
                                loader.style.display = 'none';
                                errorMessage.textContent = message.message;
                                errorMessage.style.display = 'block';
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private async _exportResults(results: string[]) {
        const exportPath = await vscode.window.showSaveDialog({
            filters: { 'Text Files': ['txt'] }
        });

        if (exportPath) {
            const content = results.join('\n\n---\n\n');
            fs.writeFileSync(exportPath.fsPath, content);
            vscode.window.showInformationMessage(`Ergebnisse wurden nach ${exportPath.fsPath} exportiert.`);
        }
    }

    public dispose() {
        DocumentationPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}