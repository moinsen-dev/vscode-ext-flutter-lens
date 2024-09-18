import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import * as vscode from 'vscode';

export class DocumentationPanel {
    public static currentPanel: DocumentationPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly extensionUri: vscode.Uri
    ) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openExternal':
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, packageName: string, customContent?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DocumentationPanel.currentPanel) {
            DocumentationPanel.currentPanel._panel.reveal(column);
            DocumentationPanel.currentPanel._update(packageName, customContent);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'packageDocumentation',
                'Package Documentation',
                column || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [extensionUri]
                }
            );

            DocumentationPanel.currentPanel = new DocumentationPanel(panel, extensionUri);
            DocumentationPanel.currentPanel._update(packageName, customContent);
        }
    }

    private async _update(packageName: string, customContent?: string) {
        this._panel.title = `${packageName} Documentation`;
        this._panel.webview.html = await this._getHtmlForWebview(packageName, customContent);

        // Send the current theme to the webview
        this._panel.webview.postMessage({
            type: 'vscode-theme-changed',
            theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
        });

        // Listen for theme changes
        vscode.window.onDidChangeActiveColorTheme(theme => {
            this._panel.webview.postMessage({
                type: 'vscode-theme-changed',
                theme: theme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
            });
        });
    }

    private async _getHtmlForWebview(packageName: string, customContent?: string): Promise<string> {
        const documentation = customContent || await this._fetchDocumentation(packageName);
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${packageName} Documentation</title>
                <style>
                    :root {
                        --background-color: #ffffff;
                        --text-color: #333333;
                        --link-color: #0175C2;
                        --code-background: #f4f4f4;
                        --border-color: #e0e0e0;
                    }
                    @media (prefers-color-scheme: dark) {
                        :root {
                            --background-color: #1e1e1e;
                            --text-color: #d4d4d4;
                            --link-color: #4dc9ff;
                            --code-background: #2a2a2a;
                            --border-color: #505050;
                        }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: var(--text-color);
                        background-color: var(--background-color);
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    h1, h2 {
                        color: var(--link-color);
                    }
                    a {
                        color: var(--link-color);
                        text-decoration: none;
                    }
                    a:hover {
                        text-decoration: underline;
                    }
                    pre, code {
                        background-color: var(--code-background);
                        padding: 10px;
                        border-radius: 5px;
                        overflow-x: auto;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                    .accordion {
                        background-color: var(--background-color);
                        color: var(--text-color);
                        cursor: pointer;
                        padding: 18px;
                        width: 100%;
                        text-align: left;
                        border: none;
                        outline: none;
                        transition: 0.4s;
                        border-bottom: 1px solid var(--border-color);
                    }
                    .active, .accordion:hover {
                        background-color: var(--code-background);
                    }
                    .panel {
                        padding: 0 18px;
                        background-color: var(--background-color);
                        max-height: 0;
                        overflow: hidden;
                        transition: max-height 0.2s ease-out;
                    }
                </style>
            </head>
            <body>
                ${documentation}
                <script>
                    var acc = document.getElementsByClassName("accordion");
                    var i;

                    for (i = 0; i < acc.length; i++) {
                        acc[i].addEventListener("click", function() {
                            this.classList.toggle("active");
                            var panel = this.nextElementSibling;
                            if (panel.style.maxHeight) {
                                panel.style.maxHeight = null;
                            } else {
                                panel.style.maxHeight = panel.scrollHeight + "px";
                            }
                        });
                    }

                    // Listen for theme changes
                    window.addEventListener('message', event => {
                        if (event.data.type === 'vscode-theme-changed') {
                            document.body.className = event.data.theme;
                        }
                    });

                    // Handle external links
                    document.addEventListener('click', (event) => {
                        const target = event.target;
                        if (target.tagName === 'A' && target.href) {
                            event.preventDefault();
                            vscode.postMessage({
                                command: 'openExternal',
                                url: target.href
                            });
                        }
                    });
                </script>
            </body>
            </html>`;
    }

    private async _fetchDocumentation(packageName: string): Promise<string> {
        try {
            const response = await fetch(`https://pub.dev/packages/${packageName}`);
            const html = await response.text();
            const $ = cheerio.load(html);

            let documentation = '';

            // Extract package name and version
            const name = $('h1.title').text().trim();
            const version = $('.package-header__version').text().trim();
            documentation += `<h1>${name} (${version})</h1>`;

            // Extract links
            const githubLink = $('a.link--github').attr('href') || '';
            const pubDevLink = `https://pub.dev/packages/${packageName}`;

            documentation += `<p>`;
            if (githubLink) {
                documentation += `<a href="${githubLink}" target="_blank">GitHub Repository</a> | `;
            }
            documentation += `<a href="${pubDevLink}" target="_blank">pub.dev Page</a>`;
            documentation += `</p>`;

            // Extract package description
            const description = $('.package-description').text().trim();
            documentation += `<button class="accordion">Description</button>
            <div class="panel">
                <p>${description}</p>
            </div>`;

            // Extract README content
            const readme = $('.markdown-body').html() || '';
            documentation += `<button class="accordion">README</button>
            <div class="panel">
                ${readme}
            </div>`;

            // Extract API documentation link
            const apiDocLink = $('a:contains("API reference")').attr('href');
            if (apiDocLink) {
                documentation += `<button class="accordion">API Documentation</button>
                <div class="panel">
                    <a href="${apiDocLink}" target="_blank">View Full API Documentation</a>
                </div>`;
            }

            return documentation;
        } catch (error) {
            console.error(`Error fetching documentation for ${packageName}:`, error);
            return `<p>Error fetching documentation for ${packageName}. Please try again later.</p>`;
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