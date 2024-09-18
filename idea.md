# FlutterLens - A tool that delves deeper into the documentation of Flutter packages and widgets.

**I) Summary:**

The idea is a VSCode extension that helps Flutter developers analyze their project's pubspec.yaml file. The extension extracts information from the packages defined in the pubspec.yaml file, as well as documentation for widgets from flutter.dev. This information is stored in a vector database to be searched through by a chat assistant. The assistant supports the developer by answering questions about the documentation and providing relevant information to facilitate working with packages and widgets.

---

**II) Problems the app solves:**

1. **Lack of overview of packages and their documentation:** It's often tedious to understand, manage, and search for corresponding documentation for the installed packages in the pubspec.yaml file.
2. **Efficient access to documentation:** Many developers spend a lot of time manually searching for the appropriate documentation for packages or widgets.
3. **Missing context information:** Without unified access to documentation, specific information about functions and best practices of packages and widgets is often missing.
4. **Learning curve for new packages and widgets:** New packages or widgets that a developer is not yet familiar with often require a lot of time to learn.

---

**III) Delimitation - What the app should not do:**

1. **Not a general package manager:** The app should not focus on managing dependencies (like a package manager) but only on documentation analysis.
2. **No code generation:** The app will not create automated code snippets or templates based on the packages.
3. **Not a full-fledged debugging assistant:** Although the assistant provides help with documentation, it should not take on the function of a complete debugger.
4. **Not replacing flutter.dev:** The app does not replace the official documentation portal but helps to access information faster.

---

**IV) Use Cases:**

1. **Quick search for package information:** A developer wants to learn about the usage of a specific package listed in the pubspec.yaml file.
2. **Questions about widget functionality:** The developer asks the chat assistant a question about using a Flutter widget they are using in their project.
3. **Information on package dependencies:** The developer wants to know what dependencies certain packages bring with them and what versions are required.
4. **Documentation research for new packages:** When the developer includes a new package, the extension helps to immediately find relevant documentation and tutorials.

---

**V) Features:**

1. **Feature:** Pubspec.yaml analysis
   **Description:** Analyzes the pubspec.yaml file and detects all installed packages. Prepares the relevant information.
   **Priority:** 10
   **Effort:** M

2. **Feature:** Package documentation extraction
   **Description:** Extracts the documentation of the packages defined in pubspec.yaml and stores it in a vector database.
   **Priority:** 9
   **Effort:** L

3. **Feature:** Chat assistant for packages
   **Description:** The developer can ask questions about the packages, the answers come from the extracted documentation.
   **Priority:** 9
   **Effort:** L

4. **Feature:** Flutter widget documentation integration
   **Description:** The documentation of widgets from flutter.dev is extracted and also integrated into the vector database.
   **Priority:** 8
   **Effort:** M

5. **Feature:** Chat assistant for Flutter widgets
   **Description:** The developer can ask questions about Flutter widgets, the answers come from the widget documentation.
   **Priority:** 8
   **Effort:** L

6. **Feature:** Auto-update of documentation
   **Description:** When changes are made to pubspec.yaml or new versions of packages are available, the documentation is automatically updated.
   **Priority:** 7
   **Effort:** XL

7. **Feature:** Overview of packages and dependencies
   **Description:** Shows an overview of all installed packages and their dependencies.
   **Priority:** 6
   **Effort:** M

---

If you want to proceed, we can now discuss the UI design and the linking of the screens.