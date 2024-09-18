# Change Log

All notable changes to the "flutter-lens" extension will be documented in this file.

## [0.3.3] - 2024-09-18

### Added
- New sidebar tree view for displaying pubspec.yaml information
- Detailed view of dependencies, dev dependencies, and Flutter settings in the sidebar
- Refresh button for the sidebar tree view

### Improved
- Enhanced sidebar tree view to display nested objects in pubspec.yaml
- Better representation of complex data structures like dependencies and Flutter settings

### Changed
- Replaced WebView-based sidebar with a TreeView for better performance and native look
- Updated the pubspec analysis to work with the new TreeView structure

### Fixed
- Resolved issues with ES module incompatibility by switching to built-in `https` module

## [0.3.2] - 2024-09-10
- Refactored the codebase to improve performance and maintainability

### Changed
- Translated all user-facing messages from German to English for better internationalization

## [0.3.1] - 2024-09-04

### Fixed
- Fixed an issue in the automatic documentation update function where the pubspec analysis was called incorrectly

## [0.3.0] - 2024-09-01

### Added
- Context menu item for analyzing pubspec.yaml file directly from the editor

## [0.2.0] - 2024-08-30

### Added
- Extension icon
- Sidebar UI for easy access to main functionalities
- Improved user interface for better control of the extension

## [0.1.0] - 2024-08-27

### Added
- Initial release of Flutter Lens
- Pubspec.yaml analysis functionality
- Package documentation extraction and indexing
- Searchable interface for querying package documentation
- Similar question suggestions
- Export functionality for search results
- Automatic documentation update scheduler

## [0.4.2] - 2024-09-27

### Fixed
- Resolved issue with vector dimension mismatch during documentation extraction
- Improved error handling in TfIdfVectorizer to ensure consistent vector dimensions
