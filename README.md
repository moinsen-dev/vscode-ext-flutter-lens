# Flutter Lens

![Work in Progress](https://img.shields.io/badge/Status-Work%20in%20Progress-yellow)
![Experimental](https://img.shields.io/badge/Status-Experimental-orange)
![Help Wanted](https://img.shields.io/badge/Help-Wanted-green)
![Early State](https://img.shields.io/badge/Status-Early%20State-blue)

[![Version](https://img.shields.io/visual-studio-marketplace/v/moinsen-dev.flutter-lens)](https://marketplace.visualstudio.com/items?itemName=moinsen-dev.flutter-lens)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/moinsen-dev.flutter-lens)](https://marketplace.visualstudio.com/items?itemName=moinsen-dev.flutter-lens)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/moinsen-dev.flutter-lens)](https://marketplace.visualstudio.com/items?itemName=moinsen-dev.flutter-lens)
[![License](https://img.shields.io/github/license/moinsen-dev/flutter-lens)](https://github.com/moinsen-dev/flutter-lens/blob/main/LICENSE)

Flutter Lens is a VSCode extension that provides deeper insights into the documentation of Flutter packages and widgets.

## Idea and Concept

For a detailed explanation of the idea behind Flutter Lens, including the problems it solves, use cases, and planned features, please refer to the [idea.md](idea.md) file in the root of this repository.

## Features

- Analyzes your project's `pubspec.yaml` file to extract information about installed packages
- Extracts and indexes documentation from pub.dev for each package
- Provides a searchable interface for querying package and widget documentation
- Offers similar question suggestions to improve search results
- Allows exporting search results for offline use
- Automatically updates documentation at regular intervals
- Sidebar UI for easy access to main functionalities

## How It Works

1. **Pubspec Analysis**: The extension scans your `pubspec.yaml` file to identify installed packages.

2. **Documentation Extraction**: For each package, Flutter Lens fetches the documentation from pub.dev and extracts relevant information.

3. **Indexing**: The extracted documentation is indexed using TF-IDF vectorization for efficient searching.

4. **Search Interface**: Users can query the indexed documentation through a searchable interface within VS Code.

5. **Similar Questions**: The extension suggests similar questions based on the user's input to improve search results.

6. **Regular Updates**: Documentation is automatically updated at set intervals to ensure the latest information is available.

## Installation

You can install Flutter Lens directly from the Visual Studio Code Marketplace:

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "Flutter Lens"
4. Click Install

## Usage

After installation:

1. Open a Flutter project in VS Code
2. Use the Flutter Lens sidebar to view your project's package information
3. Use the command palette (Ctrl+Shift+P) and search for "Flutter Lens" to access various features

## Contributing

We welcome contributions to Flutter Lens! If you'd like to contribute, please:

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes
4. Submit a pull request

For more details, please see our [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please file an issue on the [GitHub repository](https://github.com/moinsen-dev/flutter-lens/issues).

## Acknowledgements

Special thanks to all contributors and the Flutter community for their support and inspiration.
